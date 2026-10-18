// DB-INDEPENDENT regression tests. These never touch MongoDB — they guard the
// module wiring and, specifically, the seed naming trap that once took prod
// down: a `seed/` directory sibling to `seed.js` makes `require('./seed')`
// resolve to the FILE, shadowing the directory.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..');

test('require("../seeder") resolves to the seeder/ directory index, not a file', () => {
  const resolved = require.resolve('../seeder');
  assert.ok(
    resolved.endsWith(path.join('seeder', 'index.js')),
    `expected .../seeder/index.js but got ${resolved}`
  );
});

test('the seeder module exports the expected functions', () => {
  const seeder = require('../seeder');
  assert.equal(typeof seeder.runSeed, 'function', 'runSeed must be a function');
  assert.equal(typeof seeder.isSeeded, 'function', 'isSeeded must be a function');
});

test('there is NO seed/ directory colliding with seed.js', () => {
  const seedDir = path.join(SERVER_ROOT, 'seed');
  const collision = fs.existsSync(seedDir) && fs.statSync(seedDir).isDirectory();
  assert.equal(
    collision,
    false,
    'A seed/ directory next to seed.js would shadow require("./seed") and reintroduce the boot bug. Use seeder/.'
  );
});

test('seed.js exists and the seeder/ directory exists', () => {
  assert.ok(fs.existsSync(path.join(SERVER_ROOT, 'seed.js')), 'seed.js CLI should exist');
  assert.ok(
    fs.statSync(path.join(SERVER_ROOT, 'seeder')).isDirectory(),
    'seeder/ directory should exist'
  );
});

test('requiring the seed CLI does NOT execute it (guarded by require.main)', () => {
  // If the guard were missing, requiring this would try to connect+reset the DB.
  // It returns synchronously with just the exported main function instead.
  const cli = require('../seed');
  assert.equal(typeof cli.main, 'function', 'seed.js should export main without running it');
});
