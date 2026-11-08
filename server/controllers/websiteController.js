import Website from '../models/Website.js';
import MonitoringCheck from '../models/MonitoringCheck.js';
import { validateTargetUrl } from '../services/ssrfValidator.js';
import { performCheck } from '../services/monitorService.js';
import { logger } from '../utils/logger.js';

export const getWebsites = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = { ownerId: req.user._id };

    if (status && ['UP', 'DOWN', 'PENDING'].includes(status.toUpperCase())) {
      query.lastStatus = status.toUpperCase();
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } }
      ];
    }

    const websites = await Website.find(query).sort({ createdAt: -1 });

    // Calculate quick stats for each website
    const enrichedWebsites = await Promise.all(
      websites.map(async (site) => {
        const totalChecks = await MonitoringCheck.countDocuments({ websiteId: site._id });
        const upChecks = await MonitoringCheck.countDocuments({ websiteId: site._id, status: 'UP' });
        const uptimePercentage = totalChecks > 0 ? Number(((upChecks / totalChecks) * 100).toFixed(2)) : null;

        return {
          ...site.toObject(),
          totalChecks,
          uptimePercentage
        };
      })
    );

    res.json({
      success: true,
      count: enrichedWebsites.length,
      data: enrichedWebsites
    });
  } catch (error) {
    next(error);
  }
};

export const getWebsiteById = async (req, res, next) => {
  try {
    const website = await Website.findOne({ _id: req.params.id, ownerId: req.user._id });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or you do not have permission to access it.'
      });
    }

    // Compute overall uptime metrics
    const totalChecks = await MonitoringCheck.countDocuments({ websiteId: website._id });
    const upChecks = await MonitoringCheck.countDocuments({ websiteId: website._id, status: 'UP' });
    const uptimePercentage = totalChecks > 0 ? Number(((upChecks / totalChecks) * 100).toFixed(2)) : null;

    // Compute average response time
    const avgResult = await MonitoringCheck.aggregate([
      { $match: { websiteId: website._id, status: 'UP' } },
      { $group: { _id: null, avgResponse: { $avg: '$responseTimeMs' } } }
    ]);
    const avgResponseTimeMs = avgResult.length > 0 ? Math.round(avgResult[0].avgResponse) : null;

    res.json({
      success: true,
      data: {
        ...website.toObject(),
        totalChecks,
        uptimePercentage,
        avgResponseTimeMs
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createWebsite = async (req, res, next) => {
  try {
    const { name, url, checkIntervalMinutes, timeoutMs } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: 'Website name and valid URL are required.'
      });
    }

    // SSRF & IP Validation
    await validateTargetUrl(url);

    const website = await Website.create({
      ownerId: req.user._id,
      name: name.trim(),
      url: url.trim(),
      checkIntervalMinutes: Number(checkIntervalMinutes) || 5,
      timeoutMs: Number(timeoutMs) || 10000,
      isMonitoringEnabled: true,
      lastStatus: 'PENDING'
    });

    // Execute first check asynchronously in background so initial check status is recorded immediately
    performCheck(website._id, true).catch(err => {
      logger.error(`[Initial Check Error] Site ${website.name}: ${err.message}`);
    });

    res.status(201).json({
      success: true,
      message: 'Website added successfully. Initial health check dispatched.',
      data: website
    });
  } catch (error) {
    next(error);
  }
};

export const updateWebsite = async (req, res, next) => {
  try {
    const { name, url, checkIntervalMinutes, timeoutMs, isMonitoringEnabled } = req.body;
    const website = await Website.findOne({ _id: req.params.id, ownerId: req.user._id });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or unauthorized.'
      });
    }

    if (name) website.name = name.trim();
    if (checkIntervalMinutes) website.checkIntervalMinutes = Number(checkIntervalMinutes);
    if (timeoutMs) website.timeoutMs = Number(timeoutMs);
    if (isMonitoringEnabled !== undefined) website.isMonitoringEnabled = Boolean(isMonitoringEnabled);

    if (url && url.trim() !== website.url) {
      await validateTargetUrl(url);
      website.url = url.trim();
      website.lastStatus = 'PENDING';
      website.lastCheckedAt = null;
    }

    await website.save();

    res.json({
      success: true,
      message: 'Website updated successfully',
      data: website
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWebsite = async (req, res, next) => {
  try {
    const website = await Website.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or unauthorized.'
      });
    }

    // Cascade delete associated monitoring check logs
    const deleteResult = await MonitoringCheck.deleteMany({ websiteId: website._id });
    logger.info(`[Website Deleted] Removed site "${website.name}" and ${deleteResult.deletedCount} check logs.`);

    res.json({
      success: true,
      message: 'Website and monitoring history deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

export const triggerCheck = async (req, res, next) => {
  try {
    const website = await Website.findOne({ _id: req.params.id, ownerId: req.user._id });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or unauthorized.'
      });
    }

    const checkResult = await performCheck(website._id, true);

    const updatedWebsite = await Website.findById(website._id);

    res.json({
      success: true,
      message: 'Manual check completed',
      check: checkResult,
      website: updatedWebsite
    });
  } catch (error) {
    next(error);
  }
};

export const toggleMonitoring = async (req, res, next) => {
  try {
    const website = await Website.findOne({ _id: req.params.id, ownerId: req.user._id });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or unauthorized.'
      });
    }

    const { enabled } = req.body;
    website.isMonitoringEnabled = enabled !== undefined ? Boolean(enabled) : !website.isMonitoringEnabled;
    await website.save();

    res.json({
      success: true,
      message: `Monitoring ${website.isMonitoringEnabled ? 'resumed' : 'paused'} successfully`,
      data: website
    });
  } catch (error) {
    next(error);
  }
};

export const exportHistoryCsv = async (req, res, next) => {
  try {
    const website = await Website.findOne({ _id: req.params.id, ownerId: req.user._id });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or unauthorized.'
      });
    }

    const checks = await MonitoringCheck.find({ websiteId: website._id })
      .sort({ checkedAt: -1 })
      .limit(5000);

    const sanitizeCsv = (str) => {
      if (str === null || str === undefined) return '';
      const stringified = String(str).replace(/"/g, '""');
      return `"${stringified}"`;
    };

    let csvContent = 'Timestamp,Status,Response Time (ms),HTTP Status Code,Failure Type,Error Message,Resolved IP\r\n';

    for (const check of checks) {
      csvContent += [
        sanitizeCsv(check.checkedAt ? check.checkedAt.toISOString() : ''),
        sanitizeCsv(check.status),
        sanitizeCsv(check.responseTimeMs),
        sanitizeCsv(check.httpStatusCode || ''),
        sanitizeCsv(check.failureType || ''),
        sanitizeCsv(check.errorMessage || ''),
        sanitizeCsv(check.resolvedIp || '')
      ].join(',') + '\r\n';
    }

    const cleanFilename = `${website.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_history.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
