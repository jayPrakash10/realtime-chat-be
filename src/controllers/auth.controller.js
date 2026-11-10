const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, 201, result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, 200, result);
});

const getMe = (req, res) => {
  sendSuccess(res, 200, req.user);
};

module.exports = { register, login, getMe };
