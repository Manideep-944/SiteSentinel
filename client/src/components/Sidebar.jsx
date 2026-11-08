import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  Settings,
  ShieldCheck,
  LogOut,
  Radio,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();

  return (
    <>
      {isMobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`app-sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo-container">
            <ShieldCheck size={28} className="brand-icon" />
            <span className="brand-pulse-beacon" />
          </div>
          <div className="brand-text-container">
            <span className="brand-title">SiteSentinel</span>
            <span className="brand-badge">PRO MONITOR</span>
          </div>
        </div>

        <div className="sidebar-system-pill">
          <Radio size={12} className="pulse-green text-green" />
          <span>Realtime Engine Active</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">MONITORING</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/websites"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <Globe size={19} />
            <span>Monitored Sites</span>
          </NavLink>

          <div className="nav-section-label">MANAGEMENT</div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <Settings size={19} />
            <span>Settings & Diagnostics</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-widget">
            <div className="user-avatar-circle">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-meta">
              <span className="user-name" title={user?.name}>{user?.name || 'Operator'}</span>
              <span className="user-email" title={user?.email}>{user?.email || 'user@local'}</span>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={logout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
