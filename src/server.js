const http = require('http');
const env = require('./config/env');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocket } = require('./socket');

async function start() {
  await connectDB();

  // Express and Socket.IO share one HTTP server, so both run on the same port.
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`ChatNest API running on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`API docs: http://localhost:${env.port}/api-docs`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
