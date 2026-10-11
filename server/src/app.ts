import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import roomRoutes from './routes/roomRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json());

// API Status Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'YouTube Watch Party API' });
});

// Room Routes
app.use('/api', roomRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
