const mongoose = require('mongoose');
const { ROLES, USER_LIMITS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: USER_LIMITS.NAME_MAX_LENGTH,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: USER_LIMITS.USERNAME_MIN_LENGTH,
      maxlength: USER_LIMITS.USERNAME_MAX_LENGTH,
      match: USER_LIMITS.USERNAME_PATTERN,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never loaded unless a query explicitly asks for it
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: USER_LIMITS.BIO_MAX_LENGTH,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model('User', userSchema);
