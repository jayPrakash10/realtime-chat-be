const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'ChatNest API',
    version: '1.0.0',
    description:
      'Direct messaging REST API with JWT auth, text and image messages, read receipts and blocking. ' +
      'Live updates are pushed over Socket.IO (see README).',
  },
  servers: [{ url: `http://localhost:${env.port}/api/v1` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      Page: { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
      Limit: { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      IdPath: { in: 'path', name: 'id', required: true, schema: { type: 'string', example: '665f1c2a9b1e8a3d4c5b6a71' } },
    },
    schemas: {
      PublicUser: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          username: { type: 'string' },
          bio: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
          lastSeenAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        allOf: [
          { $ref: '#/components/schemas/PublicUser' },
          {
            type: 'object',
            properties: {
              email: { type: 'string' },
              role: { type: 'string', enum: ['user', 'admin'] },
              isBanned: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          conversation: { type: 'string' },
          sender: { type: 'string' },
          type: { type: 'string', enum: ['text', 'image'] },
          text: { type: 'string' },
          imageUrl: { type: 'string', nullable: true, example: '/uploads/messages/3f2a.jpg' },
          isDeletedForEveryone: { type: 'boolean' },
          status: { type: 'string', enum: ['sent', 'read'], description: 'Only present on your own messages' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          otherUser: { $ref: '#/components/schemas/PublicUser' },
          lastMessage: {
            type: 'object',
            nullable: true,
            properties: {
              messageId: { type: 'string' },
              type: { type: 'string' },
              text: { type: 'string' },
              sender: { type: 'string' },
              isDeleted: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          lastMessageAt: { type: 'string', format: 'date-time' },
          unreadCount: { type: 'integer' },
          lastReadAt: { type: 'string', format: 'date-time' },
        },
      },
      PageMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              status: { type: 'integer', example: 400 },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Unauthorized: { description: 'Missing or invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Forbidden: { description: 'Not allowed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Conflict: { description: 'Duplicate resource', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
  security: [{ bearerAuth: [] }],
};

// swagger-jsdoc uses glob patterns, which need forward slashes even on Windows.
const routeFilesPattern = path.join(__dirname, '..', 'routes', '*.js').replace(/\\/g, '/');

const swaggerSpec = swaggerJsdoc({ definition, apis: [routeFilesPattern] });

module.exports = swaggerSpec;
