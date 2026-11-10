const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');

const BEARER_PREFIX = 'Bearer ';

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith(BEARER_PREFIX)) {
    throw ApiError.unauthorized();
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  const user = await authService.resolveUserFromToken(token);
  await userService.touchLastSeen(user);

  req.user = user;
  next();
});

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
