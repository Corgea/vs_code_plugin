import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './ScanningError.css';

interface ScanningErrorProps {
  isCancelled?: boolean;
}

const ScanningError: React.FC<ScanningErrorProps> = ({ isCancelled = false }) => {
  const { state, actions } = useVulnerabilities();

  if (isCancelled) {
    return (
      <div className="scanning-error">
        <div className="error-icon">
          <i className="fas fa-times-circle" style={{ color: '#ff9500' }}></i>
        </div>
        <div className="error-message">Scan was cancelled</div>
        <div className="error-actions">
          <button className="btn btn-primary mt-3" onClick={actions.scanProject}>
            <i className="fas fa-play"></i>
            &nbsp;Start New Scan
          </button>
          <button className="btn btn-secondary mt-3 ml-2" onClick={actions.clearScanState}>
            <i className="fas fa-times"></i>
            &nbsp;Clear
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanning-error">
      <div className="error-icon">
        <i className="fas fa-exclamation-triangle"></i>
      </div>
      <div className="error-message">{state.scanState.error}</div>
      <button className="btn btn-primary mt-3" onClick={actions.scanProject}>
        <i className="fas fa-redo"></i>
        &nbsp;Try Again
      </button>
    </div>
  );
};

export default ScanningError;
