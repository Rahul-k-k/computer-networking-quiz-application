const mongoose = require('mongoose');

// Holds a reference to the in-memory server (if we fall back to it) so the
// boot process / tests can stop it cleanly on shutdown.
let memoryServer = null;

/**
 * Connect to MongoDB.
 *
 * Order of preference:
 *   1. The configured MONGODB_URI (a real/local MongoDB).
 *   2. An automatic in-memory MongoDB (mongodb-memory-server) if (1) is
 *      unreachable, so the app still runs on a machine with no MongoDB.
 *
 * If BOTH fail, this throws — server.js turns that into a clean, actionable
 * diagnostic and a non-zero exit rather than an unhandled crash.
 *
 * @returns {Promise<{ uri: string, inMemory: boolean }>}
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/speednet_arena';

  // Keep the server-selection window short so the in-memory fallback kicks in
  // quickly on a machine with no MongoDB, instead of hanging for ~30s.
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    return { uri, inMemory: false };
  } catch (localErr) {
    console.warn(
      `[db] Could not reach MongoDB at ${uri} (${localErr.message}). ` +
        'Falling back to an in-memory MongoDB instance...'
    );
  }

  // Lazy-require so a production deployment that never hits the fallback path
  // doesn't pay the cost of loading it.
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.warn(
    '[db] Using in-memory MongoDB. Data will NOT persist across restarts. ' +
      'Install/point MONGODB_URI at a real MongoDB for durable storage.'
  );
  return { uri: memUri, inMemory: true };
}

/** Disconnect mongoose and stop the in-memory server if one was started. */
async function disconnect() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnect };
