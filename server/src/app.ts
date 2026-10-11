import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import roomRoutes from './routes/roomRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Enable reverse proxy support for cloud providers (Render, Railway, etc.)
app.set('trust proxy', 1);

// Configure allowed CORS origins supporting CLIENT_ORIGIN env var and localhost
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

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests, wildcard, or matching origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.use(express.json());

// Public Health Check Routes (Root /health for cloud pingers/Render, plus /api/health)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'YouTube Watch Party API' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'YouTube Watch Party API' });
});

// Room Routes
app.use('/api', roomRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
