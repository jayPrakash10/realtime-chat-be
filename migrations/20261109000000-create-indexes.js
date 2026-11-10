/*
 * MongoDB has no schema migrations in the SQL sense, but indexes (and unique constraints)
 * still need to be created in a controlled, versioned way. Keep these definitions in sync
 * with the indexes declared in src/models.
 */

const INDEXES = [
  { collection: 'users', keys: { username: 1 }, options: { unique: true } },
  { collection: 'users', keys: { email: 1 }, options: { unique: true } },
  { collection: 'conversations', keys: { participantKey: 1 }, options: { unique: true } },
  { collection: 'conversations', keys: { 'participants.user': 1, lastMessageAt: -1 }, options: {} },
  { collection: 'messages', keys: { conversation: 1, _id: -1 }, options: {} },
  { collection: 'blocks', keys: { blocker: 1, blocked: 1 }, options: { unique: true } },
];

module.exports = {
  async up(db) {
    for (const { collection, keys, options } of INDEXES) {
      await db.collection(collection).createIndex(keys, options);
    }
  },

  async down(db) {
    for (const { collection, keys } of INDEXES) {
      const indexName = Object.entries(keys)
        .map(([field, direction]) => `${field}_${direction}`)
        .join('_');
      await db.collection(collection).dropIndex(indexName);
    }
  },
};
