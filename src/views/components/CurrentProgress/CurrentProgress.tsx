import React from 'react';
import { ScanState } from '../../context/VulnerabilitiesContext';
import './CurrentProgress.css';

interface CurrentProgressProps {
  scanState: ScanState;
}

const CurrentProgress: React.FC<CurrentProgressProps> = ({ scanState }) => {
  const getLatestProgress = () => {
    if (!scanState.progress || scanState.progress.length === 0) return null;
    // Filter out "Scan url available" messages
    const filteredProgress = scanState.progress.filter(p => p.stage !== 'url_ready');
    return filteredProgress.length > 0 ? filteredProgress[filteredProgress.length - 1] : null;
  };

  const latestProgress = getLatestProgress();

  if (!latestProgress) {
    return null;
  }

  return (
    <div className="current-progress">
      <div className="progress-text">{latestProgress.message}</div>
      {latestProgress.percentage !== undefined && (
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${latestProgress.percentage}%` }}
            ></div>
          </div>
          <div className="progress-percentage">
            {latestProgress.percentage.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentProgress;
