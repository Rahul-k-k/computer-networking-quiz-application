// API hardening + coverage tests. Boots a REAL Express app against an in-memory
// MongoDB and exercises paths the integration suite doesn't: malformed-id
// handling (no 500s / no Mongoose leaks), the full grading pipeline, result
// access-control, the leaderboard, and teacher-only CRUD with validation.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../app');
const { runSeed, DEMO_TEACHER, DEMO_STUDENT } = require('../seeder');
const { gradeFreeText, isExactMatch, normalize } = require('../services/grading');

let mongod;
let server;
let baseUrl;

before(async () => {
  // Guarantee the AI rescue is OFF so free-text grading is deterministic.
  delete process.env.ANTHROPIC_API_KEY;

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

const login = (creds) => api('/api/auth/login', { method: 'POST', body: creds });
const asTeacher = async () => (await login(DEMO_TEACHER)).body.token;
const asStudent = async () => (await login(DEMO_STUDENT)).body.token;
const asGuest = async (name = 'Trialist') =>
  (await api('/api/auth/guest', { method: 'POST', body: { name } })).body.token;

/** A seeded category that actually has questions. */
async function categoryWithQuestions(token) {
  const cats = await api('/api/categories', { token });
  return (cats.body.categories || []).find((c) => c.questionCount > 0);
}

// ---------------------------------------------------------------------------
// Error hardening: malformed ids must be clean 4xx, never a 500 that leaks
// the raw "Cast to ObjectId failed ..." message.
// ---------------------------------------------------------------------------

test('a malformed :id never yields a 500 or leaks the Mongoose cast message', async () => {
  const token = await asStudent();
  const teacherToken = await asTeacher();

  const cases = [
    { p: '/api/results/not-an-id', token },
    { p: '/api/quiz/not-an-id/questions', token },
    { p: '/api/questions?categoryId=not-an-id', token: teacherToken },
  ];
  for (const c of cases) {
    const r = await api(c.p, { token: c.token });
    assert.notEqual(r.status, 500, `${c.p} must not 500`);
    assert.equal(r.status, 400, `${c.p} should be a clean 400`);
    assert.ok(
      !/cast to objectid/i.test(JSON.stringify(r.body)),
      `${c.p} must not leak the raw cast error`
    );
  }
});

test('POST /quiz/submit with a malformed categoryId is a clean 400, not a 500', async () => {
  const token = await asStudent();
  const r = await api('/api/quiz/submit', {
    method: 'POST',
    token,
    body: { categoryId: 'garbage', answers: [] },
  });
  assert.equal(r.status, 400);
  assert.ok(!/cast to objectid/i.test(JSON.stringify(r.body)));
});

test('teacher update with a malformed :id is a clean 400', async () => {
  const token = await asTeacher();
  const r = await api('/api/categories/garbage', {
    method: 'PUT',
    token,
    body: { name: 'Whatever' },
  });
  assert.equal(r.status, 400);
});

test('a schema ValidationError (bad enum on update) becomes a 400, not a 500', async () => {
  const token = await asTeacher();
  const cat = await categoryWithQuestions(token);
  const list = await api(`/api/questions?categoryId=${cat._id}`, { token });
  const q = list.body.questions[0];

  const r = await api(`/api/questions/${q._id}`, {
    method: 'PUT',
    token,
    body: { type: 'not-a-valid-type', text: q.text, correctAnswer: q.correctAnswer },
  });
  assert.equal(r.status, 400, 'invalid enum should be rejected as 400');
  assert.notEqual(r.status, 500);
});

test('a valid-but-missing result id is 404; broken JSON is 400', async () => {
  const token = await asStudent();
  const missing = new mongoose.Types.ObjectId().toString();
  const r = await api(`/api/results/${missing}`, { token });
  assert.equal(r.status, 404);

  // Malformed JSON body → handled by the body parser as a clean 400.
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ not json',
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Health + routing + auth basics.
// ---------------------------------------------------------------------------

test('health check is public and unknown API routes 404', async () => {
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);

  const nope = await api('/api/does-not-exist');
  assert.equal(nope.status, 404);
});

test('a garbage bearer token is rejected with 401', async () => {
  const r = await api('/api/auth/me', { token: 'totally.not.a.jwt' });
  assert.equal(r.status, 401);
});

// ---------------------------------------------------------------------------
// The full server-side grading pipeline (all-correct → 100%, all-wrong → 0%).
// ---------------------------------------------------------------------------

test('grading is authoritative: all-correct scores 100%, all-wrong scores 0%', async () => {
  const teacherToken = await asTeacher();
  const cat = await categoryWithQuestions(teacherToken);
  assert.ok(cat, 'need a seeded category with questions');

  // Teachers see the answer key; use it to build a perfect submission.
  const full = await api(`/api/questions?categoryId=${cat._id}`, { token: teacherToken });
  const questions = full.body.questions;
  assert.ok(questions.length > 0);

  const studentToken = await asStudent();

  // The student-facing fetch must NOT include the answer key.
  const served = await api(`/api/quiz/${cat._id}/questions`, { token: studentToken });
  assert.equal(served.status, 200);
  for (const q of served.body.questions) {
    assert.equal(q.correctAnswer, undefined);
    assert.equal(q.explanation, undefined);
  }

  const correct = questions.map((q) => ({ questionId: q._id, answer: q.correctAnswer }));
  const perfect = await api('/api/quiz/submit', {
    method: 'POST',
    token: studentToken,
    body: { categoryId: cat._id, answers: correct, timeTakenSeconds: 12 },
  });
  assert.equal(perfect.status, 201);
  assert.equal(perfect.body.result.percentage, 100);
  assert.equal(perfect.body.result.score, questions.length);
  assert.equal(perfect.body.passPercentage, cat.passPercentage);
  // Post-submission, the review payload DOES include the key + explanations.
  for (const a of perfect.body.result.answersLog) {
    assert.equal(a.isCorrect, true);
    assert.ok(a.correctAnswer, 'review log should carry the correct answer');
  }

  // Now deliberately wrong: a different MCQ option, or gibberish for free-text.
  const wrong = questions.map((q, i) => {
    let answer = `zzz-wrong-${i}`;
    if (q.type === 'mcq') {
      const other = (q.options || []).find((o) => o !== q.correctAnswer);
      answer = other ?? `zzz-wrong-${i}`;
    }
    return { questionId: q._id, answer };
  });
  const failed = await api('/api/quiz/submit', {
    method: 'POST',
    token: studentToken,
    body: { categoryId: cat._id, answers: wrong, timeTakenSeconds: 9 },
  });
  assert.equal(failed.status, 201);
  assert.equal(failed.body.result.score, 0);
  assert.equal(failed.body.result.percentage, 0);
});

test('unanswered questions count against the score (blank = wrong)', async () => {
  const studentToken = await asStudent();
  const cat = await categoryWithQuestions(studentToken);
  // Grading scores exactly the served set (identified by questionIds), so fetch
  // the served questions first, then submit them with NO answers — every one is
  // blank and therefore wrong.
  const served = await api(`/api/quiz/${cat._id}/questions`, { token: studentToken });
  const questionIds = served.body.questions.map((q) => q._id);
  assert.ok(questionIds.length > 0);
  const r = await api('/api/quiz/submit', {
    method: 'POST',
    token: studentToken,
    body: { categoryId: cat._id, questionIds, answers: [], timeTakenSeconds: 3 },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.result.score, 0);
  assert.equal(r.body.result.totalQuestions, questionIds.length);
});

// ---------------------------------------------------------------------------
// Result access-control + leaderboard + teacher-only listing.
// ---------------------------------------------------------------------------

test('a result is visible to its owner and teachers, but not other students', async () => {
  const ownerToken = await asGuest('Owner');
  const cat = await categoryWithQuestions(ownerToken);

  const served = await api(`/api/quiz/${cat._id}/questions`, { token: ownerToken });
  const questionIds = served.body.questions.map((q) => q._id);
  const submit = await api('/api/quiz/submit', {
    method: 'POST',
    token: ownerToken,
    body: { categoryId: cat._id, questionIds, answers: [], timeTakenSeconds: 5 },
  });
  const id = submit.body.result._id;

  const asOwner = await api(`/api/results/${id}`, { token: ownerToken });
  assert.equal(asOwner.status, 200);

  const otherToken = await asGuest('Nosy');
  const asOther = await api(`/api/results/${id}`, { token: otherToken });
  assert.equal(asOther.status, 403, 'another student must not read it');

  const teacherToken = await asTeacher();
  const asTeacherRes = await api(`/api/results/${id}`, { token: teacherToken });
  assert.equal(asTeacherRes.status, 200, 'a teacher may read any result');
});

test('leaderboard returns each user at most once, capped and ranked', async () => {
  const token = await asStudent();
  const lb = await api('/api/results/leaderboard', { token });
  assert.equal(lb.status, 200);
  assert.ok(Array.isArray(lb.body.leaderboard));
  assert.ok(lb.body.leaderboard.length <= 25);

  const ids = lb.body.leaderboard.map((e) => String(e._id));
  assert.equal(ids.length, new Set(ids).size, 'each user appears once (their best)');

  // Ranked by percentage descending.
  for (let i = 1; i < lb.body.leaderboard.length; i += 1) {
    assert.ok(lb.body.leaderboard[i - 1].percentage >= lb.body.leaderboard[i].percentage);
  }
});

test('the "all results" listing is teacher-only', async () => {
  const studentToken = await asStudent();
  const denied = await api('/api/results', { token: studentToken });
  assert.equal(denied.status, 403);

  const teacherToken = await asTeacher();
  const ok = await api('/api/results', { token: teacherToken });
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body.results));
});

// ---------------------------------------------------------------------------
// Teacher-only CRUD: role enforcement + input validation.
// ---------------------------------------------------------------------------

test('question creation is teacher-only and validates its input', async () => {
  const studentToken = await asStudent();
  const teacherToken = await asTeacher();
  const cat = await categoryWithQuestions(teacherToken);

  const denied = await api('/api/questions', {
    method: 'POST',
    token: studentToken,
    body: { categoryId: cat._id, type: 'free-text', text: 'x', correctAnswer: 'y' },
  });
  assert.equal(denied.status, 403, 'students cannot create questions');

  const missing = await api('/api/questions', {
    method: 'POST',
    token: teacherToken,
    body: { categoryId: cat._id, type: 'free-text', text: 'Missing the answer' },
  });
  assert.equal(missing.status, 400);

  const badType = await api('/api/questions', {
    method: 'POST',
    token: teacherToken,
    body: { categoryId: cat._id, type: 'essay', text: 'q', correctAnswer: 'a' },
  });
  assert.equal(badType.status, 400);

  const tooFewOptions = await api('/api/questions', {
    method: 'POST',
    token: teacherToken,
    body: { categoryId: cat._id, type: 'mcq', text: 'q', options: ['only-one'], correctAnswer: 'only-one' },
  });
  assert.equal(tooFewOptions.status, 400);

  const answerNotAnOption = await api('/api/questions', {
    method: 'POST',
    token: teacherToken,
    body: { categoryId: cat._id, type: 'mcq', text: 'q', options: ['A', 'B'], correctAnswer: 'C' },
  });
  assert.equal(answerNotAnOption.status, 400);

  // A valid create, then clean up after ourselves.
  const created = await api('/api/questions', {
    method: 'POST',
    token: teacherToken,
    body: { categoryId: cat._id, type: 'mcq', text: 'Valid?', options: ['A', 'B'], correctAnswer: 'A' },
  });
  assert.equal(created.status, 201);
  const del = await api(`/api/questions/${created.body.question._id}`, { method: 'DELETE', token: teacherToken });
  assert.equal(del.status, 200);
});

test('category creation is teacher-only and rejects duplicates', async () => {
  const studentToken = await asStudent();
  const teacherToken = await asTeacher();

  const denied = await api('/api/categories', {
    method: 'POST',
    token: studentToken,
    body: { name: 'Sneaky Category' },
  });
  assert.equal(denied.status, 403);

  const existing = await categoryWithQuestions(teacherToken);
  const dup = await api('/api/categories', {
    method: 'POST',
    token: teacherToken,
    body: { name: existing.name },
  });
  assert.equal(dup.status, 409);

  const created = await api('/api/categories', {
    method: 'POST',
    token: teacherToken,
    body: { name: `Temp Category ${Date.now()}`, passPercentage: 70 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.category.passPercentage, 70);
  const del = await api(`/api/categories/${created.body.category._id}`, { method: 'DELETE', token: teacherToken });
  assert.equal(del.status, 200);
});

// ---------------------------------------------------------------------------
// Grading service unit tests (pure functions — the fail-closed contract).
// ---------------------------------------------------------------------------

test('grading helpers: normalize + isExactMatch are case/whitespace-insensitive', () => {
  assert.equal(normalize('  Router  '), 'router');
  assert.equal(normalize(null), '');
  assert.equal(isExactMatch(' TCP ', 'tcp'), true);
  assert.equal(isExactMatch('udp', 'tcp'), false);
  assert.equal(isExactMatch('anything', ''), false, 'an empty key never matches');
  assert.equal(isExactMatch('', ''), false);
});

test('gradeFreeText: exact wins, blank is never rescued, and AI is fail-closed when off', async () => {
  delete process.env.ANTHROPIC_API_KEY; // belt-and-suspenders

  const exact = await gradeFreeText({ questionText: 'q', correctAnswer: 'DHCP', userAnswer: ' dhcp ' });
  assert.deepEqual(exact, { isCorrect: true, gradedBy: 'exact', aiReason: '' });

  const blank = await gradeFreeText({ questionText: 'q', correctAnswer: 'DHCP', userAnswer: '   ' });
  assert.equal(blank.isCorrect, false);

  // Non-matching + no API key → must fail closed to "wrong", never throw.
  const wrong = await gradeFreeText({ questionText: 'q', correctAnswer: 'DHCP', userAnswer: 'a router thing' });
  assert.equal(wrong.isCorrect, false);
  assert.equal(wrong.gradedBy, 'exact');
});
