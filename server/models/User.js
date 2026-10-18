const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // `select: false` means the hash is NEVER returned by default queries —
    // /me and friends can't leak it even by accident. Login explicitly
    // re-selects it with .select('+password').
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['student', 'teacher'],
      default: 'student',
    },
    // True for on-the-fly free-trial accounts. Lets us keep guest data
    // isolated and identifiable without a separate collection.
    isGuest: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash the password whenever it is set/changed.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Belt-and-suspenders: even if some code path selects the password, strip it
// from any JSON serialization of a user document.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
