import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'sitesentinel_jwt_secret_dev_key_change_in_production_2026',
    { expiresIn: '7d' }
  );
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email address, and password.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      alertEmail: normalizedEmail,
      passwordHash
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        alertEmail: user.alertEmail,
        emailAlertsEnabled: user.emailAlertsEnabled,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        alertEmail: user.alertEmail,
        emailAlertsEnabled: user.emailAlertsEnabled,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public demonstration credentials provided solely for evaluator preview access.
 * These credentials grant access exclusively to a dedicated demonstration account
 * containing sample monitoring data and are completely isolated from real user data.
 */
const PUBLIC_DEMO_EMAIL = 'demo.evaluator@sitesentinel.edu';
const PUBLIC_DEMO_PASSWORD = 'demo123456';

// In-memory sliding-window log rate limiter for demo login.
// Tracks exact timestamps of incoming requests per IP within a sliding 60-second window.
//
// Render Deployment Architecture & Limitations:
// 1. Single Instance (Current Render setup):
//    Accurately throttles requests per client IP without external infrastructure dependencies.
// 2. Ephemeral Storage:
//    On Render free tier, instances spin down after 15 min of inactivity. Container reboots reset
//    the in-memory map. This is acceptable since cold spin-down naturally limits request volume.
// 3. Horizontal Scaling:
//    If the backend is scaled horizontally across multiple Render instances, each instance maintains
//    its own local memory map. A centralized store (Redis or Memcached) would be required for shared
//    distributed rate limiting across instances.
const demoRateLimitMap = new Map();
const DEMO_WINDOW_MS = 60 * 1000; // 60-second sliding window
const DEMO_MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per 60 seconds per IP

// Periodic garbage collection to prune stale IP logs older than 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [ip, timestamps] of demoRateLimitMap.entries()) {
    const valid = timestamps.filter(t => t > cutoff);
    if (valid.length === 0) {
      demoRateLimitMap.delete(ip);
    } else {
      demoRateLimitMap.set(ip, valid);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Quick 1-Click Evaluator Demo Login
 * Grants access exclusively to the dedicated demonstration account (demo.evaluator@sitesentinel.edu).
 * If user does not exist, safely creates it using bcrypt hashing (salt rounds: 12).
 * If user already exists, preserves their existing password without overwriting.
 * Includes genuine sliding-window rate limiting using trusted proxy req.ip to protect against abuse.
 */
export const demoLogin = async (req, res, next) => {
  try {
    // 1. Abuse Protection: Genuine sliding-window rate limiter using trusted proxy client IP
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const timestamps = (demoRateLimitMap.get(clientIp) || []).filter(t => now - t < DEMO_WINDOW_MS);

    if (timestamps.length >= DEMO_MAX_REQUESTS_PER_WINDOW) {
      const oldestTimestamp = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestTimestamp + DEMO_WINDOW_MS - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: `Too many demo login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`
      });
    }

    timestamps.push(now);
    demoRateLimitMap.set(clientIp, timestamps);

    let user = await User.findOne({ email: PUBLIC_DEMO_EMAIL });

    if (!user) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(PUBLIC_DEMO_PASSWORD, salt);
      user = await User.create({
        name: 'Faculty Evaluator',
        email: PUBLIC_DEMO_EMAIL,
        alertEmail: PUBLIC_DEMO_EMAIL,
        emailAlertsEnabled: true,
        passwordHash
      });
    }
    // Note: If user already exists, we intentionally preserve their existing password and never overwrite it.

    // Seed sample demonstration sites for evaluator demo if none exist
    try {
      const Website = (await import('../models/Website.js')).default;
      const count = await Website.countDocuments({ ownerId: user._id });
      if (count === 0) {
        const sampleTargets = [
          { name: 'Example Public Domain', url: 'https://example.com', checkIntervalMinutes: 5 },
          { name: 'Amazon India', url: 'https://www.amazon.in', checkIntervalMinutes: 5 },
          { name: 'Wikipedia Main Portal', url: 'https://www.wikipedia.org', checkIntervalMinutes: 5 }
        ];
        for (const target of sampleTargets) {
          await Website.create({
            ownerId: user._id,
            name: target.name,
            url: target.url,
            checkIntervalMinutes: target.checkIntervalMinutes,
            timeoutMs: 10000,
            isMonitoringEnabled: true,
            lastStatus: 'UP'
          });
        }
      }
    } catch {
      // Non-fatal if sample targets already exist
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        alertEmail: user.alertEmail,
        emailAlertsEnabled: user.emailAlertsEnabled,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, alertEmail, emailAlertsEnabled, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Protect the shared public demonstration account against any profile or credential alteration
    if (user.email === PUBLIC_DEMO_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Account profile modifications are disabled on the public demonstration account to protect evaluator access.'
      });
    }

    if (name) user.name = name.trim();
    if (alertEmail !== undefined) user.alertEmail = alertEmail.trim();
    if (emailAlertsEnabled !== undefined) user.emailAlertsEnabled = Boolean(emailAlertsEnabled);

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change password.'
        });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password does not match.'
        });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long.'
        });
      }
      const salt = await bcrypt.genSalt(12);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        alertEmail: user.alertEmail,
        emailAlertsEnabled: user.emailAlertsEnabled,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};
