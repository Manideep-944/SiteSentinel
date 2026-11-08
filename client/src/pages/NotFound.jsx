import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="notfound-container">
      <div className="notfound-card">
        <div className="notfound-icon-wrapper">
          <ShieldAlert size={64} className="text-amber" />
        </div>
        <h1 className="notfound-code">404</h1>
        <h2 className="notfound-title">Resource Not Found</h2>
        <p className="notfound-desc">
          The endpoint, route, or resource you were looking for does not exist or has been relocated.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">
            <Home size={16} />
            <span>Return to Dashboard</span>
          </Link>
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
