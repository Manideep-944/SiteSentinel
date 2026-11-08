import React from 'react';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', trend }) => {
  return (
    <div className={`stat-card border-top-${color}`}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div className={`stat-icon-wrapper bg-${color}-subtle text-${color}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      </div>
      {trend && (
        <div className={`stat-card-trend trend-${trend.direction}`}>
          <span>{trend.text}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
