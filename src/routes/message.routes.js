const express = require('express');
const messageController = require('../controllers/message.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const messageValidator = require('../validators/message.validator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /messages/{id}:
 *   delete:
 *     tags: [Messages]
 *     summary: Delete a message for me, or for everyone (sender only, within 15 minutes)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *       - { in: query, name: scope, schema: { type: string, enum: [me, everyone], default: me } }
 *     responses:
 *       204: { description: Message deleted }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.delete('/:id', validate(messageValidator.deleteMessage), messageController.deleteMessage);

module.exports = router;
