const express = require('express');
const conversationController = require('../controllers/conversation.controller');
const messageController = require('../controllers/message.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { uploadSingleImage } = require('../middleware/upload');
const conversationValidator = require('../validators/conversation.validator');
const messageValidator = require('../validators/message.validator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Conversations
 *     description: Direct chats between two users
 *   - name: Messages
 *     description: Text and image messages inside a conversation
 */

/**
 * @openapi
 * /conversations:
 *   post:
 *     tags: [Conversations]
 *     summary: Start a chat with a user, or return the existing one
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantId]
 *             properties:
 *               participantId: { type: string, example: 665f1c2a9b1e8a3d4c5b6a71 }
 *     responses:
 *       201: { description: New conversation created }
 *       200: { description: Existing conversation returned }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   get:
 *     tags: [Conversations]
 *     summary: My chats, most recent activity first
 *     parameters:
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/Limit' }
 *       - { in: query, name: unread, schema: { type: boolean }, description: Only chats with unread messages }
 *     responses:
 *       200:
 *         description: Paginated conversations with unread counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Conversation' } }
 *                 meta: { $ref: '#/components/schemas/PageMeta' }
 */
router.post('/', validate(conversationValidator.startConversation), conversationController.startConversation);
router.get('/', validate(conversationValidator.listConversations), conversationController.listConversations);

/**
 * @openapi
 * /conversations/{id}:
 *   get:
 *     tags: [Conversations]
 *     summary: Get one conversation (participants only)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     responses:
 *       200: { description: Conversation }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Conversations]
 *     summary: Delete the chat for me (hides it and clears my history; the other user is unaffected)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     responses:
 *       204: { description: Conversation hidden }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(conversationValidator.conversationById), conversationController.getConversation);
router.delete('/:id', validate(conversationValidator.conversationById), conversationController.hideConversation);

/**
 * @openapi
 * /conversations/{id}/read:
 *   patch:
 *     tags: [Conversations]
 *     summary: Mark the conversation as read (resets unread count, triggers read receipts)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     responses:
 *       200: { description: New lastReadAt }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/read', validate(conversationValidator.conversationById), conversationController.markAsRead);

/**
 * @openapi
 * /conversations/{id}/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Message history, newest first (cursor pagination)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *       - { in: query, name: before, schema: { type: string }, description: Pass meta.nextCursor to load older messages }
 *       - { in: query, name: limit, schema: { type: integer, default: 30, maximum: 100 } }
 *       - { in: query, name: type, schema: { type: string, enum: [text, image] } }
 *       - { in: query, name: q, schema: { type: string }, description: Keyword search in message text }
 *     responses:
 *       200:
 *         description: Messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Message' } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     limit: { type: integer }
 *                     hasMore: { type: boolean }
 *                     nextCursor: { type: string, nullable: true }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   post:
 *     tags: [Messages]
 *     summary: Send a text message, or an image with an optional caption
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, maxLength: 2000, example: Hey! How are you? }
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *               text: { type: string, description: Optional caption }
 *     responses:
 *       201:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Message' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       413: { description: Image too large }
 */
router.get('/:id/messages', validate(messageValidator.listMessages), messageController.listMessages);
// Multer runs first so that multipart text fields are in req.body before validation.
router.post(
  '/:id/messages',
  uploadSingleImage('image'),
  validate(messageValidator.sendMessage),
  messageController.sendMessage,
);

module.exports = router;
