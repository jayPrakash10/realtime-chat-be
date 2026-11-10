const Joi = require('joi');
const { objectId, idParams, paginationFields } = require('./common.validator');

const startConversation = {
  body: Joi.object({
    participantId: objectId.required(),
  }),
};

const listConversations = {
  query: Joi.object({
    ...paginationFields,
    unread: Joi.boolean().default(false),
  }),
};

const conversationById = { params: idParams };

module.exports = { startConversation, listConversations, conversationById };
