const Joi = require('joi');
const { USER_LIMITS } = require('../config/constants');
const { idParams, paginationFields, paginationQuery } = require('./common.validator');

const searchUsers = {
  query: Joi.object({
    ...paginationFields,
    search: Joi.string().trim().max(USER_LIMITS.SEARCH_MAX_LENGTH).allow(''),
  }),
};

const getUser = { params: idParams };

const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(USER_LIMITS.NAME_MAX_LENGTH),
    bio: Joi.string().trim().max(USER_LIMITS.BIO_MAX_LENGTH).allow(''),
  })
    .min(1)
    .messages({ 'object.min': 'Provide at least one of: name, bio' }),
};

const listBlocks = { query: paginationQuery };

const blockUser = { params: idParams };

module.exports = { searchUsers, getUser, updateProfile, listBlocks, blockUser };
