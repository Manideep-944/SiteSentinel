import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Globe,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Play,
  Pause,
  Edit2,
  Trash2,
  Activity,
  AlertCircle,
  Clock,
  Zap,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import WebsiteModal from '../components/WebsiteModal';
import { websiteService } from '../services/websiteService';
import { formatTimeAgo, formatUptime } from '../utils/formatters';

const Websites = () => {
  const { openAddModal, refreshKey, triggerRefresh } = useOutletContext() || {};
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [checkingIds, setCheckingIds] = useState(new Set());
  const [editSite, setEditSite] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchWebsites = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL' && statusFilter !== 'PAUSED') {
        params.status = statusFilter;
      }
      const res = await websiteService.getWebsites(params);
      if (res.success) {
        let list = res.data;
        if (statusFilter === 'PAUSED') {
          list = list.filter(w => !w.isMonitoringEnabled);
        }
        setWebsites(list);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to load monitored websites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, [refreshKey, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchWebsites();
  };

  const handleManualCheck = async (id, e) => {
    e.stopPropagation();
    try {
      setCheckingIds(prev => new Set(prev).add(id));
      await websiteService.triggerCheck(id);
      fetchWebsites();
      if (triggerRefresh) triggerRefresh();
    } catch (err) {
      alert(`Manual check error: ${err.response?.data?.message || err.message}`);
    } finally {
      setCheckingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleMonitoring = async (id, currentEnabled, e) => {
    e.stopPropagation();
    try {
      await websiteService.toggleMonitoring(id, !currentEnabled);
      fetchWebsites();
      if (triggerRefresh) triggerRefresh();
    } catch (err) {
      alert(`Failed to toggle monitoring: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await websiteService.deleteWebsite(id);
      setDeleteConfirmId(null);
      fetchWebsites();
      if (triggerRefresh) triggerRefresh();
    } catch (err) {
      alert(`Failed to delete website: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleSaveEdit = async (data) => {
    if (!editSite) return;
    await websiteService.updateWebsite(editSite._id, data);
    setIsEditModalOpen(false);
    setEditSite(null);
    fetchWebsites();
    if (triggerRefresh) triggerRefresh();
  };

  return (
    <div className="websites-page">
      {/* Page Header Bar */}
      <div className="page-header-actions">
        <div>
          <h2 className="page-title">Monitored Websites</h2>
          <p className="page-subtitle">Manage target endpoints, schedules, and health thresholds</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          <span>Add Website</span>
        </button>
      </div>

      {errorMsg && (
        <div className="alert alert-danger mb-4">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <form onSubmit={handleSearchSubmit} className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Sites
          </button>
          <button
            className={`filter-tab ${statusFilter === 'UP' ? 'active' : ''}`}
            onClick={() => setStatusFilter('UP')}
          >
            Online
          </button>
          <button
            className={`filter-tab ${statusFilter === 'DOWN' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DOWN')}
          >
            Down
          </button>
          <button
            className={`filter-tab ${statusFilter === 'PAUSED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PAUSED')}
          >
            Paused
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Fetching monitored targets..." />
      ) : websites.length === 0 ? (
        <EmptyState
          title={search ? 'No matching websites found' : 'No monitored websites'}
          description={
            search
              ? `No endpoints matched "${search}". Try clearing your search query.`
              : 'Add your first HTTP/HTTPS target to initiate automated health checks.'
          }
          actionText={search ? 'Clear Search' : 'Add Website'}
          onAction={search ? () => { setSearch(''); fetchWebsites(); } : openAddModal}
        />
      ) : (
        <div className="websites-grid">
          {websites.map((site) => {
            const isChecking = checkingIds.has(site._id);
            return (
              <div key={site._id} className="website-card">
                <div className="website-card-top">
                  <div className="website-header-left">
                    <StatusBadge
                      status={site.lastStatus}
                      isMonitoringEnabled={site.isMonitoringEnabled}
                    />
                    <h3 className="website-name" title={site.name}>
                      <Link to={`/websites/${site._id}`}>{site.name}</Link>
                    </h3>
                  </div>

                  <div className="website-actions-menu">
                    <button
                      className="btn-action-icon"
                      title={site.isMonitoringEnabled ? 'Pause automated monitoring' : 'Resume automated monitoring'}
                      onClick={(e) => handleToggleMonitoring(site._id, site.isMonitoringEnabled, e)}
                    >
                      {site.isMonitoringEnabled ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      className="btn-action-icon"
                      title="Edit site settings"
                      onClick={() => {
                        setEditSite(site);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      className="btn-action-icon btn-action-danger"
                      title="Delete website"
                      onClick={() => setDeleteConfirmId(site._id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="website-url-row">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="website-url-link"
                    title={site.url}
                  >
                    <span>{site.url}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {site.lastStatus === 'DOWN' && site.lastErrorMessage && (
                  <div className="website-error-banner" title={site.lastErrorMessage}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span className="error-banner-text">{site.lastErrorMessage}</span>
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="website-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-label">Latency</span>
                    <span className="metric-value font-mono">
                      {site.lastResponseTimeMs !== null ? `${site.lastResponseTimeMs} ms` : '—'}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">HTTP Code</span>
                    <span className="metric-value font-mono">
                      {site.lastHttpStatusCode ? (
                        <span className={`code-${String(site.lastHttpStatusCode)[0]}xx-text`}>
                          {site.lastHttpStatusCode}
                        </span>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Check Uptime</span>
                    <span className="metric-value">
                      {formatUptime(site.uptimePercentage)}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Interval</span>
                    <span className="metric-value">
                      {site.checkIntervalMinutes} min
                    </span>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="website-card-footer">
                  <div className="last-checked-meta" title={site.lastCheckedAt}>
                    <Clock size={13} className="inline-icon text-muted" />
                    <span>{formatTimeAgo(site.lastCheckedAt)}</span>
                  </div>

                  <div className="card-footer-buttons">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => handleManualCheck(site._id, e)}
                      disabled={isChecking}
                      title="Trigger an immediate HTTP status probe"
                    >
                      {isChecking ? (
                        <>
                          <Loader2 size={13} className="spinner-icon" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} />
                          <span>Check Now</span>
                        </>
                      )}
                    </button>

                    <Link to={`/websites/${site._id}`} className="btn btn-primary btn-sm">
                      <Activity size={13} />
                      <span>Details</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title text-danger">Confirm Deletion</h3>
            </div>
            <div className="modal-body p-4">
              <p>Are you sure you want to permanently delete this website and its entire recorded monitoring history?</p>
              <p className="text-muted text-sm mt-2">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirmId)}>
                Delete Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Website Modal */}
      <WebsiteModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditSite(null);
        }}
        onSave={handleSaveEdit}
        editData={editSite}
      />
    </div>
  );
};

export default Websites;
