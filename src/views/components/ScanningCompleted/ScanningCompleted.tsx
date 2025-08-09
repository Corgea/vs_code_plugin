import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './ScanningCompleted.css';

const ScanningCompleted: React.FC = () => {
  const { state, actions } = useVulnerabilities();

  return (
    <div className="scanning-completed">
      <div className="completed-icon">
        <i className="fas fa-check-circle"></i>
      </div>
      <div className="completed-message">Scan completed successfully!</div>
      <div className="completed-actions mt-3">
        {state.scanState.scanUrl && (
          <button className="btn btn-primary me-2" onClick={actions.openScanUrl}>
            <i className="fas fa-external-link-alt"></i>
            &nbsp;View Results in Corgea
          </button>
        )}
        <button className="btn btn-secondary" onClick={actions.scanProject}>
          <i className="fas fa-redo"></i>
          &nbsp;Scan Again
        </button>
      </div>
    </div>
  );
};

export default ScanningCompleted;
