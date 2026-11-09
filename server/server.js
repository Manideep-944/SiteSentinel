import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment configuration reliably
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trusted proxy for cloud deployments (e.g. Render reverse proxy) so req.ip is secure and reliable
app.set('trust proxy', 1);

// Configure allowed origins (supporting comma-separated list and trailing-slash normalization)
// Explicitly reject wildcard '*' to prevent any accidental wildcard CORS access
const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrls
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(url => Boolean(url) && url !== '*'); // Reject wildcard '*'

// Always ensure exact production frontend and local development origins are permitted
const defaultAllowedOrigins = [
  'https://site-sentinel-two.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

for (const origin of defaultAllowedOrigins) {
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
  }
}

/**
 * Validates whether an incoming request origin is authorized.
 * Permitted:
 * 1. Non-browser callers (curl, monitoring bots, health checks, server-to-server)
 * 2. Exact production frontend origin (https://site-sentinel-two.vercel.app)
 * 3. Explicitly configured non-wildcard origins in CLIENT_URL
 * 4. Localhost and loopback origins for local development
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');
  // Disallow any wildcard '*'
  if (normalized === '*') return false;

  if (allowedOrigins.includes(normalized)) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(normalized);
    // Allow local development across standard dev server ports
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && (protocol === 'http:' || protocol === 'https:')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      // Echo origin back to support credentials safely without wildcard collisions
      return callback(null, true);
    }

    logger.warn(`[CORS Blocked] Origin not allowed: ${origin}. Configured: ${allowedOrigins.join(', ')}`);
    // Return false without throwing an uncaught Error so Express does not emit a 500 error
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
