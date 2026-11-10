const { Server } = require('socket.io');
const env = require('../config/env');
const authService = require('../services/auth.service');
const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');
const ApiError = require('../utils/ApiError');
const { SOCKET_EVENTS } = require('../config/constants');

/*
 * Push-only realtime layer. Clients never send chat data over the socket: every write goes
 * through the REST API (one place for validation and business rules), and the server uses
 * the socket only to push events to the affected users.
 */

let io = null;
// userId -> number of open sockets (a user may have several tabs open).
// Kept in memory, so presence is per server process; that is fine for a single instance.
const connectionCounts = new Map();

function userRoom(userId) {
  return `user:${userId}`;
}

function logSocketError(error) {
  console.error('Socket error:', error.message);
}

function emitToUser(userId, event, payload) {
  if (!io) {
    return;
  }
  io.to(userRoom(String(userId))).emit(event, payload);
}

function isUserOnline(userId) {
  return connectionCounts.has(String(userId));
}

function disconnectUser(userId) {
  if (!io) {
    return;
  }
  io.in(userRoom(String(userId))).disconnectSockets(true);
}

// Presence is only shared with people the user has a conversation with, not with everyone.
async function notifyConversationPartners(userId, event, payload) {
  const conversations = await Conversation.find({ 'participants.user': userId })
    .select('participants.user')
    .lean();

  conversations.forEach((conversation) => {
    conversation.participants
      .filter((participant) => String(participant.user) !== userId)
      .forEach((participant) => emitToUser(participant.user, event, payload));
  });
}

async function authenticateSocket(socket, next) {
  try {
    const user = await authService.resolveUserFromToken(socket.handshake.auth?.token);
    socket.data.userId = String(user._id);
    next();
  } catch (error) {
    next(new Error(error instanceof ApiError ? error.message : 'Authentication failed'));
  }
}

async function handleDisconnect(userId) {
  const remaining = (connectionCounts.get(userId) || 1) - 1;
  if (remaining > 0) {
    connectionCounts.set(userId, remaining);
    return;
  }

  connectionCounts.delete(userId);
  const lastSeenAt = new Date();
  await User.updateOne({ _id: userId }, { lastSeenAt });
  await notifyConversationPartners(userId, SOCKET_EVENTS.USER_OFFLINE, { userId, lastSeenAt });
}

async function handleConnection(socket) {
  const { userId } = socket.data;
  socket.on('disconnect', () => handleDisconnect(userId).catch(logSocketError));
  socket.join(userRoom(userId));

  const count = (connectionCounts.get(userId) || 0) + 1;
  connectionCounts.set(userId, count);
  if (count === 1) {
    await notifyConversationPartners(userId, SOCKET_EVENTS.USER_ONLINE, { userId });
  }
}

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.corsOrigin } });
  io.use(authenticateSocket);
  io.on('connection', (socket) => handleConnection(socket).catch(logSocketError));
  return io;
}

module.exports = { initSocket, emitToUser, isUserOnline, disconnectUser };
