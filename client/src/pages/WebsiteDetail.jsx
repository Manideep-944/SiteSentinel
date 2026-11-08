import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Zap,
  Download,
  Play,
  Pause,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Loader2,
  Trash2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';
import { websiteService } from '../services/websiteService';
import { analyticsService } from '../services/analyticsService';
import { formatDate, formatTimeAgo, formatDuration, formatUptime } from '../utils/formatters';

const WebsiteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [website, setWebsite] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1, totalRecords: 0 });

  const [timeRange, setTimeRange] = useState('7d');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch website details and analytics
  const fetchWebsiteData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [siteRes, analyticsRes] = await Promise.all([
        websiteService.getWebsiteById(id),
        analyticsService.getWebsiteAnalytics(id, { range: timeRange })
      ]);

      if (siteRes.success) setWebsite(siteRes.data);
      if (analyticsRes.success) setAnalytics(analyticsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load website analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch check history table
  const fetchHistory = async () => {
    try {
      const params = {
        range: timeRange,
        page: currentPage,
        limit: 15
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await analyticsService.getWebsiteHistory(id, params);
      if (res.success) {
        setHistory(res.data);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch check history:', err);
    }
  };

  useEffect(() => {
    fetchWebsiteData();
  }, [id, timeRange]);

  useEffect(() => {
    fetchHistory();
  }, [id, timeRange, statusFilter, currentPage]);

  const handleManualCheck = async () => {
    try {
      setIsChecking(true);
      await websiteService.triggerCheck(id);
      await Promise.all([fetchWebsiteData(), fetchHistory()]);
    } catch (err) {
      alert(`Check failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      const res = await websiteService.toggleMonitoring(id, !website.isMonitoringEnabled);
      if (res.success) {
        setWebsite(prev => ({ ...prev, isMonitoringEnabled: res.data.isMonitoringEnabled }));
      }
    } catch (err) {
      alert(`Toggle failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const filename = `${website.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_history.csv`;
      await websiteService.downloadCsv(id, filename);
    } catch (err) {
      alert(`CSV Export failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Permanently delete "${website.name}" and all historical data?`)) {
      try {
        await websiteService.deleteWebsite(id);
        navigate('/websites');
      } catch (err) {
        alert(`Delete failed: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  if (loading && !website) {
    return <LoadingSpinner message="Loading endpoint analytics & history..." />;
  }

  if (error || !website) {
    return (
      <div className="detail-error-wrapper">
        <div className="alert alert-danger mb-4">
          <AlertTriangle size={20} />
          <span>{error || 'Website not found'}</span>
        </div>
        <Link to="/websites" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Back to Websites
        </Link>
      </div>
    );
  }

  const { chartData = [], incidents = [] } = analytics || {};

  return (
    <div className="website-detail-page">
      {/* Top Navigation Row */}
      <div className="detail-top-nav">
        <Link to="/websites" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Websites</span>
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="detail-hero-card">
        <div className="hero-left">
          <div className="hero-title-row">
            <h1 className="hero-name">{website.name}</h1>
            <StatusBadge
              status={website.lastStatus}
              isMonitoringEnabled={website.isMonitoringEnabled}
              size="large"
            />
          </div>

          <div className="hero-meta-row">
            <a
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-url-link"
            >
              <span>{website.url}</span>
              <ExternalLink size={13} />
            </a>

            <span className="hero-separator">•</span>
            <span className="hero-meta-item">
              <Clock size={13} className="inline-icon" />
              Interval: Every {website.checkIntervalMinutes} min
            </span>

            <span className="hero-separator">•</span>
            <span className="hero-meta-item">
              Timeout: {website.timeoutMs}ms
            </span>

            <span className="hero-separator">•</span>
            <span className="hero-meta-item">
              Last probe: {formatTimeAgo(website.lastCheckedAt)}
            </span>
          </div>

          {website.lastStatus === 'DOWN' && website.lastErrorMessage && (
            <div className="alert alert-danger mt-2" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{website.lastErrorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="hero-actions">
          <button
            className="btn btn-secondary btn-hero"
            onClick={handleToggleMonitoring}
            title={website.isMonitoringEnabled ? 'Pause automated monitoring' : 'Resume automated monitoring'}
          >
            {website.isMonitoringEnabled ? (
              <>
                <Pause size={15} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            className="btn btn-primary btn-hero"
            onClick={handleManualCheck}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <Loader2 size={15} className="spinner-icon" />
                <span>Probing...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Check Now</span>
              </>
            )}
          </button>

          <button
            className="btn btn-outline-secondary btn-hero"
            onClick={handleExportCsv}
            disabled={isExporting}
            title="Download full history as CSV spreadsheet"
          >
            <Download size={15} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          <button
            className="btn btn-outline-danger btn-icon-only"
            onClick={handleDelete}
            title="Delete this endpoint"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="stats-grid mb-6">
        <StatCard
          title="Recorded Uptime"
          value={formatUptime(analytics?.uptimePercentage)}
          subtitle={`${analytics?.upChecks || 0} UP / ${analytics?.totalChecks || 0} checks`}
          icon={Activity}
          color={analytics?.uptimePercentage && analytics?.uptimePercentage > 95 ? 'green' : 'amber'}
        />

        <StatCard
          title="Avg Latency"
          value={analytics?.avgResponseTimeMs ? `${analytics.avgResponseTimeMs} ms` : '—'}
          subtitle="During operational state"
          icon={Zap}
          color="blue"
        />

        <StatCard
          title="Min / Max Latency"
          value={
            analytics?.minResponseTimeMs !== null && analytics?.maxResponseTimeMs !== null
              ? `${analytics.minResponseTimeMs} / ${analytics.maxResponseTimeMs} ms`
              : '—'
          }
          subtitle="Observed extremes"
          icon={Clock}
          color="cyan"
        />

        <StatCard
          title="Last Status Code"
          value={website.lastHttpStatusCode || '—'}
          subtitle={website.lastErrorMessage || 'HTTP Response Code'}
          icon={CheckCircle2}
          color={website.lastStatus === 'UP' ? 'green' : 'red'}
        />
      </div>

      {/* Latency History Chart Card */}
      <div className="card chart-card mb-6">
        <div className="card-header space-between">
          <div>
            <h3 className="card-title">Response Time Trend</h3>
            <p className="card-subtitle">Latency graph for selected window</p>
          </div>

          <div className="range-selector">
            <button
              className={`range-btn ${timeRange === '24h' ? 'active' : ''}`}
              onClick={() => setTimeRange('24h')}
            >
              24 Hours
            </button>
            <button
              className={`range-btn ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              7 Days
            </button>
            <button
              className={`range-btn ${timeRange === '30d' ? 'active' : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30 Days
            </button>
          </div>
        </div>

        <div className="card-body chart-body">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="detailGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
                  formatter={(val, name, item) => [
                    `${val} ms (Status: ${item.payload.status}, Code: ${item.payload.code || 'N/A'})`,
                    'Latency'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="responseTimeMs"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#detailGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-placeholder">
              <Clock size={32} className="text-muted" />
              <p>No check data recorded in this time range.</p>
            </div>
          )}
        </div>
      </div>

      {/* Outage and Incident Timeline Section */}
      <div className="card table-card mb-6">
        <div className="card-header">
          <div>
            <h3 className="card-title">Outages & Incident Timeline</h3>
            <p className="card-subtitle">Detected downtime spans derived from consecutive checks</p>
          </div>
        </div>
        <div className="card-body p-0">
          {incidents.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Outage Started</th>
                    <th>Resolved At</th>
                    <th>Total Downtime</th>
                    <th>Failure Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc, i) => (
                    <tr key={i}>
                      <td className="text-slate-800 font-medium">
                        {formatDate(inc.startedAt)}
                      </td>
                      <td className="text-muted text-sm">
                        {inc.isOngoing ? (
                          <span className="badge badge-down">Ongoing Outage</span>
                        ) : (
                          formatDate(inc.resolvedAt)
                        )}
                      </td>
                      <td className="font-semibold">
                        {formatDuration(inc.durationMs)}
                      </td>
                      <td className="text-danger text-sm font-mono">
                        {inc.errorMessage || 'Target unreachable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-empty-notice">
              <ShieldCheck size={28} className="text-green" />
              <span>No outages recorded! The target has maintained full reliability.</span>
            </div>
          )}
        </div>
      </div>

      {/* Check History Log Table with Pagination and Status Filter */}
      <div className="card table-card">
        <div className="card-header space-between flex-wrap gap-2">
          <div>
            <h3 className="card-title">Detailed Check Log</h3>
            <p className="card-subtitle">Showing {history.length} of {pagination.totalRecords} logged checks</p>
          </div>

          <div className="history-filter-group">
            <button
              className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            >
              All
            </button>
            <button
              className={`filter-pill ${statusFilter === 'UP' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('UP'); setCurrentPage(1); }}
            >
              UP
            </button>
            <button
              className={`filter-pill ${statusFilter === 'DOWN' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('DOWN'); setCurrentPage(1); }}
            >
              DOWN
            </button>
          </div>
        </div>

        <div className="card-body p-0">
          {history.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>HTTP Code</th>
                    <th>Failure Type</th>
                    <th>Resolved IP</th>
                    <th>Details / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((check) => (
                    <tr key={check._id}>
                      <td className="text-sm font-medium text-slate-800">
                        {formatDate(check.checkedAt)}
                      </td>
                      <td>
                        <StatusBadge status={check.status} size="small" />
                      </td>
                      <td className="font-mono text-sm">
                        {check.responseTimeMs} ms
                      </td>
                      <td>
                        <span className={`http-code-pill code-${String(check.httpStatusCode || 0)[0]}xx`}>
                          {check.httpStatusCode || 'FAIL'}
                        </span>
                      </td>
                      <td className="text-sm text-slate-600 font-mono">
                        {check.failureType || 'NONE'}
                      </td>
                      <td className="text-sm text-slate-500 font-mono">
                        {check.resolvedIp || '—'}
                      </td>
                      <td className="text-sm text-slate-600" title={check.errorMessage}>
                        {check.errorMessage || 'Success (2xx/3xx OK)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-empty-notice">
              <Clock size={28} className="text-muted" />
              <span>No historical check records found matching current filters.</span>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <div className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="pagination-buttons">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebsiteDetail;
