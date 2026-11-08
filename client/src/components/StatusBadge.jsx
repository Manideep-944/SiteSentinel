import React from 'react';

const StatusBadge = ({ status, isMonitoringEnabled = true, size = 'normal' }) => {
  if (isMonitoringEnabled === false) {
    return (
      <span className={`status-badge badge-paused badge-${size}`}>
        <span className="dot dot-paused"></span>
        PAUSED
      </span>
    );
  }

  const normalized = (status || 'PENDING').toUpperCase();

  switch (normalized) {
    case 'UP':
      return (
        <span className={`status-badge badge-up badge-${size}`}>
          <span className="dot dot-up"></span>
          ONLINE
        </span>
      );
    case 'DOWN':
      return (
        <span className={`status-badge badge-down badge-${size}`}>
          <span className="dot dot-down"></span>
          DOWN
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className={`status-badge badge-pending badge-${size}`}>
          <span className="dot dot-pending"></span>
          PENDING
        </span>
      );
  }
};

export default StatusBadge;
