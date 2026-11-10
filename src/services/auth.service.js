const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { signAccessToken, verifyAccessToken } = require('../utils/token');
const { SECURITY } = require('../config/constants');

const BANNED_MESSAGE = 'Your account has been banned';

async function assertEmailAndUsernameAvailable(email, username) {
  const existing = await User.findOne({ $or: [{ email }, { username }] })
    .select('email username')
    .lean();

  if (existing) {
    const takenField = existing.email === email ? 'email' : 'username';
    throw ApiError.conflict(`That ${takenField} is already registered`);
  }
}

async function register({ name, username, email, password }) {
  await assertEmailAndUsernameAvailable(email, username);

  const passwordHash = await bcrypt.hash(password, SECURITY.BCRYPT_SALT_ROUNDS);
  const user = await User.create({ name, username, email, password: passwordHash });

  return { user, token: signAccessToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  const isPasswordValid = user ? await bcrypt.compare(password, user.password) : false;

  // Same message for "no such email" and "wrong password" so attackers cannot discover which emails exist.
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.isBanned) {
    throw ApiError.forbidden(BANNED_MESSAGE);
  }

  return { user, token: signAccessToken(user) };
}

// Used by both the HTTP auth middleware and the Socket.IO handshake.
async function resolveUserFromToken(token) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  // Loading the user on each request means a ban takes effect immediately, not when the token expires.
  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }
  if (user.isBanned) {
    throw ApiError.forbidden(BANNED_MESSAGE);
  }
  return user;
}

module.exports = { register, login, resolveUserFromToken };
