const request = require('supertest');
const User = require('../src/models/user.model');
const { app, API, DEFAULT_PASSWORD, registerUser, registerAdmin, authHeader } = require('./helpers');

describe('Auth', () => {
  describe('POST /auth/register', () => {
    it('creates a user, returns a token and never returns the password', async () => {
      const response = await request(app)
        .post(`${API}/auth/register`)
        .send({ name: 'Aisha Khan', username: 'Aisha_K', email: 'AISHA@example.com', password: DEFAULT_PASSWORD })
        .expect(201);

      const { user, token } = response.body.data;
      expect(token).toEqual(expect.any(String));
      expect(user.username).toBe('aisha_k');
      expect(user.email).toBe('aisha@example.com');
      expect(user.role).toBe('user');
      expect(user.password).toBeUndefined();

      const stored = await User.findById(user._id).select('+password');
      expect(stored.password).not.toBe(DEFAULT_PASSWORD);
    });

    it('ignores a "role" field so users cannot register as admin', async () => {
      const response = await request(app)
        .post(`${API}/auth/register`)
        .send({ name: 'Sneaky', username: 'sneaky', email: 'sneaky@example.com', password: DEFAULT_PASSWORD, role: 'admin' })
        .expect(201);

      expect(response.body.data.user.role).toBe('user');
    });

    it('rejects invalid input with field-level details', async () => {
      const response = await request(app)
        .post(`${API}/auth/register`)
        .send({ name: '', username: 'a b', email: 'not-an-email', password: 'short' })
        .expect(400);

      expect(response.body.success).toBe(false);
      const fields = response.body.error.details.map((detail) => detail.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'username', 'email', 'password']));
    });

    it('returns 413 for an oversized JSON body and 400 for malformed JSON', async () => {
      await request(app)
        .post(`${API}/auth/register`)
        .send({ name: 'x'.repeat(200 * 1024) })
        .expect(413);

      await request(app)
        .post(`${API}/auth/register`)
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);
    });

    it('returns 409 when the email is already registered', async () => {
      await registerUser({ email: 'taken@example.com' });

      const response = await request(app)
        .post(`${API}/auth/register`)
        .send({ name: 'Other', username: 'other_user', email: 'taken@example.com', password: DEFAULT_PASSWORD })
        .expect(409);

      expect(response.body.error.message).toMatch(/email/);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
      const { user } = await registerUser({ email: 'login@example.com' });

      const response = await request(app)
        .post(`${API}/auth/login`)
        .send({ email: 'login@example.com', password: DEFAULT_PASSWORD })
        .expect(200);

      expect(response.body.data.token).toEqual(expect.any(String));
      expect(response.body.data.user._id).toBe(user._id);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('returns the same 401 for a wrong password and an unknown email', async () => {
      await registerUser({ email: 'login@example.com' });

      const wrongPassword = await request(app)
        .post(`${API}/auth/login`)
        .send({ email: 'login@example.com', password: 'WrongPassword1' })
        .expect(401);
      const unknownEmail = await request(app)
        .post(`${API}/auth/login`)
        .send({ email: 'nobody@example.com', password: DEFAULT_PASSWORD })
        .expect(401);

      expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    });

    it('returns 403 for a banned user', async () => {
      const { user } = await registerUser({ email: 'banned@example.com' });
      await User.updateOne({ _id: user._id }, { isBanned: true });

      await request(app)
        .post(`${API}/auth/login`)
        .send({ email: 'banned@example.com', password: DEFAULT_PASSWORD })
        .expect(403);
    });
  });

  describe('Protected routes', () => {
    it('rejects requests without a token', async () => {
      await request(app).get(`${API}/auth/me`).expect(401);
    });

    it('rejects a tampered token', async () => {
      const { token } = await registerUser();
      await request(app).get(`${API}/auth/me`).set(authHeader(`${token}x`)).expect(401);
    });

    it('returns the current user for a valid token', async () => {
      const { user, token } = await registerUser();
      const response = await request(app).get(`${API}/auth/me`).set(authHeader(token)).expect(200);
      expect(response.body.data._id).toBe(user._id);
    });

    it('blocks a user with a valid token as soon as they are banned', async () => {
      const { user, token } = await registerUser();
      await User.updateOne({ _id: user._id }, { isBanned: true });
      await request(app).get(`${API}/auth/me`).set(authHeader(token)).expect(403);
    });
  });

  describe('Role-based access', () => {
    it('forbids normal users from admin routes', async () => {
      const { token } = await registerUser();
      await request(app).get(`${API}/admin/users`).set(authHeader(token)).expect(403);
    });

    it('lets an admin list and ban users', async () => {
      const admin = await registerAdmin();
      const target = await registerUser();

      const list = await request(app).get(`${API}/admin/users`).set(authHeader(admin.token)).expect(200);
      expect(list.body.meta.total).toBe(2);

      const banned = await request(app)
        .patch(`${API}/admin/users/${target.user._id}/ban`)
        .set(authHeader(admin.token))
        .send({ isBanned: true })
        .expect(200);
      expect(banned.body.data.isBanned).toBe(true);
    });

    it('does not let an admin ban another admin', async () => {
      const admin = await registerAdmin();
      const otherAdmin = await registerAdmin();

      await request(app)
        .patch(`${API}/admin/users/${otherAdmin.user._id}/ban`)
        .set(authHeader(admin.token))
        .send({ isBanned: true })
        .expect(403);
    });
  });
});
