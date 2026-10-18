require('dotenv').config();

const { connectDB, disconnect } = require('./config/db');
const { createApp } = require('./app');
const { runSeed } = require('./seeder/index.js');

async function startServer() {
  const conn = await connectDB();
  console.log(`[db] Connected (${conn.inMemory ? 'in-memory' : 'configured MongoDB'}).`);

  // Boot-time auto-seed. Idempotent: a no-op if data already exists.
  const seedResult = await runSeed();
  if (seedResult.skipped) {
    console.log('[seed] Existing data found — skipping auto-seed.');
  } else {
    console.log(
      `[seed] Seeded ${seedResult.users} users, ${seedResult.categories} categories, ${seedResult.questions} questions.`
    );
  }

  const app = createApp();
  const port = process.env.PORT || 5000;

  const server = app.listen(port, () => {
    console.log(`\n🏟️  SpeedNet Arena API listening on http://localhost:${port}`);
    console.log(`    Health check: http://localhost:${port}/api/health\n`);
  });

  // listen() reports failures via an 'error' event, not the promise chain —
  // handle them here so a busy port produces a clear message, not a crash.
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n[fatal] Port ${port} is already in use.`);
      console.error('        Another process (perhaps a previous server) is holding it.');
      console.error('        Stop that process, or start with a different PORT, then retry.\n');
    } else {
      console.error('[fatal] Server error:', err && err.message ? err.message : err);
    }
    process.exit(1);
  });

  // Graceful shutdown.
  const shutdown = async (signal) => {
    console.log(`\n[${signal}] Shutting down...`);
    server.close(async () => {
      await disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

startServer().catch((err) => {
  console.error('\n[fatal] SpeedNet Arena failed to start.');
  console.error(`        ${err && err.message ? err.message : err}`);
  console.error('\nThings to check:');
  console.error('  1. Is a local MongoDB running, or is MONGODB_URI reachable?');
  console.error('  2. If you have no MongoDB, the in-memory fallback needs to');
  console.error('     download a MongoDB binary once — check your network/proxy.');
  console.error('  3. Is another process already using the port (PORT env var)?\n');
  process.exit(1);
});
