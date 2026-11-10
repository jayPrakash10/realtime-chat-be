const os = require('os');
const path = require('path');

// Runs before any application code is loaded, so src/config/env.js sees these values.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';
// Placeholder to satisfy env validation; tests/setup/db.js connects to an in-memory server instead.
process.env.MONGODB_URI = 'mongodb://in-memory-placeholder/chatnest-test';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'chatnest-test-uploads');
