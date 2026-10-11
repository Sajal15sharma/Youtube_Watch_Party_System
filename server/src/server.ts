import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import { setupSocketHandlers } from './socket/socketHandler.js';
import { checkDbConnection } from './db/index.js';
import { ClientToServerEvents, ServerToClientEvents } from './types/index.js';

// Read PORT from process.env.PORT (Render sets PORT dynamically) with fallback to 5000
const PORT = process.env.PORT || 5000;

// Resolve allowed CORS origins for Socket.IO
const rawClientOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || '';
const configuredOrigins = rawClientOrigin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    ...configuredOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
);

const server = http.createServer(app);

// Configure Socket.IO Server with reverse proxy support and dynamic origin resolution
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, allowedOrigins.includes(origin));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Ensure both websocket and polling are allowed behind proxies
});

setupSocketHandlers(io);

server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 YouTube Watch Party Server is running!`);
  console.log(`📡 HTTP & Socket.IO Port: ${PORT}`);
  console.log(`🌐 Allowed Client Origins: ${allowedOrigins.join(', ')}`);

  const isDbConnected = await checkDbConnection();
  if (isDbConnected) {
    console.log(`🗄️  PostgreSQL Database: CONNECTED via Drizzle ORM`);
  } else {
    console.log(`⚠️  PostgreSQL Database: Offline / Fallback in-memory mode active`);
  }
  console.log(`===============================================`);
});
