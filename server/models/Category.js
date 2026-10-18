const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    // Minutes allotted for the whole quiz; the client derives the overall
    // timer from this. Per-question time is derived client-side.
    durationMinutes: { type: Number, default: 10 },
    // Passing threshold as a percentage.
    passPercentage: { type: Number, default: 60 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
