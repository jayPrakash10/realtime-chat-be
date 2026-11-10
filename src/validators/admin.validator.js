const Joi = require('joi');
const { USER_LIMITS } = require('../config/constants');
const { idParams, paginationFields } = require('./common.validator');

const listUsers = {
  query: Joi.object({
    ...paginationFields,
    isBanned: Joi.boolean(),
    search: Joi.string().trim().max(USER_LIMITS.SEARCH_MAX_LENGTH).allow(''),
  }),
};

const setBanStatus = {
  params: idParams,
  body: Joi.object({
    isBanned: Joi.boolean().required(),
  }),
};

module.exports = { listUsers, setBanStatus };
