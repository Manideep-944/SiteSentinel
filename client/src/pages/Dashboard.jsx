import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Plus,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  AlertOctagon,
  Radio
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { analyticsService } from '../services/analyticsService';
import { formatTimeAgo, formatDuration } from '../utils/formatters';

const Dashboard = () => {
  const { openAddModal, refreshKey } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await analyticsService.getDashboardOverview();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [refreshKey]);

  if (loading && !data) {
    return <LoadingSpinner message="Aggregating live telemetry..." />;
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <AlertTriangle size={20} />
        <div>
          <strong>Error loading dashboard:</strong> {error}
        </div>
      </div>
    );
  }

  const {
    totalWebsites = 0,
    onlineWebsites = 0,
    downWebsites = 0,
    uptimePercentage = null,
    avgResponseTimeMs = null,
    responseTrends = [],
    recentActivity = [],
    incidents = [],
    statusDistribution = []
  } = data || {};

  if (totalWebsites === 0) {
    return (
      <EmptyState
        title="Welcome to SiteSentinel"
        description="You have no websites configured for monitoring yet. Add your first public website or API endpoint to begin tracking uptime and latency."
        actionText="Add Monitored Website"
        onAction={openAddModal}
      />
    );
  }

  const uptimeDisplay = uptimePercentage !== null ? `${uptimePercentage}%` : 'No data available';
  const avgResponseDisplay = avgResponseTimeMs !== null ? `${avgResponseTimeMs} ms` : 'No data';

  return (
    <div className="dashboard-content">
      {/* Top Banner Notice */}
      <div className="monitoring-status-banner">
        <div className="banner-left">
          <Radio size={16} className="text-cyan pulse-dot" />
          <span>Automated node-cron scheduler is tracking <strong>{totalWebsites}</strong> target(s).</span>
        </div>
        <div className="banner-right">
          <span className="uptime-disclaimer-pill" title="Metric reflects successful checks over total recorded checks in database">
            * Recorded-check uptime metric
          </span>
        </div>
      </div>

      {/* Top 5 Stat Cards */}
      <div className="stats-grid">
        <StatCard
          title="Monitored Targets"
          value={totalWebsites}
          subtitle="Configured endpoints"
          icon={Globe}
          color="blue"
        />

        <StatCard
          title="Operational (Online)"
          value={onlineWebsites}
          subtitle={`${Math.round((onlineWebsites / (totalWebsites || 1)) * 100)}% of sites UP`}
          icon={CheckCircle2}
          color="green"
        />

        <StatCard
          title="Disrupted (Down)"
          value={downWebsites}
          subtitle={downWebsites > 0 ? 'Active outage detected' : 'All systems normal'}
          icon={AlertTriangle}
          color={downWebsites > 0 ? 'red' : 'slate'}
        />

        <StatCard
          title="Average Latency"
          value={avgResponseDisplay}
          subtitle="Across healthy checks"
          icon={Zap}
          color="cyan"
        />

        <StatCard
          title="Recorded Uptime"
          value={uptimeDisplay}
          subtitle="Success / total checks"
          icon={Activity}
          color={uptimePercentage && uptimePercentage > 95 ? 'green' : 'amber'}
        />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Latency History Chart */}
        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Response Time Telemetry</h3>
              <p className="card-subtitle">Real-time latency (ms) measured by backend HTTP probes</p>
            </div>
          </div>
          <div className="card-body chart-body">
            {responseTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={responseTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="ms" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
                    formatter={(val, name, item) => [`${val} ms (${item.payload.site})`, 'Response Time']}
                  />
                  <Area
                    type="monotone"
                    dataKey="responseTimeMs"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-placeholder">
                <Clock size={32} className="text-muted" />
                <p>Not enough telemetry data points yet. Run health checks to generate chart trends.</p>
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Fleet Health Distribution</h3>
              <p className="card-subtitle">Current status breakdown</p>
            </div>
          </div>
          <div className="card-body chart-body donut-chart-container">
            {statusDistribution.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
                    formatter={(value, name) => [`${value} Site(s)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-placeholder">
                <Globe size={32} className="text-muted" />
                <p>No websites configured.</p>
              </div>
            )}
            <div className="donut-legend">
              {statusDistribution.map((item, idx) => (
                <div key={idx} className="donut-legend-item">
                  <span className="legend-indicator" style={{ backgroundColor: item.color }} />
                  <span className="legend-name">{item.name}:</span>
                  <span className="legend-count">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="tables-grid">
        {/* Recent Incidents Table */}
        <div className="card table-card">
          <div className="card-header space-between">
            <div>
              <h3 className="card-title">Recent Outages & Incidents</h3>
              <p className="card-subtitle">Detected failures from consecutive checks</p>
            </div>
          </div>
          <div className="card-body p-0">
            {incidents.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Outage Started</th>
                      <th>Duration</th>
                      <th>Error Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident, i) => (
                      <tr key={i}>
                        <td className="font-semibold text-slate-800">
                          {incident.websiteName}
                        </td>
                        <td className="text-muted text-sm">
                          {formatTimeAgo(incident.startedAt)}
                        </td>
                        <td>
                          {incident.isOngoing ? (
                            <span className="badge badge-down">Ongoing Outage</span>
                          ) : (
                            <span className="badge badge-slate">Resolved ({formatDuration(incident.durationMs)})</span>
                          )}
                        </td>
                        <td className="text-danger text-sm font-mono" title={incident.errorMessage}>
                          {incident.errorMessage?.substring(0, 45) || 'Connection failed'}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-empty-notice">
                <ShieldCheck size={28} className="text-green" />
                <span>Zero incidents recorded. All systems performing reliably!</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="card table-card">
          <div className="card-header space-between">
            <div>
              <h3 className="card-title">Live Check Activity</h3>
              <p className="card-subtitle">Latest backend probes</p>
            </div>
            <Link to="/websites" className="text-link-sm">
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="card-body p-0">
            {recentActivity.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Code</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((act) => (
                      <tr key={act._id}>
                        <td className="font-medium text-slate-800">
                          {act.websiteId?.name || 'Target Endpoint'}
                        </td>
                        <td>
                          <StatusBadge status={act.status} size="small" />
                        </td>
                        <td className="font-mono text-sm">
                          {act.responseTimeMs} ms
                        </td>
                        <td>
                          <span className={`http-code-pill code-${String(act.httpStatusCode || 0)[0]}xx`}>
                            {act.httpStatusCode || 'FAIL'}
                          </span>
                        </td>
                        <td className="text-muted text-sm">
                          {formatTimeAgo(act.checkedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-empty-notice">
                <Clock size={28} className="text-muted" />
                <span>No checks recorded yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
