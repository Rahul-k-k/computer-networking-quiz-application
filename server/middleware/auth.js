const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getSecret() {
  return process.env.JWT_SECRET || 'insecure-dev-secret';
}

/** Sign a short JWT carrying the user id and role. */
function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, getSecret(), {
    expiresIn: '7d',
  });
}

/**
 * Require a valid Bearer token. Loads the user (without the password hash) and
 * attaches it as req.user. Responds 401 on any problem.
 */
async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = jwt.verify(token, getSecret());
    // Password is select:false, so this can never carry the hash.
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/** Require the authenticated user to have one of the given roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

module.exports = { signToken, authRequired, requireRole };
