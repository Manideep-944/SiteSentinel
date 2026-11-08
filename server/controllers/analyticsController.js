import Website from '../models/Website.js';
import MonitoringCheck from '../models/MonitoringCheck.js';
import mongoose from 'mongoose';

/**
 * Helper to compute incidents from a chronological sequence of checks.
 */
function extractIncidents(checks, siteName) {
  // checks should be sorted in ascending chronological order
  const incidents = [];
  let currentIncident = null;

  for (const check of checks) {
    if (check.status === 'DOWN') {
      if (!currentIncident) {
        currentIncident = {
          websiteId: check.websiteId,
          websiteName: siteName || (check.websiteId ? check.websiteId.name : 'Unknown'),
          startedAt: check.checkedAt,
          resolvedAt: null,
          durationMs: null,
          httpStatusCode: check.httpStatusCode,
          failureType: check.failureType,
          errorMessage: check.errorMessage || 'Target endpoint was unreachable',
          isOngoing: true
        };
      }
    } else if (check.status === 'UP' && currentIncident) {
      currentIncident.resolvedAt = check.checkedAt;
      currentIncident.durationMs = new Date(check.checkedAt).getTime() - new Date(currentIncident.startedAt).getTime();
      currentIncident.isOngoing = false;
      incidents.push(currentIncident);
      currentIncident = null;
    }
  }

  if (currentIncident) {
    currentIncident.durationMs = Date.now() - new Date(currentIncident.startedAt).getTime();
    incidents.push(currentIncident);
  }

  // Return most recent incidents first
  return incidents.reverse();
}

export const getDashboardOverview = async (req, res, next) => {
  try {
    const ownerId = req.user._id;

    const websites = await Website.find({ ownerId });
    const totalWebsites = websites.length;
    const onlineWebsites = websites.filter(w => w.lastStatus === 'UP').length;
    const downWebsites = websites.filter(w => w.lastStatus === 'DOWN').length;
    const pendingWebsites = websites.filter(w => w.lastStatus === 'PENDING').length;

    // Aggregate checks across all websites of the user
    const totalChecks = await MonitoringCheck.countDocuments({ ownerId });
    const upChecks = await MonitoringCheck.countDocuments({ ownerId, status: 'UP' });
    const downChecks = totalChecks - upChecks;

    const uptimePercentage = totalChecks > 0 ? Number(((upChecks / totalChecks) * 100).toFixed(2)) : null;

    // Average response time for UP checks
    const avgResponseResult = await MonitoringCheck.aggregate([
      { $match: { ownerId, status: 'UP' } },
      { $group: { _id: null, avgResponse: { $avg: '$responseTimeMs' } } }
    ]);
    const avgResponseTimeMs = avgResponseResult.length > 0 ? Math.round(avgResponseResult[0].avgResponse) : null;

    // Recent 12 checks with website info
    const recentActivity = await MonitoringCheck.find({ ownerId })
      .sort({ checkedAt: -1 })
      .limit(12)
      .populate('websiteId', 'name url');

    // Aggregate recent response time trends for chart (last 24 hours or last 20 checks)
    const recentTrendChecks = await MonitoringCheck.find({ ownerId, status: 'UP' })
      .sort({ checkedAt: -1 })
      .limit(30)
      .populate('websiteId', 'name');

    const responseTrends = recentTrendChecks.reverse().map(c => ({
      time: new Date(c.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: c.checkedAt,
      site: c.websiteId ? c.websiteId.name : 'Unknown',
      responseTimeMs: c.responseTimeMs
    }));

    // Detect recent incidents from last 200 checks
    const incidentChecks = await MonitoringCheck.find({ ownerId })
      .sort({ checkedAt: 1 })
      .limit(300)
      .populate('websiteId', 'name url');

    const incidents = extractIncidents(incidentChecks).slice(0, 8);

    res.json({
      success: true,
      data: {
        totalWebsites,
        onlineWebsites,
        downWebsites,
        pendingWebsites,
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage,
        avgResponseTimeMs,
        responseTrends,
        recentActivity,
        incidents,
        statusDistribution: [
          { name: 'Online', value: onlineWebsites, color: '#10b981' },
          { name: 'Down', value: downWebsites, color: '#ef4444' },
          { name: 'Pending', value: pendingWebsites, color: '#f59e0b' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getWebsiteHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { range, status, page = 1, limit = 20 } = req.query;

    const website = await Website.findOne({ _id: id, ownerId: req.user._id });
    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found or unauthorized' });
    }

    const query = { websiteId: website._id };

    if (status && ['UP', 'DOWN'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }

    if (range) {
      const now = new Date();
      if (range === '24h') {
        query.checkedAt = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
      } else if (range === '7d') {
        query.checkedAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (range === '30d') {
        query.checkedAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const totalRecords = await MonitoringCheck.countDocuments(query);
    const checks = await MonitoringCheck.find(query)
      .sort({ checkedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: checks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getWebsiteAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { range = '7d' } = req.query;

    const website = await Website.findOne({ _id: id, ownerId: req.user._id });
    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found or unauthorized' });
    }

    const query = { websiteId: website._id };
    const now = new Date();
    if (range === '24h') {
      query.checkedAt = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
    } else if (range === '7d') {
      query.checkedAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (range === '30d') {
      query.checkedAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }

    const checks = await MonitoringCheck.find(query).sort({ checkedAt: 1 });

    const totalChecks = checks.length;
    const upChecks = checks.filter(c => c.status === 'UP').length;
    const downChecks = totalChecks - upChecks;
    const uptimePercentage = totalChecks > 0 ? Number(((upChecks / totalChecks) * 100).toFixed(2)) : null;

    const responseTimes = checks.filter(c => c.status === 'UP').map(c => c.responseTimeMs);
    const avgResponseTimeMs = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;
    const minResponseTimeMs = responseTimes.length > 0 ? Math.min(...responseTimes) : null;
    const maxResponseTimeMs = responseTimes.length > 0 ? Math.max(...responseTimes) : null;

    // Chart timeline (sampled if too many data points)
    const chartData = checks.map(c => ({
      timestamp: c.checkedAt,
      time: new Date(c.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      responseTimeMs: c.responseTimeMs,
      status: c.status,
      code: c.httpStatusCode
    }));

    // Calculate outages / incidents
    const incidents = extractIncidents(checks, website.name);

    res.json({
      success: true,
      data: {
        websiteId: website._id,
        name: website.name,
        url: website.url,
        currentStatus: website.lastStatus,
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage,
        avgResponseTimeMs,
        minResponseTimeMs,
        maxResponseTimeMs,
        chartData,
        incidents
      }
    });
  } catch (error) {
    next(error);
  }
};
