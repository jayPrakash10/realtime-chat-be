const ONE_MINUTE_MS = 60 * 1000;
const ONE_MEGABYTE = 1024 * 1024;

const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

const MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
});

const DELETE_SCOPES = Object.freeze({
  ME: 'me',
  EVERYONE: 'everyone',
});

const DELETE_FOR_EVERYONE_WINDOW_MINUTES = 15;

const MESSAGE_LIMITS = Object.freeze({
  MAX_TEXT_LENGTH: 2000,
  DELETE_FOR_EVERYONE_WINDOW_MINUTES,
  DELETE_FOR_EVERYONE_WINDOW_MS: DELETE_FOR_EVERYONE_WINDOW_MINUTES * ONE_MINUTE_MS,
});

const MONGO_DUPLICATE_KEY_CODE = 11000;

const USER_LIMITS = Object.freeze({
  NAME_MAX_LENGTH: 50,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  USERNAME_PATTERN: /^[a-z0-9_.]+$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 72, // bcrypt ignores bytes beyond 72
  BIO_MAX_LENGTH: 150,
  SEARCH_MAX_LENGTH: 50,
});

const UPLOAD = Object.freeze({
  MAX_IMAGE_SIZE_BYTES: 5 * ONE_MEGABYTE,
  PUBLIC_PATH: '/uploads',
  FOLDERS: Object.freeze({
    AVATARS: 'avatars',
    MESSAGES: 'messages',
  }),
  IMAGE_EXTENSIONS_BY_MIME: Object.freeze({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }),
});

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  MESSAGES_DEFAULT_LIMIT: 30,
  MESSAGES_MAX_LIMIT: 100,
});

const SECURITY = Object.freeze({
  BCRYPT_SALT_ROUNDS: 10,
});

const PRESENCE = Object.freeze({
  // Avoid a database write on every request; one update per minute is accurate enough for "last seen".
  LAST_SEEN_UPDATE_INTERVAL_MS: ONE_MINUTE_MS,
});

const SOCKET_EVENTS = Object.freeze({
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELETED: 'message:deleted',
  CONVERSATION_READ: 'conversation:read',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
});

const PUBLIC_USER_FIELDS = 'name username bio avatarUrl lastSeenAt';

module.exports = {
  ROLES,
  MESSAGE_TYPES,
  DELETE_SCOPES,
  MESSAGE_LIMITS,
  USER_LIMITS,
  UPLOAD,
  PAGINATION,
  SECURITY,
  PRESENCE,
  SOCKET_EVENTS,
  PUBLIC_USER_FIELDS,
  MONGO_DUPLICATE_KEY_CODE,
};
