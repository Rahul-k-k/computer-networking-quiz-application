// Integration tests: boot a REAL Express server against an in-memory MongoDB
// and exercise it over HTTP with fetch — not just node --check.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../app');
const { runSeed, isSeeded, DEMO_TEACHER, DEMO_STUDENT } = require('../seeder');

let mongod;
let server;
let baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await runSeed({ force: true });

  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

/** Small typed fetch helper. */
async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(baseUrl + pathname, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

test('seeded demo teacher and student can log in; no password is returned', async () => {
  const teacher = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_TEACHER.email, password: DEMO_TEACHER.password },
  });
  assert.equal(teacher.status, 200);
  assert.ok(teacher.body.token, 'expected a JWT');
  assert.equal(teacher.body.user.role, 'teacher');
  assert.equal(teacher.body.user.password, undefined, 'login must never return the password hash');

  const student = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  assert.equal(student.status, 200);
  assert.equal(student.body.user.role, 'student');
});

test('wrong password and unknown email both return the SAME generic 401', async () => {
  const wrongPassword = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: 'not-the-password' },
  });
  const unknownEmail = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'nobody@nowhere.dev', password: 'whatever' },
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  // Identical message => can't tell which field was wrong.
  assert.equal(wrongPassword.body.error, unknownEmail.body.error);
});

test('/me requires a token and never returns the password hash', async () => {
  const noToken = await api('/api/auth/me');
  assert.equal(noToken.status, 401);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  const me = await api('/api/auth/me', { token: login.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, DEMO_STUDENT.email);
  assert.equal(me.body.user.password, undefined);
});

test('registration works and duplicate emails are rejected with 409', async () => {
  const email = `new-user-${Date.now()}@example.com`;
  const first = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'New User', email, password: 'secret123' },
  });
  assert.equal(first.status, 201);
  assert.ok(first.body.token);
  assert.equal(first.body.user.password, undefined);

  const dup = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Impostor', email, password: 'secret123' },
  });
  assert.equal(dup.status, 409);
});

test('two back-to-back free-trial guests get isolated accounts and data', async () => {
  const g1 = await api('/api/auth/guest', { method: 'POST', body: { name: 'Trial One' } });
  const g2 = await api('/api/auth/guest', { method: 'POST', body: { name: 'Trial One' } });

  assert.equal(g1.status, 201);
  assert.equal(g2.status, 201);
  assert.equal(g1.body.user.isGuest, true);
  // Same requested name, but genuinely different isolated accounts.
  assert.notEqual(g1.body.user._id, g2.body.user._id);
  assert.notEqual(g1.body.user.email, g2.body.user.email);

  // Guest 1 completes a quiz.
  const cats = await api('/api/categories', { token: g1.body.token });
  assert.equal(cats.status, 200);
  const category = cats.body.categories[0];

  const quiz = await api(`/api/quiz/${category._id}/questions`, { token: g1.body.token });
  assert.equal(quiz.status, 200);
  // Sanity: the client is never sent the correct answers.
  assert.equal(quiz.body.questions[0].correctAnswer, undefined);

  const answers = quiz.body.questions.map((q) => ({
    questionId: q._id,
    answer: q.type === 'mcq' ? q.options[0] : 'something',
  }));
  const submit = await api('/api/quiz/submit', {
    method: 'POST',
    token: g1.body.token,
    body: { categoryId: category._id, answers, timeTakenSeconds: 42 },
  });
  assert.equal(submit.status, 201);
  assert.equal(submit.body.result.studentName, 'Trial One');

  // Guest 1 sees exactly their own result; guest 2 sees none.
  const g1Results = await api('/api/results/me', { token: g1.body.token });
  const g2Results = await api('/api/results/me', { token: g2.body.token });
  assert.equal(g1Results.body.results.length, 1);
  assert.equal(g2Results.body.results.length, 0);
});

test('boot-time auto-seed is idempotent (running it again inserts nothing)', async () => {
  const User = mongoose.model('User');
  assert.equal(await isSeeded(), true);

  const before = await User.countDocuments();
  const result = await runSeed(); // no force
  const after = await User.countDocuments();

  assert.equal(result.skipped, true);
  assert.equal(before, after, 're-seeding must not duplicate users');
});

test('all-in-one mixed quiz: samples across categories, hides answers, grades and stores a category-less result', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  const token = login.body.token;
  assert.ok(token);

  // Total questions available across every category.
  const cats = await api('/api/categories', { token });
  const available = cats.body.categories.reduce((sum, c) => sum + (c.questionCount || 0), 0);
  assert.ok(available > 0, 'seed should provide questions to sample from');

  // Default draw is capped at 20 and at whatever is available.
  const mixed = await api('/api/quiz/mixed/questions', { token });
  assert.equal(mixed.status, 200);
  assert.equal(mixed.body.challenge.name, 'All-in-One Challenge');
  assert.equal(mixed.body.challenge.passPercentage, 60);
  assert.equal(mixed.body.challenge.perQuestionSeconds, 60);
  assert.equal(mixed.body.questions.length, Math.min(20, available));
  // The answer key must never reach the client.
  for (const q of mixed.body.questions) {
    assert.equal(q.correctAnswer, undefined, 'mixed questions must not leak correctAnswer');
    assert.equal(q.explanation, undefined, 'mixed questions must not leak explanation');
    assert.ok(q._id && q.text, 'each question needs an id and text');
  }

  // ?count is clamped to [1, available].
  const five = await api('/api/quiz/mixed/questions?count=5', { token });
  assert.equal(five.body.questions.length, Math.min(5, available));

  // Submit the exact served set; it is graded and stored WITHOUT a categoryId.
  const questions = mixed.body.questions;
  const answers = questions.map((q) => ({
    questionId: q._id,
    answer: q.type === 'mcq' ? q.options[0] : 'something',
  }));
  const submit = await api('/api/quiz/mixed/submit', {
    method: 'POST',
    token,
    body: { questionIds: questions.map((q) => q._id), answers, timeTakenSeconds: 30 },
  });
  assert.equal(submit.status, 201);
  assert.equal(submit.body.passPercentage, 60);
  assert.equal(submit.body.result.categoryName, 'All-in-One Challenge');
  assert.ok(submit.body.result.categoryId == null, 'a mixed result spans categories, so it stores none');
  assert.equal(submit.body.result.totalQuestions, questions.length);
  assert.equal(submit.body.result.answersLog.length, questions.length);
  assert.ok(submit.body.result.percentage >= 0 && submit.body.result.percentage <= 100);

  // It appears in the student's own history.
  const me = await api('/api/results/me', { token });
  assert.ok(
    me.body.results.some((r) => String(r._id) === String(submit.body.result._id)),
    'mixed attempt should show in /results/me'
  );
});

test('mixed quiz endpoints require authentication', async () => {
  const q = await api('/api/quiz/mixed/questions');
  assert.equal(q.status, 401);
  const s = await api('/api/quiz/mixed/submit', { method: 'POST', body: { answers: [] } });
  assert.equal(s.status, 401);
});

test('mixed submit with no valid question ids is rejected with 400', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  const empty = await api('/api/quiz/mixed/submit', {
    method: 'POST',
    token: login.body.token,
    body: { questionIds: [], answers: [] },
  });
  assert.equal(empty.status, 400);

  const bogus = await api('/api/quiz/mixed/submit', {
    method: 'POST',
    token: login.body.token,
    body: { questionIds: ['not-a-real-object-id'], answers: [] },
  });
  assert.equal(bogus.status, 400);
});

test('categories carry per-difficulty counts for the student picker', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  const cats = await api('/api/categories', { token: login.body.token });
  assert.equal(cats.status, 200);
  for (const c of cats.body.categories) {
    assert.ok(c.difficultyCounts, 'each category exposes difficultyCounts');
    const { low, medium, high } = c.difficultyCounts;
    assert.equal(
      low + medium + high,
      c.questionCount,
      'the three level counts must sum to the total'
    );
  }
});

test('a category quiz can be filtered to one difficulty and grades only what it serves', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  const token = login.body.token;

  // Find a category that actually has some medium-difficulty questions.
  const cats = await api('/api/categories', { token });
  const cat = cats.body.categories.find((c) => c.difficultyCounts && c.difficultyCounts.medium > 0);
  assert.ok(cat, 'seed should provide at least one medium-difficulty question');

  const served = await api(`/api/quiz/${cat._id}/questions?difficulty=medium`, { token });
  assert.equal(served.status, 200);
  const questions = served.body.questions;
  assert.ok(questions.length > 0);
  // Never more than the category cap of 10, and never more than actually exist.
  assert.ok(questions.length <= 10);
  assert.equal(questions.length, Math.min(10, cat.difficultyCounts.medium));
  for (const q of questions) {
    assert.equal(q.difficulty, 'medium', 'only medium questions are served for that level');
    assert.equal(q.correctAnswer, undefined, 'the answer key never reaches the client');
    assert.equal(q.explanation, undefined);
  }

  // Submitting the served subset grades exactly that subset — not the whole
  // category. This is the invariant that keeps a 10-of-30 quiz from being
  // scored out of 30.
  const answers = questions.map((q) => ({
    questionId: q._id,
    answer: q.type === 'mcq' ? q.options[0] : 'something',
  }));
  const submit = await api('/api/quiz/submit', {
    method: 'POST',
    token,
    body: {
      categoryId: cat._id,
      questionIds: questions.map((q) => q._id),
      answers,
      timeTakenSeconds: 20,
    },
  });
  assert.equal(submit.status, 201);
  assert.equal(submit.body.result.totalQuestions, questions.length);
  assert.equal(submit.body.result.answersLog.length, questions.length);
});

test('asking for a difficulty level with no questions is a clean 400', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });
  const token = login.body.token;
  const cats = await api('/api/categories', { token });
  // Every seeded category cycles low/medium/high, so a level can be empty only
  // in tiny categories; guard by finding one with a zero level if present.
  const emptyLevelCat = cats.body.categories.find(
    (c) => c.difficultyCounts && (c.difficultyCounts.low === 0 || c.difficultyCounts.high === 0)
  );
  if (!emptyLevelCat) return; // nothing to assert against in this seed
  const level = emptyLevelCat.difficultyCounts.low === 0 ? 'low' : 'high';
  const served = await api(`/api/quiz/${emptyLevelCat._id}/questions?difficulty=${level}`, { token });
  assert.equal(served.status, 400);
  assert.ok(/no .*questions/i.test(JSON.stringify(served.body)));
});
