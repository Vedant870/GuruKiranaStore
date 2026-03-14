import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { ensureStore } from './data/store.js';
import { errorHandler } from './middleware/errorHandler.js';
import adminRoutes from './routes/admin.js';
import assistantRoutes from './routes/assistant.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import productRoutes from './routes/products.js';

dotenv.config();

const app = express();
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((entry) => entry.trim())
  : true;

await ensureStore();

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Guru Kirana Store API is running.',
    serviceArea: '15-20 km nearby locality coverage',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use(errorHandler);

export default app;
