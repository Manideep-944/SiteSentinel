import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import websiteRoutes from './routes/websiteRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { startScheduler } from './jobs/scheduler.js';
import { logger } from './utils/logger.js';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure allowed origins (supporting comma-separated list and trailing-slash normalization)
const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrls
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Always allow local development origins if not in production
if (process.env.NODE_ENV !== 'production') {
  if (!allowedOrigins.includes('http://localhost:5173')) allowedOrigins.push('http://localhost:5173');
  if (!allowedOrigins.includes('http://127.0.0.1:5173')) allowedOrigins.push('http://127.0.0.1:5173');
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (health checks, server-to-server, curl, Postman)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Allow Vercel preview domains if enabled
    if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && /\.vercel\.app$/.test(new URL(origin).hostname)) {
      return callback(null, true);
    }

    logger.warn(`[CORS Blocked] Origin not allowed: ${origin}. Configured: ${allowedOrigins.join(', ')}`);
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });
}

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/analytics', analyticsRoutes);

// Base route test
app.get('/', (req, res) => {
  res.json({
    name: 'SiteSentinel API',
    description: 'Automated Website Uptime and Performance Monitoring System',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// Fallback & Error Handling
app.use(notFound);
app.use(errorHandler);

// Database Connection & Server Initialization
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`[Server] SiteSentinel Backend running on port ${PORT}`);
      logger.info(`[Server] Client Origin allowed: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);

      // Initialize background node-cron monitoring only after DB is live
      startScheduler();
    });
  } catch (err) {
    logger.error(`[Server Fatal] Initialization failure: ${err.message}`);
    process.exit(1);
  }
};

startServer();

// Handle graceful termination
process.on('SIGINT', () => {
  logger.info('[Server] Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('[Server] Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});
