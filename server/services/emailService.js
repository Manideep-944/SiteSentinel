import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

export const isEmailConfigured = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
};

const getTransporter = () => {
  if (!transporter && isEmailConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
};

export const sendNotificationEmail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured()) {
    logger.info(`[Email Service] SMTP not configured. Skipped sending email to ${to} for: "${subject}"`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const mailer = getTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"SiteSentinel Alerts" <no-reply@sitesentinel.local>';
    const info = await mailer.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html
    });
    logger.info(`[Email Service] Alert email delivered to ${to}. MessageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[Email Service Error] Failed to send email to ${to}: ${error.message}`);
    return { sent: false, error: error.message };
  }
};

export const sendStateTransitionAlert = async ({ user, website, previousStatus, newStatus, checkResult }) => {
  const recipient = user?.alertEmail || user?.email;
  if (!recipient || user.emailAlertsEnabled === false) {
    return;
  }

  const isOutage = newStatus === 'DOWN';
  const subject = isOutage
    ? `🚨 [ALERT: DOWN] ${website.name} is unreachable`
    : `✅ [RECOVERY: UP] ${website.name} has recovered`;

  const statusColor = isOutage ? '#ef4444' : '#10b981';
  const statusTitle = isOutage ? 'Website Down Alert' : 'Website Recovery Notice';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">🛡️ SiteSentinel Monitor</h1>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <div style="display: inline-block; padding: 6px 12px; background-color: ${statusColor}15; color: ${statusColor}; font-weight: 700; border-radius: 6px; font-size: 14px; margin-bottom: 16px;">
          ${statusTitle}
        </div>
        <p style="font-size: 16px; color: #334155; margin-top: 0;">
          Your monitored endpoint <strong>${website.name}</strong> (${website.url}) has changed status from <strong>${previousStatus}</strong> to <strong style="color: ${statusColor};">${newStatus}</strong>.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 20px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Timestamp:</td>
            <td style="padding: 10px 0; font-weight: 600; color: #1e293b; text-align: right;">${new Date().toUTCString()}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">HTTP Status Code:</td>
            <td style="padding: 10px 0; font-weight: 600; color: #1e293b; text-align: right;">${checkResult.httpStatusCode || 'N/A'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Response Time:</td>
            <td style="padding: 10px 0; font-weight: 600; color: #1e293b; text-align: right;">${checkResult.responseTimeMs} ms</td>
          </tr>
          ${checkResult.errorMessage ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Error Detail:</td>
            <td style="padding: 10px 0; font-weight: 600; color: #ef4444; text-align: right;">${checkResult.errorMessage}</td>
          </tr>` : ''}
        </table>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/websites/${website._id}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
            View Detailed History in Dashboard
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 14px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Automated alert generated by SiteSentinel Uptime Monitoring System
      </div>
    </div>
  `;

  const text = `SiteSentinel Alert: ${website.name} is now ${newStatus}. URL: ${website.url}. Timestamp: ${new Date().toISOString()}. Response time: ${checkResult.responseTimeMs}ms. Status code: ${checkResult.httpStatusCode || 'N/A'}. Error: ${checkResult.errorMessage || 'None'}`;

  return sendNotificationEmail({ to: recipient, subject, html, text });
};
