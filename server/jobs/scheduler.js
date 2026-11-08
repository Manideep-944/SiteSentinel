import cron from 'node-cron';
import Website from '../models/Website.js';
import { performCheck } from '../services/monitorService.js';
import { logger } from '../utils/logger.js';

let cronTask = null;
let isSchedulerRunning = false;
let lastCycleTime = null;
let lastCycleCount = 0;

/**
 * Executes a monitoring batch cycle for all enabled websites.
 */
export async function runMonitoringCycle() {
  if (isSchedulerRunning) {
    logger.warn('[Scheduler] Previous monitoring cycle is still running. Skipping this tick to prevent overlap.');
    return;
  }

  isSchedulerRunning = true;
  lastCycleTime = new Date();

  try {
    const websites = await Website.find({ isMonitoringEnabled: true });
    logger.info(`[Scheduler] Commencing scheduled cycle for ${websites.length} active website(s)...`);

    lastCycleCount = websites.length;

    // Check websites sequentially or in bounded batches to avoid network congestion
    for (const site of websites) {
      try {
        await performCheck(site._id, false);
      } catch (err) {
        logger.error(`[Scheduler Error] Failed checking website ${site.name} (${site._id}): ${err.message}`);
      }
    }

    logger.info(`[Scheduler] Completed scheduled cycle for ${websites.length} website(s).`);
  } catch (error) {
    logger.error(`[Scheduler Error] Monitoring cycle encountered an error: ${error.message}`);
  } finally {
    isSchedulerRunning = false;
  }
}

/**
 * Starts the node-cron scheduler.
 * Default interval is controlled by MONITOR_INTERVAL_MINUTES (default 5, can be 1 in dev).
 */
export function startScheduler() {
  if (cronTask) {
    logger.warn('[Scheduler] Scheduler already initialized.');
    return;
  }

  const intervalMinutes = parseInt(process.env.MONITOR_INTERVAL_MINUTES || '5', 10);
  const safeMinutes = isNaN(intervalMinutes) || intervalMinutes < 1 ? 5 : intervalMinutes;

  // Cron pattern: every N minutes
  const cronPattern = `*/${safeMinutes} * * * *`;

  logger.info(`[Scheduler] Initializing automated website monitoring with pattern: "${cronPattern}" (every ${safeMinutes} min).`);

  cronTask = cron.schedule(cronPattern, async () => {
    logger.info('[Scheduler] Cron trigger activated.');
    await runMonitoringCycle();
  });

  logger.info('[Scheduler] Cron job active. Note: Monitoring runs only while this server process is running.');
}

/**
 * Stops the scheduler.
 */
export function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('[Scheduler] Scheduler stopped.');
  }
}

/**
 * Returns diagnostic metadata regarding scheduler health.
 */
export function getSchedulerStatus() {
  return {
    isActive: Boolean(cronTask),
    intervalMinutes: parseInt(process.env.MONITOR_INTERVAL_MINUTES || '5', 10),
    isCycleRunning: isSchedulerRunning,
    lastCycleTime,
    lastCycleTargetCount: lastCycleCount
  };
}
