const Conversation = require('../models/conversation.model');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { getSkip, buildPageMeta } = require('../utils/pagination');
const blockService = require('./block.service');
const { emitToUser, isUserOnline } = require('../socket');
const { PUBLIC_USER_FIELDS, SOCKET_EVENTS, MONGO_DUPLICATE_KEY_CODE } = require('../config/constants');

// Works whether participant.user is a raw ObjectId or a populated user document.
function participantUserId(participant) {
  return String(participant.user._id ?? participant.user);
}

function findMyParticipant(conversation, userId) {
  return conversation.participants.find((participant) => participantUserId(participant) === String(userId));
}

function findOtherParticipant(conversation, userId) {
  return conversation.participants.find((participant) => participantUserId(participant) !== String(userId));
}

// The same message is used for "does not exist" and "not yours" so users cannot probe other people's chats.
async function getParticipantConversation(conversationId, userId) {
  const conversation = await Conversation.findOne({ _id: conversationId, 'participants.user': userId }).lean();
  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }
  return conversation;
}

async function assertCanMessage(senderId, recipientId) {
  const recipient = await User.findById(recipientId).select('isBanned').lean();
  if (!recipient) {
    throw ApiError.notFound('User not found');
  }
  // One generic message for "banned" and "blocked" so nobody learns that they were blocked.
  if (recipient.isBanned || (await blockService.isBlockedBetween(senderId, recipientId))) {
    throw ApiError.forbidden('You cannot message this user');
  }
}

function toConversationView(conversation, viewerId) {
  const mine = findMyParticipant(conversation, viewerId);
  const other = findOtherParticipant(conversation, viewerId);

  const isLastMessageCleared =
    conversation.lastMessage && mine.clearedAt && conversation.lastMessage.createdAt <= mine.clearedAt;

  return {
    _id: conversation._id,
    otherUser: { ...other.user, isOnline: isUserOnline(participantUserId(other)) },
    lastMessage: isLastMessageCleared ? null : conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: mine.unreadCount,
    lastReadAt: mine.lastReadAt,
    otherLastReadAt: other.lastReadAt,
    createdAt: conversation.createdAt,
  };
}

async function getConversationView(conversationId, viewerId) {
  const conversation = await Conversation.findOne({ _id: conversationId, 'participants.user': viewerId })
    .populate('participants.user', PUBLIC_USER_FIELDS)
    .lean();
  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }
  return toConversationView(conversation, viewerId);
}

async function findOrCreateConversation(userIdA, userIdB) {
  const participantKey = Conversation.buildParticipantKey(userIdA, userIdB);
  const existing = await Conversation.findOne({ participantKey });
  if (existing) {
    return { conversation: existing, created: false };
  }

  try {
    const conversation = await Conversation.create({
      participants: [{ user: userIdA }, { user: userIdB }],
      participantKey,
    });
    return { conversation, created: true };
  } catch (error) {
    // Both users clicked "message" at the same moment: the unique index rejected the second insert.
    if (error.code !== MONGO_DUPLICATE_KEY_CODE) {
      throw error;
    }
    return { conversation: await Conversation.findOne({ participantKey }), created: false };
  }
}

async function startConversation(userId, participantId) {
  if (String(userId) === String(participantId)) {
    throw ApiError.badRequest('You cannot start a conversation with yourself');
  }
  await assertCanMessage(userId, participantId);

  const { conversation, created } = await findOrCreateConversation(userId, participantId);

  // Re-opening a chat you previously deleted brings it back into your list (history stays cleared).
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': userId },
    { $set: { 'participants.$.isHidden': false } },
  );

  return { conversation: await getConversationView(conversation._id, userId), created };
}

async function listConversations(userId, { page, limit, unread }) {
  const myParticipantMatch = { user: userId, isHidden: false };
  if (unread) {
    myParticipantMatch.unreadCount = { $gt: 0 };
  }
  const filter = { participants: { $elemMatch: myParticipantMatch } };

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip(getSkip(page, limit))
      .limit(limit)
      .populate('participants.user', PUBLIC_USER_FIELDS)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  const items = conversations.map((conversation) => toConversationView(conversation, userId));
  return { items, meta: buildPageMeta(page, limit, total) };
}

async function markAsRead(conversationId, userId) {
  const conversation = await getParticipantConversation(conversationId, userId);
  const readAt = new Date();

  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': userId },
    { $set: { 'participants.$.lastReadAt': readAt, 'participants.$.unreadCount': 0 } },
  );

  const other = findOtherParticipant(conversation, userId);
  emitToUser(other.user, SOCKET_EVENTS.CONVERSATION_READ, {
    conversationId: String(conversation._id),
    readerId: String(userId),
    readAt,
  });

  return { conversationId: conversation._id, lastReadAt: readAt };
}

// "Delete chat" for one user only: hides it and clears the history they see. The other user is unaffected.
async function hideConversation(conversationId, userId) {
  const conversation = await getParticipantConversation(conversationId, userId);
  const now = new Date();

  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': userId },
    {
      $set: {
        'participants.$.isHidden': true,
        'participants.$.clearedAt': now,
        'participants.$.lastReadAt': now,
        'participants.$.unreadCount': 0,
      },
    },
  );
}

async function recordNewMessage(conversationId, message) {
  const senderId = message.sender;

  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: {
          messageId: message._id,
          sender: senderId,
          type: message.type,
          text: message.text,
          isDeleted: false,
          createdAt: message.createdAt,
        },
        lastMessageAt: message.createdAt,
        // A new message brings a hidden chat back for both users.
        'participants.$[].isHidden': false,
        // Replying means the sender has seen everything before it.
        'participants.$[sender].lastReadAt': message.createdAt,
        'participants.$[sender].unreadCount': 0,
      },
      $inc: { 'participants.$[recipient].unreadCount': 1 },
    },
    { arrayFilters: [{ 'sender.user': senderId }, { 'recipient.user': { $ne: senderId } }] },
  );
}

async function markLastMessageDeleted(conversationId, messageId) {
  await Conversation.updateOne(
    { _id: conversationId, 'lastMessage.messageId': messageId },
    { $set: { 'lastMessage.isDeleted': true, 'lastMessage.text': '' } },
  );
}

module.exports = {
  findMyParticipant,
  findOtherParticipant,
  getParticipantConversation,
  assertCanMessage,
  getConversationView,
  startConversation,
  listConversations,
  markAsRead,
  hideConversation,
  recordNewMessage,
  markLastMessageDeleted,
};
