import React from 'react';
import { Menu, Plus, RefreshCw } from 'lucide-react';

const Navbar = ({ onOpenMobileMenu, onOpenAddModal, onRefresh, isRefreshing, pageTitle = 'Dashboard' }) => {
  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <button
          className="navbar-mobile-toggle"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>
        <div className="navbar-title-breadcrumb">
          <span className="navbar-breadcrumb-root">SiteSentinel</span>
          <span className="navbar-breadcrumb-separator">/</span>
          <h1 className="navbar-title">{pageTitle}</h1>
        </div>
      </div>

      <div className="navbar-right">
        {onRefresh && (
          <button
            className={`btn btn-outline-secondary btn-icon-only ${isRefreshing ? 'spinning' : ''}`}
            onClick={onRefresh}
            title="Refresh metrics"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} />
          </button>
        )}

        <button className="btn btn-primary btn-navbar-action" onClick={onOpenAddModal}>
          <Plus size={16} />
          <span>Add Website</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
