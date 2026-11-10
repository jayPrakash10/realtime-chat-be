const express = require('express');
const adminController = require('../controllers/admin.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const adminValidator = require('../validators/admin.validator');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: Admin-only user management
 */

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin only)
 *     parameters:
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/Limit' }
 *       - { in: query, name: isBanned, schema: { type: boolean } }
 *       - { in: query, name: search, schema: { type: string }, description: Matches username or email }
 *     responses:
 *       200:
 *         description: Paginated users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/User' } }
 *                 meta: { $ref: '#/components/schemas/PageMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/users', validate(adminValidator.listUsers), adminController.listUsers);

/**
 * @openapi
 * /admin/users/{id}/ban:
 *   patch:
 *     tags: [Admin]
 *     summary: Ban or unban a user (admin only). Banned users are disconnected immediately.
 *     parameters:
 *       - { $ref: '#/components/parameters/IdPath' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isBanned]
 *             properties:
 *               isBanned: { type: boolean, example: true }
 *     responses:
 *       200: { description: Updated user }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/users/:id/ban', validate(adminValidator.setBanStatus), adminController.setBanStatus);

module.exports = router;
