require('dotenv').config({ quiet: true });

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is not set. Copy .env.example to .env first.');
}

module.exports = {
  mongodb: {
    // The database name is taken from the connection string (e.g. .../chatnest).
    url: process.env.MONGODB_URI,
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
