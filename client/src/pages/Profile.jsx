import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Bell,
  ShieldCheck,
  Server,
  Database,
  Clock,
  Key,
  CheckCircle,
  AlertCircle,
  Radio,
  Cpu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { analyticsService } from '../services/analyticsService';
import { formatDate } from '../utils/formatters';

const Profile = () => {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [alertEmail, setAlertEmail] = useState(user?.alertEmail || '');
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(user?.emailAlertsEnabled !== false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAlertEmail(user.alertEmail || '');
      setEmailAlertsEnabled(user.emailAlertsEnabled !== false);
    }
  }, [user]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setHealthLoading(true);
        const res = await analyticsService.getSystemHealth();
        setHealthData(res);
      } catch (err) {
        console.error('Failed to load system diagnostics:', err);
      } finally {
        setHealthLoading(false);
      }
    };

    fetchHealth();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    try {
      setIsSubmitting(true);
      await updateProfile({
        name,
        alertEmail,
        emailAlertsEnabled
      });
      setStatusMessage({ type: 'success', text: 'Profile preferences updated successfully.' });
    } catch (err) {
      setStatusMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (!currentPassword || !newPassword) {
      setPasswordMessage({ type: 'danger', text: 'Please fill in current and new password.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'danger', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'danger', text: 'Passwords do not match.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await updateProfile({
        currentPassword,
        newPassword
      });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header-actions mb-6">
        <div>
          <h2 className="page-title">Settings & System Diagnostics</h2>
          <p className="page-subtitle">Account preferences, notification channels, and live server telemetry</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Left Column: Account Settings */}
        <div className="profile-left-col">
          {/* User Profile Form */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex-align gap-2">
                <User size={18} className="text-primary" />
                <h3 className="card-title">User Account & Notification Settings</h3>
              </div>
            </div>

            <div className="card-body">
              {statusMessage.text && (
                <div className={`alert alert-${statusMessage.type} mb-4`}>
                  {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-name">Full Name</label>
                  <input
                    id="user-name"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-email">Account Email (Login)</label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-input"
                    value={user?.email || ''}
                    disabled
                  />
                  <span className="form-help">Primary login identifier cannot be modified.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-alert-email">Incident Notification Email</label>
                  <input
                    id="user-alert-email"
                    type="email"
                    className="form-input"
                    placeholder="alerts@domain.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                  />
                  <span className="form-help">Destination address for outage and recovery alert emails.</span>
                </div>

                <div className="form-group-checkbox mb-4">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={emailAlertsEnabled}
                      onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                    />
                    <span>Enable automated email notifications on state changes (UP ⇄ DOWN)</span>
                  </label>
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  Save Preferences
                </button>
              </form>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="card">
            <div className="card-header">
              <div className="flex-align gap-2">
                <Key size={18} className="text-primary" />
                <h3 className="card-title">Security & Password</h3>
              </div>
            </div>

            <div className="card-body">
              {passwordMessage.text && (
                <div className={`alert alert-${passwordMessage.type} mb-4`}>
                  {passwordMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label className="form-label" htmlFor="cur-pass">Current Password</label>
                  <input
                    id="cur-pass"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-pass">New Password</label>
                  <input
                    id="new-pass"
                    type="password"
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-new-pass">Confirm New Password</label>
                  <input
                    id="confirm-new-pass"
                    type="password"
                    className="form-input"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Live System & Viva Diagnostics */}
        <div className="profile-right-col">
          <div className="card diagnostics-card">
            <div className="card-header">
              <div className="flex-align gap-2">
                <Server size={18} className="text-cyan" />
                <h3 className="card-title">Live System Telemetry & Architecture</h3>
              </div>
              <span className="badge badge-up">ACTIVE</span>
            </div>

            <div className="card-body p-0">
              <div className="diagnostics-list">
                <div className="diag-item">
                  <div className="diag-icon-box">
                    <Database size={16} className="text-green" />
                  </div>
                  <div className="diag-info">
                    <div className="diag-label">MongoDB Database</div>
                    <div className="diag-val">
                      {healthData?.database?.connected ? (
                        <span className="text-green font-semibold">Connected (Local MERN Cluster)</span>
                      ) : (
                        <span className="text-danger font-semibold">Disconnected</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-icon-box">
                    <Clock size={16} className="text-blue" />
                  </div>
                  <div className="diag-info">
                    <div className="diag-label">Automated Monitoring Engine</div>
                    <div className="diag-val">
                      {healthData?.scheduler?.isActive ? (
                        <span className="text-blue font-semibold">
                          node-cron running (Tick every {healthData?.scheduler?.intervalMinutes}m)
                        </span>
                      ) : (
                        <span className="text-muted">Scheduler Standby</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-icon-box">
                    <ShieldCheck size={16} className="text-amber" />
                  </div>
                  <div className="diag-info">
                    <div className="diag-label">SSRF & DNS Rebinding Filter</div>
                    <div className="diag-val text-amber font-semibold">
                      Enforced (Blocks loopback, private subnets, cloud metadata)
                    </div>
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-icon-box">
                    <Mail size={16} className="text-purple" />
                  </div>
                  <div className="diag-info">
                    <div className="diag-label">SMTP Email Alert Dispatcher</div>
                    <div className="diag-val">
                      {healthData?.emailNotifications?.configured ? (
                        <span className="text-green font-semibold">Configured (Nodemailer ready)</span>
                      ) : (
                        <span className="text-muted">Optional: SMTP credentials not set (Logged safely to console)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-icon-box">
                    <Cpu size={16} className="text-cyan" />
                  </div>
                  <div className="diag-info">
                    <div className="diag-label">Runtime Environment</div>
                    <div className="diag-val text-slate-700 font-mono text-sm">
                      Node.js {healthData?.nodeVersion || 'v25+'} | Express 4.x | React 19 + Vite
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-top text-xs text-muted">
                <strong>Viva Note:</strong> Monitoring cycles run only while the backend server process is executing. Uptime metrics reflect actual MongoDB-recorded check outcomes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
