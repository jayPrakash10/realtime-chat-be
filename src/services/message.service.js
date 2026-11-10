const Message = require('../models/message.model');
const ApiError = require('../utils/ApiError');
const escapeRegex = require('../utils/escapeRegex');
const storageService = require('./storage.service');
const conversationService = require('./conversation.service');
const { emitToUser } = require('../socket');
const { MESSAGE_TYPES, MESSAGE_LIMITS, DELETE_SCOPES, UPLOAD, SOCKET_EVENTS } = require('../config/constants');

const MESSAGE_STATUS = Object.freeze({ SENT: 'sent', READ: 'read' });

// "read" = the other person opened the chat after this message was sent.
function withStatus(message, viewerId, otherLastReadAt) {
  if (String(message.sender) !== String(viewerId)) {
    return message;
  }
  const isRead = otherLastReadAt && message.createdAt <= otherLastReadAt;
  return { ...message, status: isRead ? MESSAGE_STATUS.READ : MESSAGE_STATUS.SENT };
}

function toPublicMessage(messageDocument) {
  const { deletedFor, ...message } = messageDocument.toObject();
  return message;
}

async function createMessageWithImage({ conversationId, senderId, text, file }) {
  const imageUrl = file ? await storageService.saveImage(file, UPLOAD.FOLDERS.MESSAGES) : null;
  try {
    return await Message.create({
      conversation: conversationId,
      sender: senderId,
      type: file ? MESSAGE_TYPES.IMAGE : MESSAGE_TYPES.TEXT,
      text,
      imageUrl,
    });
  } catch (error) {
    await storageService.deleteFile(imageUrl);
    throw error;
  }
}

async function sendMessage({ conversationId, senderId, text, file }) {
  if (!text && !file) {
    throw ApiError.badRequest('A message needs text or an image');
  }

  const conversation = await conversationService.getParticipantConversation(conversationId, senderId);
  const recipientId = conversationService.findOtherParticipant(conversation, senderId).user;
  await conversationService.assertCanMessage(senderId, recipientId);

  const messageDocument = await createMessageWithImage({ conversationId: conversation._id, senderId, text, file });
  await conversationService.recordNewMessage(conversation._id, messageDocument);

  const message = toPublicMessage(messageDocument);
  emitToUser(recipientId, SOCKET_EVENTS.MESSAGE_NEW, message);

  return { ...message, status: MESSAGE_STATUS.SENT };
}

function buildHistoryFilter(conversationId, viewer, { before, type, q }) {
  const filter = { conversation: conversationId, deletedFor: { $ne: viewer.user } };
  if (viewer.clearedAt) {
    filter.createdAt = { $gt: viewer.clearedAt };
  }
  if (before) {
    filter._id = { $lt: before };
  }
  if (type) {
    filter.type = type;
  }
  if (q) {
    filter.text = { $regex: escapeRegex(q), $options: 'i' };
  }
  return filter;
}

// Cursor pagination: newest first, then pass `before=<nextCursor>` to load older messages.
// Unlike page numbers, this does not skip or repeat messages when new ones arrive while scrolling.
async function listMessages(conversationId, viewerId, { before, limit, type, q }) {
  const conversation = await conversationService.getParticipantConversation(conversationId, viewerId);
  const viewer = conversationService.findMyParticipant(conversation, viewerId);
  const other = conversationService.findOtherParticipant(conversation, viewerId);

  const filter = buildHistoryFilter(conversation._id, viewer, { before, type, q });
  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1) // fetch one extra to know whether an older page exists
    .select('-deletedFor')
    .lean();

  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit);

  return {
    items: page.map((message) => withStatus(message, viewerId, other.lastReadAt)),
    meta: { limit, hasMore, nextCursor: hasMore ? page[page.length - 1]._id : null },
  };
}

async function deleteForEveryone(message, userId, conversation) {
  if (String(message.sender) !== String(userId)) {
    throw ApiError.forbidden('You can only delete your own messages for everyone');
  }
  if (message.isDeletedForEveryone) {
    throw ApiError.conflict('Message is already deleted');
  }
  if (Date.now() - message.createdAt.getTime() > MESSAGE_LIMITS.DELETE_FOR_EVERYONE_WINDOW_MS) {
    throw ApiError.forbidden(
      `Messages can only be deleted for everyone within ${MESSAGE_LIMITS.DELETE_FOR_EVERYONE_WINDOW_MINUTES} minutes`,
    );
  }

  const imageUrl = message.imageUrl;
  message.isDeletedForEveryone = true;
  message.text = '';
  message.imageUrl = null;
  await message.save();

  await storageService.deleteFile(imageUrl);
  await conversationService.markLastMessageDeleted(conversation._id, message._id);

  const recipientId = conversationService.findOtherParticipant(conversation, userId).user;
  emitToUser(recipientId, SOCKET_EVENTS.MESSAGE_DELETED, {
    conversationId: String(conversation._id),
    messageId: String(message._id),
  });
}

async function deleteMessage(messageId, userId, scope) {
  const message = await Message.findById(messageId);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }
  const conversation = await conversationService.getParticipantConversation(message.conversation, userId);

  if (scope === DELETE_SCOPES.EVERYONE) {
    await deleteForEveryone(message, userId, conversation);
    return;
  }
  await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: userId } });
}

module.exports = { sendMessage, listMessages, deleteMessage };
