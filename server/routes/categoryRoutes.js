const express = require('express');
const Category = require('../models/Category');
const Question = require('../models/Question');
const { authRequired, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/** GET /api/categories — list all categories (any signed-in user). */
router.get(
  '/',
  authRequired,
  asyncHandler(async (_req, res) => {
    const categories = await Category.find().sort({ name: 1 }).lean();

    // One aggregate for every category's per-difficulty question counts, so the
    // student difficulty picker knows which levels are actually playable.
    const rows = await Question.aggregate([
      { $group: { _id: { categoryId: '$categoryId', difficulty: '$difficulty' }, n: { $sum: 1 } } },
    ]);
    const byCat = new Map();
    for (const row of rows) {
      const cid = String(row._id.categoryId);
      const level = ['low', 'medium', 'high'].includes(row._id.difficulty) ? row._id.difficulty : 'medium';
      const entry = byCat.get(cid) || { low: 0, medium: 0, high: 0, total: 0 };
      entry[level] += row.n;
      entry.total += row.n;
      byCat.set(cid, entry);
    }

    const withCounts = categories.map((c) => {
      const dc = byCat.get(String(c._id)) || { low: 0, medium: 0, high: 0, total: 0 };
      return {
        ...c,
        questionCount: dc.total,
        difficultyCounts: { low: dc.low, medium: dc.medium, high: dc.high },
      };
    });
    res.json({ categories: withCounts });
  })
);

/** POST /api/categories — create (teacher). */
router.post(
  '/',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const { name, description, durationMinutes, passPercentage } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const exists = await Category.findOne({ name: String(name).trim() }).select('_id').lean();
    if (exists) {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    const category = await Category.create({ name: String(name).trim(), description, durationMinutes, passPercentage });
    res.status(201).json({ category });
  })
);

/** PUT /api/categories/:id — update (teacher). */
router.put(
  '/:id',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const { name, description, durationMinutes, passPercentage } = req.body || {};
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description, durationMinutes, passPercentage },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    res.json({ category });
  })
);

/** DELETE /api/categories/:id — delete category and its questions (teacher). */
router.delete(
  '/:id',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    await Question.deleteMany({ categoryId: category._id });
    res.json({ ok: true });
  })
);

module.exports = router;
