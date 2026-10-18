// CLI: reset and reseed the database (`npm run seed`).
//
// ⚠️ This performs a DESTRUCTIVE reset. It is guarded by `require.main === module`
// so that merely `require()`-ing this file (e.g. from a test) NEVER wipes data —
// only running it directly does. The seed-data directory is named `seeder/`
// (NOT `seed/`) so `require('./seeder')` can never be shadowed by this file.

require('dotenv').config();

const { connectDB, disconnect } = require('./config/db');
const { runSeed } = require('./seeder');

async function main() {
  const conn = await connectDB();
  if (conn.inMemory) {
    console.warn(
      '[seed] WARNING: connected to an in-memory MongoDB — seeded data will vanish ' +
        'when this process exits. Point MONGODB_URI at a real MongoDB to persist it.'
    );
  }
  const summary = await runSeed({ force: true });
  console.log('[seed] Reset complete:', summary);
  await disconnect();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] Failed:', err && err.message ? err.message : err);
      process.exit(1);
    });
}

module.exports = { main };
