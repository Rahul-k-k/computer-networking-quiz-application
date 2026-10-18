const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const questionRoutes = require('./routes/questionRoutes');
const quizRoutes = require('./routes/quizRoutes');
const resultRoutes = require('./routes/resultRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

/**
 * Build and configure the Express app WITHOUT touching the database or opening
 * a socket. This is what tests import directly (they manage their own DB and
 * an ephemeral port); server.js wires it up for real.
 *
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Serve uploaded question images.
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'speednet-arena', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api/uploads', uploadRoutes);

  // Unknown API route.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Central error handler. Keep messages clean; log the detail server-side.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
    // A malformed ObjectId — a bad ":id" in the URL, or an unusable value in a
    // query filter — must be a clean 400, never a 500 that leaks the raw
    // "Cast to ObjectId failed for value ..." Mongoose message to the client.
    if (err && err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    // Schema validation failures (e.g. an update that runs validators, or a bad
    // enum value) are the caller's fault → 400 with the field messages.
    if (err && err.name === 'ValidationError') {
      const msg =
        Object.values(err.errors || {})
          .map((e) => e.message)
          .join(' ') || 'Validation failed.';
      return res.status(400).json({ error: msg });
    }
    // Duplicate key (e.g. unique email/category) surfaced as a clean 409.
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That value already exists.' });
    }
    console.error('[error]', err && err.stack ? err.stack : err);
    const status = err && err.status ? err.status : 500;
    res.status(status).json({ error: err && err.message ? err.message : 'Server error.' });
  });

  return app;
}

module.exports = { createApp };
