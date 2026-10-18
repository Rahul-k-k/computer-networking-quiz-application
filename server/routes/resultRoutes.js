const express = require('express');
const Result = require('../models/Result');
const { authRequired, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/** GET /api/results/me — the current user's own results, newest first. */
router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const results = await Result.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ results });
  })
);

/**
 * GET /api/results/leaderboard — each user's BEST attempt, ranked.
 * Literal route declared before "/:id" so it isn't captured as an id.
 */
router.get(
  '/leaderboard',
  authRequired,
  asyncHandler(async (_req, res) => {
    const leaderboard = await Result.aggregate([
      { $sort: { percentage: -1, score: -1, timeTakenSeconds: 1 } },
      {
        $group: {
          _id: '$userId',
          studentName: { $first: '$studentName' },
          percentage: { $first: '$percentage' },
          score: { $first: '$score' },
          totalQuestions: { $first: '$totalQuestions' },
          categoryName: { $first: '$categoryName' },
          timeTakenSeconds: { $first: '$timeTakenSeconds' },
          achievedAt: { $first: '$createdAt' },
        },
      },
      { $sort: { percentage: -1, score: -1, timeTakenSeconds: 1 } },
      { $limit: 25 },
    ]);
    res.json({ leaderboard });
  })
);

/** GET /api/results — all results (teacher dashboard). */
router.get(
  '/',
  authRequired,
  requireRole('teacher'),
  asyncHandler(async (_req, res) => {
    const results = await Result.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json({ results });
  })
);

/** GET /api/results/:id — a single result (owner or teacher). */
router.get(
  '/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const result = await Result.findById(req.params.id).lean();
    if (!result) return res.status(404).json({ error: 'Result not found.' });

    const isOwner = String(result.userId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'You cannot view this result.' });
    }
    res.json({ result });
  })
);

module.exports = router;
