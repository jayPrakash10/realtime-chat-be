const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const escapeRegex = require('../utils/escapeRegex');
const { getSkip, buildPageMeta } = require('../utils/pagination');
const { disconnectUser } = require('../socket');
const { ROLES } = require('../config/constants');

async function listUsers({ page, limit, isBanned, search }) {
  const filter = {};
  if (isBanned !== undefined) {
    filter.isBanned = isBanned;
  }
  if (search) {
    const term = escapeRegex(search);
    filter.$or = [
      { username: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(getSkip(page, limit)).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return { items: users, meta: buildPageMeta(page, limit, total) };
}

async function setBanStatus(adminId, userId, isBanned) {
  if (String(adminId) === String(userId)) {
    throw ApiError.badRequest('You cannot change your own ban status');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  if (user.role === ROLES.ADMIN) {
    throw ApiError.forbidden('Admins cannot be banned');
  }

  user.isBanned = isBanned;
  await user.save();

  if (isBanned) {
    disconnectUser(user._id);
  }
  return user;
}

module.exports = { listUsers, setBanStatus };
