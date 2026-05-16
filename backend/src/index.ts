import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { connectDB } from './config/db';

import authRoutes from './routes/auth.routes';
import uploadRoutes from './routes/upload.routes';
import checklistRoutes from './routes/checklist.routes';
import gameRoutes from './routes/game.routes';
import chatRoutes from './routes/chat.routes';

const app = express();
// Cloud Run provides PORT; use 5000 for local dev when PORT is not set.
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);

// Allowed CORS origins.
// FRONTEND_URL can be set in production for direct browser-to-backend calls.
// In development, localhost:3000 / 3001 are always allowed.
const CORS_ORIGINS: (string | RegExp)[] = [
  'http://localhost:3000',
  'http://localhost:3001',
];
if (process.env.FRONTEND_URL) {
  CORS_ORIGINS.push(process.env.FRONTEND_URL);
}
// Also allow Cloud Run frontend URLs automatically.
CORS_ORIGINS.push(/https:\/\/.*\.run\.app$/);

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Static file serving for map images
app.use('/maps', express.static(path.join(__dirname, '../maps')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Euexia backend running on http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);

