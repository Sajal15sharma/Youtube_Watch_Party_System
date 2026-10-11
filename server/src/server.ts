import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import { setupSocketHandlers } from './socket/socketHandler.js';
import { checkDbConnection } from './db/index.js';
import { ClientToServerEvents, ServerToClientEvents } from './types/index.js';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocketHandlers(io);

server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 YouTube Watch Party Server is running!`);
  console.log(`📡 HTTP & Socket.IO URL: http://localhost:${PORT}`);
  console.log(`🌐 Allowed Client URL: ${CLIENT_URL}`);

  const isDbConnected = await checkDbConnection();
  if (isDbConnected) {
    console.log(`🗄️  PostgreSQL Database: CONNECTED via Drizzle ORM`);
  } else {
    console.log(`⚠️  PostgreSQL Database: Offline / Fallback mode active`);
  }
  console.log(`===============================================`);
});
