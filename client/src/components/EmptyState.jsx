import React from 'react';
import { Globe, Plus } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Globe,
  title = 'No websites monitored yet',
  description = 'Add your first HTTP/HTTPS target to start automated health checks and uptime monitoring.',
  actionText = 'Add Website',
  onAction
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={44} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {onAction && (
        <button onClick={onAction} className="btn btn-primary">
          <Plus size={16} />
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
