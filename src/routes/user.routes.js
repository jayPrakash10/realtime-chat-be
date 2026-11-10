const express = require('express');
const userController = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { uploadSingleImage } = require('../middleware/upload');
const userValidator = require('../validators/user.validator');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: Profiles, search and blocking
 */

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Search users by username (prefix) or name (contains)
 *     parameters:
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/Limit' }
 *       - { in: query, name: search, schema: { type: string, example: ais } }
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/PublicUser' } }
 *                 meta: { $ref: '#/components/schemas/PageMeta' }
 */
router.get('/', validate(userValidator.searchUsers), userController.searchUsers);

/**
 * @openapi
 * /users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Update my name and/or bio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               bio: { type: string, maxLength: 150 }
 *     responses:
 *       200: { description: Updated user }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.patch('/me', validate(userValidator.updateProfile), userController.updateProfile);

/**
 * @openapi
 * /users/me/avatar:
 *   put:
 *     tags: [Users]
 *     summary: Upload or replace my profile picture (JPG/PNG/WEBP, max 5 MB)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated user with new avatarUrl }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       413: { description: Image too large }
 */
router.put('/me/avatar', uploadSingleImage('avatar'), userController.updateAvatar);

/**
 * @openapi
 * /users/me/blocks:
 *   get:
 *     tags: [Users]
 *     summary: List users I have blocked
 *     parameters:
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/Limit' }
 *     responses:
 *       200: { description: Paginated list of blocked users }
 */
router.get('/me/blocks', validate(userValidator.listBlocks), userController.listBlockedUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user's public profile (includes isOnline)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     responses:
 *       200: { description: Public profile }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(userValidator.getUser), userController.getUser);

/**
 * @openapi
 * /users/{id}/block:
 *   post:
 *     tags: [Users]
 *     summary: Block a user (neither of you can message the other)
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     responses:
 *       201: { description: User blocked }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *   delete:
 *     tags: [Users]
 *     summary: Unblock a user
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     responses:
 *       204: { description: User unblocked }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:id/block', validate(userValidator.blockUser), userController.blockUser);
router.delete('/:id/block', validate(userValidator.blockUser), userController.unblockUser);

module.exports = router;
