import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import WebsiteModal from '../components/WebsiteModal';
import { websiteService } from '../services/websiteService';

const getPageTitle = (pathname) => {
  if (pathname === '/' || pathname === '/dashboard') return 'Overview Dashboard';
  if (pathname.startsWith('/websites/')) return 'Website Analytics';
  if (pathname === '/websites') return 'Monitored Websites';
  if (pathname === '/settings') return 'Settings & Diagnostics';
  return 'SiteSentinel';
};

const DashboardLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleAddWebsite = async (formData) => {
    await websiteService.createWebsite(formData);
    handleRefresh();
  };

  return (
    <div className="app-shell">
      <Sidebar
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="main-content-wrapper">
        <Navbar
          pageTitle={getPageTitle(location.pathname)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="dashboard-page-container">
          <Outlet context={{ openAddModal: () => setIsAddModalOpen(true), refreshKey, triggerRefresh: handleRefresh }} />
        </main>
      </div>

      <WebsiteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddWebsite}
      />
    </div>
  );
};

export default DashboardLayout;
