const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'free-text'],
      required: true,
    },
    text: { type: String, required: true },
    // For MCQ only. Ignored for free-text.
    options: { type: [String], default: [] },
    // MCQ: the exact correct option string.
    // free-text: the expected answer (graded exact-first, AI-rescue optional).
    correctAnswer: { type: String, required: true },
    explanation: { type: String, default: '' },
    // Optional illustration (e.g. "identify this hardware"). Either a
    // server-relative upload path (/uploads/..) or an inline SVG data URI.
    imageUrl: { type: String, default: '' },
    // Difficulty tier. Students choose a level when starting a quiz and are
    // served matching questions; AI-generated questions are tagged on creation.
    difficulty: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
