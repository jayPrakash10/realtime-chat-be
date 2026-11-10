const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const Message = require('../src/models/message.model');
const { MESSAGE_LIMITS } = require('../src/config/constants');
const { app, API, TINY_PNG, registerUser, authHeader } = require('./helpers');

// Returns the supertest request (not awaited) so callers can chain .expect(status).
function startConversation(from, to) {
  return request(app)
    .post(`${API}/conversations`)
    .set(authHeader(from.token))
    .send({ participantId: to.user._id });
}

async function sendText(sender, conversationId, text) {
  const response = await request(app)
    .post(`${API}/conversations/${conversationId}/messages`)
    .set(authHeader(sender.token))
    .send({ text })
    .expect(201);
  return response.body.data;
}

async function listMessages(viewer, conversationId, query = {}) {
  const response = await request(app)
    .get(`${API}/conversations/${conversationId}/messages`)
    .query(query)
    .set(authHeader(viewer.token))
    .expect(200);
  return response.body;
}

async function getConversation(viewer, conversationId) {
  const response = await request(app)
    .get(`${API}/conversations/${conversationId}`)
    .set(authHeader(viewer.token))
    .expect(200);
  return response.body.data;
}

describe('Messaging workflow', () => {
  let alice;
  let bob;
  let conversationId;

  beforeEach(async () => {
    alice = await registerUser();
    bob = await registerUser();
    const response = await startConversation(alice, bob).expect(201);
    conversationId = response.body.data._id;
  });

  describe('Starting a conversation', () => {
    it('returns the existing conversation instead of creating a duplicate', async () => {
      const fromBob = await startConversation(bob, alice).expect(200);
      expect(fromBob.body.data._id).toBe(conversationId);
      expect(fromBob.body.data.otherUser.username).toBe(alice.user.username);
    });

    it('does not allow a conversation with yourself', async () => {
      await startConversation(alice, alice).expect(400);
    });

    it('does not allow a conversation with someone who blocked you', async () => {
      const carol = await registerUser();
      await request(app).post(`${API}/users/${alice.user._id}/block`).set(authHeader(carol.token)).expect(201);
      await startConversation(alice, carol).expect(403);
    });
  });

  describe('Sending and reading messages', () => {
    it('tracks unread counts and read receipts', async () => {
      const message = await sendText(alice, conversationId, 'Hi Bob!');
      expect(message.status).toBe('sent');

      const bobView = await getConversation(bob, conversationId);
      expect(bobView.unreadCount).toBe(1);
      expect(bobView.lastMessage.text).toBe('Hi Bob!');

      await request(app).patch(`${API}/conversations/${conversationId}/read`).set(authHeader(bob.token)).expect(200);

      expect((await getConversation(bob, conversationId)).unreadCount).toBe(0);
      const aliceHistory = await listMessages(alice, conversationId);
      expect(aliceHistory.data[0].status).toBe('read');
    });

    it('filters the conversation list to unread chats only', async () => {
      const carol = await registerUser();
      await startConversation(bob, carol).expect(201);
      await sendText(alice, conversationId, 'Unread for Bob');

      const response = await request(app)
        .get(`${API}/conversations`)
        .query({ unread: true })
        .set(authHeader(bob.token))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._id).toBe(conversationId);
    });

    it('rejects an empty message', async () => {
      await request(app)
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(alice.token))
        .send({ text: '   ' })
        .expect(400);
    });

    it('rejects text longer than the limit', async () => {
      await request(app)
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(alice.token))
        .send({ text: 'a'.repeat(MESSAGE_LIMITS.MAX_TEXT_LENGTH + 1) })
        .expect(400);
    });

    it('hides conversations from users who are not participants', async () => {
      const outsider = await registerUser();
      await request(app)
        .get(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(outsider.token))
        .expect(404);
    });

    it('stops messages once a user is blocked', async () => {
      await request(app).post(`${API}/users/${alice.user._id}/block`).set(authHeader(bob.token)).expect(201);
      await request(app)
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(alice.token))
        .send({ text: 'Can you see this?' })
        .expect(403);
    });
  });

  describe('Image messages', () => {
    it('stores the image and returns its URL', async () => {
      const response = await request(app)
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(alice.token))
        .field('text', 'Look at this')
        .attach('image', TINY_PNG, { filename: 'photo.png', contentType: 'image/png' })
        .expect(201);

      const message = response.body.data;
      expect(message.type).toBe('image');
      expect(message.text).toBe('Look at this');
      expect(message.imageUrl).toMatch(/^\/uploads\/messages\/[\w-]+\.png$/);

      await request(app).get(message.imageUrl).expect(200).expect('Content-Type', /png/);
    });

    it('rejects files that are not images', async () => {
      await request(app)
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(alice.token))
        .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' })
        .expect(400);
    });
  });

  describe('Pagination and search', () => {
    it('pages backwards through history with a cursor', async () => {
      for (const text of ['one', 'two', 'three']) {
        await sendText(alice, conversationId, text);
      }

      const firstPage = await listMessages(bob, conversationId, { limit: 2 });
      expect(firstPage.data.map((message) => message.text)).toEqual(['three', 'two']);
      expect(firstPage.meta.hasMore).toBe(true);

      const secondPage = await listMessages(bob, conversationId, { limit: 2, before: firstPage.meta.nextCursor });
      expect(secondPage.data.map((message) => message.text)).toEqual(['one']);
      expect(secondPage.meta.hasMore).toBe(false);
    });

    it('searches message text case-insensitively', async () => {
      await sendText(alice, conversationId, 'Trek on Saturday?');
      await sendText(bob, conversationId, 'Yes, see you then');

      const result = await listMessages(bob, conversationId, { q: 'saturday' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].text).toBe('Trek on Saturday?');
    });
  });

  describe('Deleting messages', () => {
    it('"delete for me" hides the message only for that user', async () => {
      const message = await sendText(alice, conversationId, 'Secret');

      await request(app).delete(`${API}/messages/${message._id}`).query({ scope: 'me' }).set(authHeader(bob.token)).expect(204);

      expect((await listMessages(bob, conversationId)).data).toHaveLength(0);
      expect((await listMessages(alice, conversationId)).data).toHaveLength(1);
    });

    it('"delete for everyone" clears content and removes the image file', async () => {
      const upload = await request(app)
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(authHeader(alice.token))
        .attach('image', TINY_PNG, { filename: 'photo.png', contentType: 'image/png' })
        .expect(201);
      const message = upload.body.data;
      const filePath = path.join(process.env.UPLOAD_DIR, message.imageUrl.replace('/uploads/', ''));
      expect(fs.existsSync(filePath)).toBe(true);

      await request(app)
        .delete(`${API}/messages/${message._id}`)
        .query({ scope: 'everyone' })
        .set(authHeader(alice.token))
        .expect(204);

      const [bobCopy] = (await listMessages(bob, conversationId)).data;
      expect(bobCopy.isDeletedForEveryone).toBe(true);
      expect(bobCopy.imageUrl).toBeNull();
      expect(fs.existsSync(filePath)).toBe(false);
      expect((await getConversation(bob, conversationId)).lastMessage.isDeleted).toBe(true);
    });

    it('only lets the sender delete for everyone', async () => {
      const message = await sendText(alice, conversationId, 'Mine');
      await request(app)
        .delete(`${API}/messages/${message._id}`)
        .query({ scope: 'everyone' })
        .set(authHeader(bob.token))
        .expect(403);
    });

    it('refuses "delete for everyone" after the time window', async () => {
      const message = await sendText(alice, conversationId, 'Too late to delete');
      const tooOld = new Date(Date.now() - MESSAGE_LIMITS.DELETE_FOR_EVERYONE_WINDOW_MS - 1000);
      // Native driver update: Mongoose treats createdAt as immutable.
      await Message.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(message._id) },
        { $set: { createdAt: tooOld } },
      );

      const response = await request(app)
        .delete(`${API}/messages/${message._id}`)
        .query({ scope: 'everyone' })
        .set(authHeader(alice.token))
        .expect(403);
      expect(response.body.error.message).toMatch(/15 minutes/);
    });
  });
});
