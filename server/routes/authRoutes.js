const crypto = require('crypto');
const express = require('express');
const User = require('../models/User');
const { signToken, authRequired } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/** POST /api/auth/register — create a normal (persisted) account. */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    const role = req.body?.role === 'teacher' ? 'teacher' : 'student';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() }).select('_id').lean();
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const user = await User.create({ name, email, password, role });
    return res.status(201).json({ token: signToken(user), user: user.toJSON() });
  })
);

/** POST /api/auth/login — email + password. Errors are deliberately generic. */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Re-select the password (it's select:false by default).
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
    // Same response whether the email is unknown or the password is wrong —
    // never leak which field was wrong.
    if (!user || !(await user.comparePassword(String(password)))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({ token: signToken(user), user: user.toJSON() });
  })
);

/**
 * POST /api/auth/guest — free-trial. Creates a BRAND-NEW isolated account each
 * call (never a shared/fixed demo account). The client keeps the returned
 * token in memory only, so a reload ends the trial.
 */
router.post(
  '/guest',
  asyncHandler(async (req, res) => {
    const rawName = String(req.body?.name || '').trim();
    const name = rawName || 'Guest Explorer';

    const user = await User.create({
      name,
      email: `guest-${crypto.randomUUID()}@guest.speednet`,
      password: crypto.randomUUID(), // random; guests never log in again
      role: 'student',
      isGuest: true,
    });

    return res.status(201).json({ token: signToken(user), user: user.toJSON() });
  })
);

/** GET /api/auth/me — the current user. Never includes the password hash. */
router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json({ user: req.user.toJSON() });
  })
);

module.exports = router;
