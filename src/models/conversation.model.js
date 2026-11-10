const mongoose = require('mongoose');
const { MESSAGE_TYPES } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

// Embedded because a direct chat always has exactly two participants that are always read together.
const participantSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: Date.now },
    // Kept as a counter (instead of counting messages) so the chat list is a single cheap query.
    unreadCount: { type: Number, default: 0, min: 0 },
    // "Delete chat": hides it from the list until a new message arrives...
    isHidden: { type: Boolean, default: false },
    // ...and hides every message older than this date from this participant only.
    clearedAt: { type: Date, default: null },
  },
  { _id: false },
);

const lastMessageSchema = new mongoose.Schema(
  {
    messageId: { type: ObjectId, ref: 'Message', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(MESSAGE_TYPES), required: true },
    text: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [participantSchema],
      validate: {
        validator: (participants) => participants.length === 2,
        message: 'A direct conversation must have exactly two participants',
      },
    },
    // Sorted "userIdA_userIdB" string; the unique index guarantees one conversation per pair of users.
    participantKey: { type: String, required: true, unique: true },
    lastMessage: { type: lastMessageSchema, default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 });

conversationSchema.statics.buildParticipantKey = function buildParticipantKey(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join('_');
};

module.exports = mongoose.model('Conversation', conversationSchema);
