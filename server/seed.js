import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Website from './models/Website.js';
import MonitoringCheck from './models/MonitoringCheck.js';
import { performCheck } from './services/monitorService.js';
import { logger } from './utils/logger.js';

dotenv.config();

async function seedDatabase() {
  await connectDB();

  logger.info('[Seeder] Initializing demo evaluator dataset...');

  const demoEmail = 'demo.evaluator@sitesentinel.edu';
  let user = await User.findOne({ email: demoEmail });

  if (!user) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('demo123456', salt);
    user = await User.create({
      name: 'Faculty Evaluator',
      email: demoEmail,
      alertEmail: demoEmail,
      emailAlertsEnabled: true,
      passwordHash
    });
    logger.info('[Seeder] Created demo user: demo.evaluator@sitesentinel.edu / demo123456');
  }

  // Sample target sites
  const sampleTargets = [
    {
      name: 'Example Public Domain',
      url: 'https://example.com',
      checkIntervalMinutes: 5,
      timeoutMs: 10000
    },
    {
      name: 'Amazon India',
      url: 'https://www.amazon.in',
      checkIntervalMinutes: 5,
      timeoutMs: 10000
    },
    {
      name: 'GitHub Public API',
      url: 'https://api.github.com',
      checkIntervalMinutes: 5,
      timeoutMs: 10000
    },
    {
      name: 'HTTPBin Verification Service',
      url: 'https://httpbin.org/status/200',
      checkIntervalMinutes: 2,
      timeoutMs: 10000
    },
    {
      name: 'Wikipedia Main Portal',
      url: 'https://www.wikipedia.org',
      checkIntervalMinutes: 5,
      timeoutMs: 10000
    }
  ];

  for (const target of sampleTargets) {
    let site = await Website.findOne({ ownerId: user._id, url: target.url });
    if (!site) {
      site = await Website.create({
        ownerId: user._id,
        name: target.name,
        url: target.url,
        checkIntervalMinutes: target.checkIntervalMinutes,
        timeoutMs: target.timeoutMs,
        isMonitoringEnabled: true,
        lastStatus: 'PENDING'
      });
      logger.info(`[Seeder] Registered target endpoint: "${site.name}"`);

      // Trigger actual real checks to populate telemetry
      try {
        await performCheck(site._id, true);
        logger.info(`[Seeder] Successfully ran initial live health check on ${site.name}`);
      } catch (err) {
        logger.warn(`[Seeder] Initial check notice: ${err.message}`);
      }
    }
  }

  logger.info('[Seeder] Demo seed complete! Faculty login credentials: demo.evaluator@sitesentinel.edu / demo123456');
  process.exit(0);
}

seedDatabase().catch(err => {
  console.error('[Seeder Error]', err);
  process.exit(1);
});
