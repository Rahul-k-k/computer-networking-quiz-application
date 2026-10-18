const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { authRequired } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { gradeFreeText, isExactMatch } = require('../services/grading');

const router = express.Router();

// The "All-in-One" mixed challenge: a fixed-length quiz of random questions
// drawn from EVERY category, with one minute allotted per question.
const MIXED = {
  name: 'All-in-One Challenge',
  description: 'A rapid-fire mix of random questions from every category — one minute each.',
  perQuestionSeconds: 60,
  defaultCount: 20,
  maxCount: 50,
  passPercentage: 60,
};

// A single category quiz serves at most this many questions (of the student's
// chosen difficulty). The mixed challenge uses MIXED.defaultCount (20).
const CATEGORY_QUIZ_SIZE = 10;
const DIFFICULTIES = ['low', 'medium', 'high'];

/** Return the difficulty if it's a known level, else null (= no filter). */
function parseDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : null;
}

/** In-place Fisher–Yates shuffle, returning a new array. */
function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Strip a question down to what the client is allowed to see: no correctAnswer,
 * no explanation. MCQ options are shuffled so their position leaks nothing.
 */
function sanitize(q) {
  return {
    _id: q._id,
    type: q.type,
    text: q.text,
    imageUrl: q.imageUrl || '',
    difficulty: q.difficulty || 'medium',
    options: q.type === 'mcq' ? shuffle(q.options) : [],
  };
}

/** Build a { questionId -> answer } lookup from a submitted answers array. */
function mapAnswers(answers) {
  const byQ = new Map();
  for (const a of answers) {
    if (a && a.questionId != null) byQ.set(String(a.questionId), a.answer);
  }
  return byQ;
}

/**
 * Grade a set of questions authoritatively on the server.
 * MCQ is always exact-match; free-text is exact-first with an optional AI rescue
 * (see services/grading). Returns the per-answer log and the raw correct count.
 * @returns {Promise<{ answersLog: object[], score: number }>}
 */
async function gradeAnswers(questions, answerByQ) {
  const answersLog = [];
  let score = 0;

  // Fixed order (small N; free-text may await the AI pass).
  for (const q of questions) {
    const userAnswer = answerByQ.has(String(q._id)) ? String(answerByQ.get(String(q._id)) ?? '') : '';

    let isCorrect = false;
    let gradedBy = 'exact';
    let aiReason = '';

    if (q.type === 'mcq') {
      // MCQ is always exact match — the AI pass never runs here.
      isCorrect = isExactMatch(userAnswer, q.correctAnswer);
    } else {
      const graded = await gradeFreeText({
        questionText: q.text,
        correctAnswer: q.correctAnswer,
        userAnswer,
      });
      isCorrect = graded.isCorrect;
      gradedBy = graded.gradedBy;
      aiReason = graded.aiReason;
    }

    if (isCorrect) score += 1;

    answersLog.push({
      questionId: q._id,
      questionText: q.text,
      questionType: q.type,
      imageUrl: q.imageUrl || '',
      userAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation || '',
      gradedBy,
      aiReason,
    });
  }

  return { answersLog, score };
}

/**
 * GET /api/quiz/mixed/questions?count=20
 * Returns a random sample of questions drawn from EVERY category, sanitized.
 *
 * NOTE: this literal route MUST be declared before "/:categoryId/questions",
 * otherwise Express would match it with categoryId === "mixed".
 */
router.get(
  '/mixed/questions',
  authRequired,
  asyncHandler(async (req, res) => {
    const requested = Number.parseInt(req.query.count, 10);
    const wanted = Number.isFinite(requested)
      ? Math.min(MIXED.maxCount, Math.max(1, requested))
      : MIXED.defaultCount;
    const difficulty = parseDifficulty(req.query.difficulty);
    const match = difficulty ? { difficulty } : {};

    const available = await Question.countDocuments(match);
    if (available === 0) {
      return res.status(400).json({
        error: difficulty
          ? `No ${difficulty}-difficulty questions are available yet.`
          : 'No questions are available yet.',
      });
    }

    const size = Math.min(wanted, available);
    // $sample gives a uniform random subset in a single round-trip.
    const pipeline = difficulty ? [{ $match: match }, { $sample: { size } }] : [{ $sample: { size } }];
    const sampled = await Question.aggregate(pipeline);

    res.json({
      challenge: {
        name: MIXED.name,
        description: MIXED.description,
        perQuestionSeconds: MIXED.perQuestionSeconds,
        passPercentage: MIXED.passPercentage,
        count: sampled.length,
        difficulty: difficulty || 'mixed',
      },
      questions: sampled.map(sanitize),
    });
  })
);

/**
 * POST /api/quiz/mixed/submit
 * Body: { questionIds:[...], answers:[{questionId, answer}], timeTakenSeconds,
 *         tabViolations, exitedFullscreen, autoSubmitted }
 * Grades exactly the questions the student was served (looked up by id) and
 * persists a category-less Result labelled as the All-in-One challenge.
 */
router.post(
  '/mixed/submit',
  authRequired,
  asyncHandler(async (req, res) => {
    const {
      questionIds,
      answers = [],
      timeTakenSeconds = 0,
      tabViolations = 0,
      exitedFullscreen = false,
      autoSubmitted = false,
    } = req.body || {};

    // Prefer the explicit served-set; fall back to the ids present in answers.
    const rawIds =
      Array.isArray(questionIds) && questionIds.length ? questionIds : answers.map((a) => a && a.questionId);
    // Unique, defined, valid ObjectIds only (bad ids would otherwise throw on cast).
    const ids = [...new Set(rawIds.filter((x) => x != null).map(String))].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No questions were submitted.' });
    }

    const found = await Question.find({ _id: { $in: ids } }).lean();
    if (found.length === 0) {
      return res.status(400).json({ error: 'None of the submitted questions could be found.' });
    }

    // Grade in the order the student saw them, ignoring any unknown ids.
    const byId = new Map(found.map((q) => [String(q._id), q]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    const { answersLog, score } = await gradeAnswers(ordered, mapAnswers(answers));
    const totalQuestions = ordered.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const result = await Result.create({
      userId: req.user._id,
      studentName: req.user.name,
      // No categoryId — this attempt spans every category.
      categoryName: MIXED.name,
      score,
      totalQuestions,
      percentage,
      timeTakenSeconds,
      tabViolations,
      exitedFullscreen,
      autoSubmitted,
      answersLog,
    });

    res.status(201).json({ result, passPercentage: MIXED.passPercentage });
  })
);

/**
 * GET /api/quiz/:categoryId/questions
 * Returns questions in random order, with MCQ options shuffled, and with all
 * answer/explanation fields STRIPPED so the client can't reveal answers early.
 */
router.get(
  '/:categoryId/questions',
  authRequired,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.categoryId).lean();
    if (!category) return res.status(404).json({ error: 'Category not found.' });

    const difficulty = parseDifficulty(req.query.difficulty);
    const filter = { categoryId: category._id };
    if (difficulty) filter.difficulty = difficulty;

    const questions = await Question.find(filter).lean();
    if (questions.length === 0) {
      return res.status(400).json({
        error: difficulty
          ? `This category has no ${difficulty}-difficulty questions yet.`
          : 'This category has no questions yet.',
      });
    }

    // Serve a random subset of at most CATEGORY_QUIZ_SIZE (10) questions.
    const sanitized = shuffle(questions).slice(0, CATEGORY_QUIZ_SIZE).map(sanitize);

    res.json({
      category: {
        _id: category._id,
        name: category.name,
        description: category.description,
        durationMinutes: category.durationMinutes,
        passPercentage: category.passPercentage,
      },
      questions: sanitized,
    });
  })
);

/**
 * POST /api/quiz/submit
 * Body: { categoryId, answers:[{questionId, answer}], timeTakenSeconds,
 *         tabViolations, exitedFullscreen, autoSubmitted }
 * Grades authoritatively on the server and persists a Result.
 */
router.post(
  '/submit',
  authRequired,
  asyncHandler(async (req, res) => {
    const {
      categoryId,
      questionIds,
      answers = [],
      timeTakenSeconds = 0,
      tabViolations = 0,
      exitedFullscreen = false,
      autoSubmitted = false,
    } = req.body || {};

    const category = await Category.findById(categoryId).lean();
    if (!category) return res.status(404).json({ error: 'Category not found.' });

    // Grade exactly the questions the student was served — a random subset of
    // their chosen difficulty — identified by the served ids (or, as a
    // fallback, the ids present in the answers). NOT every question in the
    // category, which would wrongly inflate the denominator.
    const rawIds =
      Array.isArray(questionIds) && questionIds.length ? questionIds : answers.map((a) => a && a.questionId);
    const ids = [...new Set(rawIds.filter((x) => x != null).map(String))].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No questions were submitted.' });
    }

    // Constrain to this category so a client can't smuggle in foreign ids.
    const found = await Question.find({ _id: { $in: ids }, categoryId: category._id }).lean();
    if (found.length === 0) {
      return res.status(400).json({ error: 'None of the submitted questions could be found.' });
    }

    const byId = new Map(found.map((q) => [String(q._id), q]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    const { answersLog, score } = await gradeAnswers(ordered, mapAnswers(answers));

    const totalQuestions = ordered.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const result = await Result.create({
      userId: req.user._id,
      studentName: req.user.name, // actual logged-in / guest name
      categoryId: category._id,
      categoryName: category.name,
      score,
      totalQuestions,
      percentage,
      timeTakenSeconds,
      tabViolations,
      exitedFullscreen,
      autoSubmitted,
      answersLog,
    });

    res.status(201).json({ result, passPercentage: category.passPercentage });
  })
);

module.exports = router;
