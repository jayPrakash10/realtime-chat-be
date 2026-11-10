const asyncHandler = require('../utils/asyncHandler');
const conversationService = require('../services/conversation.service');
const { sendSuccess, sendPage, sendNoContent } = require('../utils/response');

const startConversation = asyncHandler(async (req, res) => {
  const { conversation, created } = await conversationService.startConversation(
    req.user._id,
    req.body.participantId,
  );
  sendSuccess(res, created ? 201 : 200, conversation);
});

const listConversations = asyncHandler(async (req, res) => {
  sendPage(res, await conversationService.listConversations(req.user._id, req.query));
});

const getConversation = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await conversationService.getConversationView(req.params.id, req.user._id));
});

const markAsRead = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await conversationService.markAsRead(req.params.id, req.user._id));
});

const hideConversation = asyncHandler(async (req, res) => {
  await conversationService.hideConversation(req.params.id, req.user._id);
  sendNoContent(res);
});

module.exports = { startConversation, listConversations, getConversation, markAsRead, hideConversation };
