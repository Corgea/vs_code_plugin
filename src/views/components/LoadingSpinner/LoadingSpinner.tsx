import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <div>Loading vulnerabilities...</div>
    </div>
  );
};

export default LoadingSpinner;
