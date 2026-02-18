// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  dateCreated: {
    type: Date,
    default: Date.now
  },
  tier: {
    type: String,
    enum: ['free', 'pro'],
    default: 'pro' // default to 'pro' during testing
  },
  subscriptionExpiry: {
    type: Date,
    default: null // null means no expiry (free tier or not yet set)
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

userSchema.methods.validatePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
