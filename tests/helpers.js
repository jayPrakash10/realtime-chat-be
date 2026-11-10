const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const { ROLES } = require('../src/config/constants');

const API = '/api/v1';
const DEFAULT_PASSWORD = 'Password123!';

// A real 1x1 PNG, used to test image uploads.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let userCounter = 0;

async function registerUser(overrides = {}) {
  userCounter += 1;
  const payload = {
    name: `Test User ${userCounter}`,
    username: `test_user_${userCounter}`,
    email: `user${userCounter}@example.com`,
    password: DEFAULT_PASSWORD,
    ...overrides,
  };

  const response = await request(app).post(`${API}/auth/register`).send(payload).expect(201);
  return { user: response.body.data.user, token: response.body.data.token, password: payload.password };
}

async function registerAdmin() {
  const admin = await registerUser();
  await User.updateOne({ _id: admin.user._id }, { role: ROLES.ADMIN });
  return admin;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { app, API, DEFAULT_PASSWORD, TINY_PNG, registerUser, registerAdmin, authHeader };
