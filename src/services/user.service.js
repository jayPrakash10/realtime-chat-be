const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const escapeRegex = require('../utils/escapeRegex');
const { getSkip, buildPageMeta } = require('../utils/pagination');
const storageService = require('./storage.service');
const { isUserOnline } = require('../socket');
const { PRESENCE, PUBLIC_USER_FIELDS, UPLOAD } = require('../config/constants');

async function touchLastSeen(user) {
  const elapsed = Date.now() - user.lastSeenAt.getTime();
  if (elapsed < PRESENCE.LAST_SEEN_UPDATE_INTERVAL_MS) {
    return;
  }
  user.lastSeenAt = new Date();
  await User.updateOne({ _id: user._id }, { lastSeenAt: user.lastSeenAt });
}

function buildSearchFilter(search) {
  if (!search) {
    return {};
  }
  const term = escapeRegex(search);
  return {
    $or: [
      { username: { $regex: `^${term}`, $options: 'i' } },
      { name: { $regex: term, $options: 'i' } },
    ],
  };
}

async function searchUsers(currentUserId, { page, limit, search }) {
  const filter = {
    _id: { $ne: currentUserId },
    isBanned: false,
    ...buildSearchFilter(search),
  };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(PUBLIC_USER_FIELDS)
      .sort({ username: 1 })
      .skip(getSkip(page, limit))
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { items: users, meta: buildPageMeta(page, limit, total) };
}

async function getPublicProfile(userId) {
  const user = await User.findOne({ _id: userId, isBanned: false }).select(PUBLIC_USER_FIELDS).lean();
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return { ...user, isOnline: isUserOnline(user._id) };
}

async function updateProfile(userId, updates) {
  return User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
}

async function updateAvatar(user, file) {
  if (!file) {
    throw ApiError.badRequest('An image file is required in the "avatar" field');
  }

  const avatarUrl = await storageService.saveImage(file, UPLOAD.FOLDERS.AVATARS);
  const updatedUser = await User.findByIdAndUpdate(user._id, { avatarUrl }, { new: true });
  await storageService.deleteFile(user.avatarUrl);

  return updatedUser;
}

module.exports = { touchLastSeen, searchUsers, getPublicProfile, updateProfile, updateAvatar };
