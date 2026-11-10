const asyncHandler = require('../utils/asyncHandler');
const messageService = require('../services/message.service');
const { sendSuccess, sendPage, sendNoContent } = require('../utils/response');

const listMessages = asyncHandler(async (req, res) => {
  sendPage(res, await messageService.listMessages(req.params.id, req.user._id, req.query));
});

const sendMessage = asyncHandler(async (req, res) => {
  const message = await messageService.sendMessage({
    conversationId: req.params.id,
    senderId: req.user._id,
    text: req.body.text,
    file: req.file,
  });
  sendSuccess(res, 201, message);
});

const deleteMessage = asyncHandler(async (req, res) => {
  await messageService.deleteMessage(req.params.id, req.user._id, req.query.scope);
  sendNoContent(res);
});

module.exports = { listMessages, sendMessage, deleteMessage };
