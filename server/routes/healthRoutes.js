import express from 'express';
import mongoose from 'mongoose';
import { getSchedulerStatus } from '../jobs/scheduler.js';
import { isEmailConfigured } from '../services/emailService.js';

const router = express.Router();

router.get('/', (req, res) => {
  const mongoStatusMap = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  const dbState = mongoose.connection.readyState;

  res.json({
    status: dbState === 1 ? 'healthy' : 'degraded',
    service: 'SiteSentinel API & Monitoring Engine',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: mongoStatusMap[dbState] || 'Unknown',
      connected: dbState === 1
    },
    scheduler: getSchedulerStatus(),
    emailNotifications: {
      configured: isEmailConfigured()
    },
    nodeVersion: process.version
  });
});

export default router;
