import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './ScanningIdle.css';

const ScanningIdle: React.FC = () => {
  const { actions } = useVulnerabilities();

  return (
    <div className="scanning-idle">
      <div className="idle-icon">
        <i className="fas fa-search"></i>
      </div>
      <div className="idle-message">
        Start a security scan to analyze your code for vulnerabilities
      </div>
      <button className="btn btn-primary mt-3" onClick={actions.scanProject}>
        <i className="fas fa-play"></i>
        &nbsp;Start Scan
      </button>
    </div>
  );
};

export default ScanningIdle;
