const Joi = require('joi');
const { USER_LIMITS } = require('../config/constants');

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(USER_LIMITS.NAME_MAX_LENGTH).required(),
    username: Joi.string()
      .trim()
      .lowercase()
      .min(USER_LIMITS.USERNAME_MIN_LENGTH)
      .max(USER_LIMITS.USERNAME_MAX_LENGTH)
      .pattern(USER_LIMITS.USERNAME_PATTERN)
      .required()
      .messages({ 'string.pattern.base': 'username may only contain letters, numbers, "_" and "."' }),
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(USER_LIMITS.PASSWORD_MIN_LENGTH).max(USER_LIMITS.PASSWORD_MAX_LENGTH).required(),
  }),
};

const login = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().required(),
  }),
};

module.exports = { register, login };
