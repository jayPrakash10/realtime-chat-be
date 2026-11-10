const Block = require('../models/block.model');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { getSkip, buildPageMeta } = require('../utils/pagination');
const { PUBLIC_USER_FIELDS } = require('../config/constants');

// A block works in both directions: neither user can message the other.
async function isBlockedBetween(userIdA, userIdB) {
  const block = await Block.exists({
    $or: [
      { blocker: userIdA, blocked: userIdB },
      { blocker: userIdB, blocked: userIdA },
    ],
  });
  return Boolean(block);
}

async function blockUser(blockerId, blockedId) {
  if (String(blockerId) === String(blockedId)) {
    throw ApiError.badRequest('You cannot block yourself');
  }
  if (!(await User.exists({ _id: blockedId }))) {
    throw ApiError.notFound('User not found');
  }
  if (await Block.exists({ blocker: blockerId, blocked: blockedId })) {
    throw ApiError.conflict('User is already blocked');
  }
  return Block.create({ blocker: blockerId, blocked: blockedId });
}

async function unblockUser(blockerId, blockedId) {
  const result = await Block.deleteOne({ blocker: blockerId, blocked: blockedId });
  if (result.deletedCount === 0) {
    throw ApiError.notFound('User is not blocked');
  }
}

async function listBlockedUsers(blockerId, { page, limit }) {
  const filter = { blocker: blockerId };

  const [blocks, total] = await Promise.all([
    Block.find(filter)
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(limit)
      .populate('blocked', PUBLIC_USER_FIELDS)
      .lean(),
    Block.countDocuments(filter),
  ]);

  const items = blocks.map((block) => ({ user: block.blocked, blockedAt: block.createdAt }));
  return { items, meta: buildPageMeta(page, limit, total) };
}

module.exports = { isBlockedBetween, blockUser, unblockUser, listBlockedUsers };
