const User = require('../models/User');
const Category = require('../models/Category');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { categories, DEMO_TEACHER, DEMO_STUDENT } = require('./data');

/**
 * Has the database already been seeded? We check for a known seeded user so
 * boot-time auto-seed is idempotent — running it repeatedly never duplicates.
 */
async function isSeeded() {
  const existing = await User.findOne({ email: DEMO_TEACHER.email }).select('_id').lean();
  return Boolean(existing);
}

/**
 * Seed the database.
 *
 * - Boot-time auto-seed calls `runSeed()` (no force): it inserts data only if
 *   the DB is empty, and is a no-op otherwise. Safe to call on every boot.
 * - The CLI (`npm run seed`) calls `runSeed({ force: true })`: it wipes the
 *   quiz collections and reinserts a clean data set.
 *
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<object>} summary of what happened
 */
async function dropIfExists(Model) {
  try {
    await Model.collection.drop();
  } catch (err) {
    // 26 = NamespaceNotFound (collection didn't exist yet) — safe to ignore.
    if (err && err.code !== 26) throw err;
  }
}

async function runSeed({ force = false } = {}) {
  if (!force && (await isSeeded())) {
    return { skipped: true, reason: 'already-seeded' };
  }

  if (force) {
    // Drop (not just deleteMany) so stale indexes from an older schema — e.g. a
    // leftover unique `slug` index — are removed too. Then rebuild each model's
    // indexes from the current schema so the collections match exactly.
    for (const Model of [User, Category, Question, Result]) {
      await dropIfExists(Model);
    }
    await Promise.all(
      [User, Category, Question, Result].map((Model) => Model.syncIndexes().catch(() => {}))
    );
  }

  // .create() (not insertMany) so the User pre-save hook hashes passwords.
  await User.create(DEMO_TEACHER);
  await User.create(DEMO_STUDENT);

  let categoryCount = 0;
  let questionCount = 0;
  for (const cat of categories) {
    const category = await Category.create({
      name: cat.name,
      description: cat.description,
      durationMinutes: cat.durationMinutes,
      passPercentage: cat.passPercentage,
    });
    categoryCount += 1;

    const questions = cat.questions.map((q) => ({ ...q, categoryId: category._id }));
    await Question.insertMany(questions);
    questionCount += questions.length;
  }

  return { skipped: false, users: 2, categories: categoryCount, questions: questionCount };
}

module.exports = { runSeed, isSeeded, DEMO_TEACHER, DEMO_STUDENT };
