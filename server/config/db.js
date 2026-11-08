import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

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
