import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Globe, Clock, Timer, Loader2 } from 'lucide-react';

const WebsiteModal = ({ isOpen, onClose, onSave, editData = null }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editData) {
      setName(editData.name || '');
      setUrl(editData.url || '');
      setCheckIntervalMinutes(editData.checkIntervalMinutes || 5);
      setTimeoutMs(editData.timeoutMs || 10000);
    } else {
      setName('');
      setUrl('');
      setCheckIntervalMinutes(5);
      setTimeoutMs(10000);
    }
    setError('');
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a descriptive website name.');
      return;
    }

    if (!url.trim()) {
      setError('Please provide a valid website URL.');
      return;
    }

    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Only HTTP and HTTPS URLs are permitted.');
        return;
      }
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname.toLowerCase())) {
        setError('Localhost and loopback addresses are blocked by SSRF security policy.');
        return;
      }
    } catch {
      setError('Invalid URL format. Example: https://example.com');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        url: url.trim(),
        checkIntervalMinutes: Number(checkIntervalMinutes),
        timeoutMs: Number(timeoutMs)
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Globe className="text-primary" size={22} />
            <h3 className="modal-title">{editData ? 'Edit Website' : 'Add Monitored Website'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div className="alert alert-danger">
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="site-name">Website Name</label>
            <input
              id="site-name"
              type="text"
              className="form-input"
              placeholder="e.g., My Portfolio, Production API, College ERP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="site-url">Target Endpoint URL</label>
            <input
              id="site-url"
              type="url"
              className="form-input"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <span className="form-help">Must start with http:// or https://. Public addresses only.</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="site-interval">
                <Clock size={14} className="inline-icon" /> Check Interval
              </label>
              <select
                id="site-interval"
                className="form-select"
                value={checkIntervalMinutes}
                onChange={(e) => setCheckIntervalMinutes(Number(e.target.value))}
              >
                <option value={1}>Every 1 Minute (Local Demo)</option>
                <option value={2}>Every 2 Minutes</option>
                <option value={5}>Every 5 Minutes (Standard)</option>
                <option value={10}>Every 10 Minutes</option>
                <option value={30}>Every 30 Minutes</option>
                <option value={60}>Every 1 Hour</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="site-timeout">
                <Timer size={14} className="inline-icon" /> Timeout (ms)
              </label>
              <select
                id="site-timeout"
                className="form-select"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
              >
                <option value={3000}>3,000 ms (Fast)</option>
                <option value={5000}>5,000 ms (Recommended)</option>
                <option value={10000}>10,000 ms (Standard)</option>
                <option value={15000}>15,000 ms</option>
                <option value={30000}>30,000 ms (Lenient)</option>
              </select>
            </div>
          </div>

          <div className="security-notice-box">
            <ShieldAlert size={16} className="text-amber" />
            <div className="security-notice-text">
              <strong>SSRF Guard Active:</strong> Localhost, loopback IPs (127.0.0.1), RFC1918 private subnets (10.x, 192.168.x, 172.16-31.x), and cloud metadata endpoints are strictly blocked to prevent unauthorized intranet probes.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Validating...</span>
                </>
              ) : (
                <span>{editData ? 'Save Changes' : 'Start Monitoring'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WebsiteModal;
