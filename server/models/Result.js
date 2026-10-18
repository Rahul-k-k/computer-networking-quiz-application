const mongoose = require('mongoose');

const answerLogSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    questionText: String,
    questionType: { type: String, enum: ['mcq', 'free-text'] },
    imageUrl: { type: String, default: '' },
    userAnswer: { type: String, default: '' },
    correctAnswer: String,
    isCorrect: { type: Boolean, default: false },
    explanation: { type: String, default: '' },
    // Which grading path decided this answer.
    gradedBy: { type: String, enum: ['exact', 'ai'], default: 'exact' },
    // Short human-readable reason when gradedBy === 'ai'.
    aiReason: { type: String, default: '' },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Denormalized so leaderboards/certificates show the right name even for
    // guest/trial accounts, without a populate.
    studentName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    categoryName: String,
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    timeTakenSeconds: { type: Number, default: 0 },
    // Anti-cheat telemetry captured by the client during the attempt.
    tabViolations: { type: Number, default: 0 },
    exitedFullscreen: { type: Boolean, default: false },
    autoSubmitted: { type: Boolean, default: false },
    answersLog: { type: [answerLogSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Result', resultSchema);
