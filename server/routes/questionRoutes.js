const express = require('express');
const Question = require('../models/Question');
const Category = require('../models/Category');
const { authRequired, requireRole } = require('../middleware/auth');
const { uploadPdf } = require('../middleware/uploadPdf');
const { generateQuestionsFromPdf } = require('../services/generation');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// This router is teacher-only management (it exposes correct answers). Students
// fetch answer-stripped questions through the quiz router instead.

const DIFFICULTIES = ['low', 'medium', 'high'];

/**
 * Validate + normalize a single question payload into a document ready for
 * Question.create / insertMany. Returns { doc } on success or { error } with a
 * human message on failure. Shared by the single-create and bulk endpoints so
 * both enforce identical rules (MCQ needs >= 2 options; correctAnswer must be
 * one of them; difficulty, when given, must be a known level).
 */
function buildQuestionDoc(body) {
  const { categoryId, type, text, options, correctAnswer, explanation, imageUrl, difficulty } = body || {};
  if (!categoryId || !type || !text || !correctAnswer) {
    return { error: 'categoryId, type, text and correctAnswer are required.' };
  }
  if (!['mcq', 'free-text'].includes(type)) {
    return { error: 'type must be "mcq" or "free-text".' };
  }
  if (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) {
    return { error: 'difficulty must be low, medium or high.' };
  }

  let opts = [];
  if (type === 'mcq') {
    opts = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (opts.length < 2) {
      return { error: 'MCQ questions need at least two options.' };
    }
    if (!opts.includes(correctAnswer)) {
      return { error: 'correctAnswer must be one of the options.' };
    }
  }

  return {
    doc: {
      categoryId,
      type,
      text,
      options: type === 'mcq' ? opts : [],
      correctAnswer,
      explanation: explanation || '',
      imageUrl: imageUrl || '',
      ...(difficulty !== undefined ? { difficulty } : {}),
    },
  };
}

/** Clamp a requested generation count into a sane range. */
function clampCount(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(30, Math.max(3, n)) : 15;
}

/** GET /api/questions?categoryId=&difficulty= — list questions (teacher). */
router.get(
  '/',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (DIFFICULTIES.includes(req.query.difficulty)) filter.difficulty = req.query.difficulty;
    const questions = await Question.find(filter).sort({ createdAt: 1 }).lean();
    res.json({ questions });
  })
);

/** POST /api/questions — create one (teacher). */
router.post(
  '/',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const { doc, error } = buildQuestionDoc(req.body);
    if (error) return res.status(400).json({ error });

    const category = await Category.findById(doc.categoryId).select('_id').lean();
    if (!category) return res.status(400).json({ error: 'Category does not exist.' });

    const question = await Question.create(doc);
    res.status(201).json({ question });
  })
);

/**
 * POST /api/questions/bulk — create many at once (teacher).
 * Body: { questions: [ ...same shape as single create... ] }.
 * Used to publish the reviewed batch from PDF generation. Validates each item;
 * inserts the valid ones and reports how many were skipped.
 */
router.post(
  '/bulk',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const input = Array.isArray(req.body && req.body.questions) ? req.body.questions : null;
    if (!input || input.length === 0) {
      return res.status(400).json({ error: 'Provide a non-empty "questions" array.' });
    }

    const docs = [];
    let skipped = 0;
    for (const item of input) {
      const { doc } = buildQuestionDoc(item);
      if (doc) docs.push(doc);
      else skipped += 1;
    }
    if (docs.length === 0) {
      return res.status(400).json({ error: 'None of the submitted questions were valid.' });
    }

    // Every valid doc must reference an existing category.
    const categoryIds = [...new Set(docs.map((d) => String(d.categoryId)))];
    const existing = await Category.find({ _id: { $in: categoryIds } }).select('_id').lean();
    const known = new Set(existing.map((c) => String(c._id)));
    const insertable = docs.filter((d) => known.has(String(d.categoryId)));
    skipped += docs.length - insertable.length;
    if (insertable.length === 0) {
      return res.status(400).json({ error: 'Category does not exist.' });
    }

    const created = await Question.insertMany(insertable, { ordered: false });
    res.status(201).json({ created: created.length, skipped, questions: created });
  })
);

/**
 * POST /api/questions/generate — generate MCQ drafts from a PDF (teacher).
 * multipart/form-data: pdf=<file>, categoryId, count?, spread?(balanced|low|medium|high).
 * Returns { questions: [...drafts] } WITHOUT saving — the teacher reviews/edits
 * and then publishes via /bulk. AI is fail-soft for the app as a whole: if no
 * key is set the app still runs and only this endpoint reports it's unavailable.
 */
function pdfUpload(req, res, next) {
  uploadPdf.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'PDF upload failed.' });
    next();
  });
}

router.post(
  '/generate',
  authRequired,
  requireRole('teacher'),
  pdfUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No PDF file was provided.' });

    const { categoryId } = req.body || {};
    const category = await Category.findById(categoryId).lean().catch(() => null);
    if (!category) return res.status(400).json({ error: 'Category does not exist.' });

    const count = clampCount(req.body.count);
    const spread = ['balanced', 'low', 'medium', 'high'].includes(req.body.spread)
      ? req.body.spread
      : 'balanced';
    const pdfBase64 = req.file.buffer.toString('base64');

    let questions;
    try {
      questions = await generateQuestionsFromPdf({
        pdfBase64,
        categoryName: category.name,
        count,
        spread,
      });
    } catch (e) {
      if (e && e.code === 'NO_API_KEY') {
        return res.status(503).json({
          error: 'AI generation isn’t configured on the server. Add ANTHROPIC_API_KEY to enable it.',
        });
      }
      // Timeout / network / upstream API error — keep details server-side.
      console.error('[generate]', e && e.message ? e.message : e);
      return res.status(502).json({ error: 'The AI service could not process this PDF. Please try again.' });
    }

    if (!questions.length) {
      return res.status(422).json({
        error: 'Couldn’t generate questions from this PDF. Try a clearer or text-based document.',
      });
    }

    // Attach the chosen category + type so the review step can publish as-is.
    const drafts = questions.map((q) => ({ ...q, type: 'mcq', categoryId: category._id }));
    res.json({ questions: drafts, categoryName: category.name });
  })
);

/** PUT /api/questions/:id — update (teacher). */
router.put(
  '/:id',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const { type, text, options, correctAnswer, explanation, imageUrl, categoryId, difficulty } = req.body || {};
    const update = { type, text, correctAnswer, explanation, imageUrl, categoryId, difficulty };
    if (type !== undefined) update.options = type === 'mcq' ? options || [] : [];
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const question = await Question.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    res.json({ question });
  })
);

/** DELETE /api/questions/:id — delete (teacher). */
router.delete(
  '/:id',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    res.json({ ok: true });
  })
);

module.exports = router;
