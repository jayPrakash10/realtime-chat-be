const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');
const blockService = require('../services/block.service');
const { sendSuccess, sendPage, sendNoContent } = require('../utils/response');

const searchUsers = asyncHandler(async (req, res) => {
  sendPage(res, await userService.searchUsers(req.user._id, req.query));
});

const getUser = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await userService.getPublicProfile(req.params.id));
});

const updateProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await userService.updateProfile(req.user._id, req.body));
});

const updateAvatar = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await userService.updateAvatar(req.user, req.file));
});

const listBlockedUsers = asyncHandler(async (req, res) => {
  sendPage(res, await blockService.listBlockedUsers(req.user._id, req.query));
});

const blockUser = asyncHandler(async (req, res) => {
  sendSuccess(res, 201, await blockService.blockUser(req.user._id, req.params.id));
});

const unblockUser = asyncHandler(async (req, res) => {
  await blockService.unblockUser(req.user._id, req.params.id);
  sendNoContent(res);
});

module.exports = {
  searchUsers,
  getUser,
  updateProfile,
  updateAvatar,
  listBlockedUsers,
  blockUser,
  unblockUser,
};
