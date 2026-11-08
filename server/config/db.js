import dns from 'dns';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// Configure resilient DNS fallback for SRV lookups only if system resolvers default to unserved loopback
try {
  const currentServers = dns.getServers();
  if (!currentServers || currentServers.length === 0 || currentServers.every(s => s.startsWith('127.') || s === '::1')) {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  }
} catch {
  // If DNS configuration is restricted or custom resolver is present, proceed with system resolver
}

let isListenersRegistered = false;

/**
 * Registers Mongoose connection event listeners for logging and monitoring.
 */
function registerConnectionListeners() {
  if (isListenersRegistered) return;

  mongoose.connection.on('connected', () => {
    logger.info(`[Database] Mongoose connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`[Database Error] Mongoose connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[Database] Mongoose disconnected from database. Attempting automatic reconnection...');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('[Database] Mongoose reconnected to database successfully.');
  });

  isListenersRegistered = true;
}

/**
 * Connects to MongoDB with connection pooling and exponential backoff retry logic.
 * @param {number} maxRetries Maximum number of initial connection attempts
 * @param {number} retryDelayMs Base delay between retries in milliseconds
 */
export const connectDB = async (maxRetries = 5, retryDelayMs = 2000) => {
  registerConnectionListeners();

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sitesentinel';
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

  // Validate connection string to detect malformed template placeholders like <username> or <password>
  if (uri.includes('<') || uri.includes('>')) {
    const placeholderError = new Error('[Database Config Error] MONGODB_URI contains unreplaced placeholder angle brackets ("<" or ">"). Please remove angle brackets from your database connection string in .env.');
    logger.error(placeholderError.message);
    throw placeholderError;
  }

  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    family: 4
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[Database] Connecting to MongoDB (${maskedUri}) - Attempt ${attempt}/${maxRetries}...`);
      const conn = await mongoose.connect(uri, mongooseOptions);
      logger.info(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      logger.error(`[Database Error] Connection attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        const delay = retryDelayMs * attempt;
        logger.info(`[Database] Retrying connection in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(`[Database Fatal] All ${maxRetries} connection attempts failed.`);
        throw error;
      }
    }
  }
};
