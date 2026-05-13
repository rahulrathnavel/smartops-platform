'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name:     { type: String, required: true, trim: true },
    balance:  { type: Number, default: 1000 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);
