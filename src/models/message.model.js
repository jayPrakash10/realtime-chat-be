const mongoose = require('mongoose');
const { MESSAGE_TYPES, MESSAGE_LIMITS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: Object.values(MESSAGE_TYPES),
      required: true,
    },
    // For image messages this is the optional caption.
    text: {
      type: String,
      trim: true,
      maxlength: MESSAGE_LIMITS.MAX_TEXT_LENGTH,
      default: '',
    },
    imageUrl: { type: String, default: null },
    deletedFor: [{ type: ObjectId, ref: 'User' }],
    isDeletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

// Supports "newest messages in a conversation" and cursor pagination by _id.
messageSchema.index({ conversation: 1, _id: -1 });

module.exports = mongoose.model('Message', messageSchema);
