const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/admin.service');
const { sendSuccess, sendPage } = require('../utils/response');

const listUsers = asyncHandler(async (req, res) => {
  sendPage(res, await adminService.listUsers(req.query));
});

const setBanStatus = asyncHandler(async (req, res) => {
  const user = await adminService.setBanStatus(req.user._id, req.params.id, req.body.isBanned);
  sendSuccess(res, 200, user);
});

module.exports = { listUsers, setBanStatus };
