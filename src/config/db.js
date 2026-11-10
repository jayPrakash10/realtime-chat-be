const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  // Indexes are created by migrations in production; auto-indexing is a dev/test convenience.
  mongoose.set('autoIndex', !env.isProduction);
  await mongoose.connect(env.mongodbUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
