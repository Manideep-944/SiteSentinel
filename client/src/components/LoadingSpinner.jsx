import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ size = 28, message = 'Loading...' }) => {
  return (
    <div className="spinner-container">
      <Loader2 size={size} className="spinner-icon" />
      {message && <span className="spinner-message">{message}</span>}
    </div>
  );
};

export default LoadingSpinner;
