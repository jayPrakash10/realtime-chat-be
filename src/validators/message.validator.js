const Joi = require('joi');
const { MESSAGE_LIMITS, MESSAGE_TYPES, DELETE_SCOPES, PAGINATION, USER_LIMITS } = require('../config/constants');
const { objectId, idParams } = require('./common.validator');

const listMessages = {
  params: idParams,
  query: Joi.object({
    before: objectId,
    limit: Joi.number()
      .integer()
      .min(1)
      .max(PAGINATION.MESSAGES_MAX_LIMIT)
      .default(PAGINATION.MESSAGES_DEFAULT_LIMIT),
    type: Joi.string().valid(...Object.values(MESSAGE_TYPES)),
    q: Joi.string().trim().max(USER_LIMITS.SEARCH_MAX_LENGTH).allow(''),
  }),
};

// The image itself is checked by the upload middleware; "text or image is required" is checked in the service
// because only the service sees both the body and the file.
const sendMessage = {
  params: idParams,
  body: Joi.object({
    text: Joi.string().trim().max(MESSAGE_LIMITS.MAX_TEXT_LENGTH).allow('').default(''),
  }),
};

const deleteMessage = {
  params: idParams,
  query: Joi.object({
    scope: Joi.string()
      .valid(...Object.values(DELETE_SCOPES))
      .default(DELETE_SCOPES.ME),
  }),
};

module.exports = { listMessages, sendMessage, deleteMessage };
