import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './NoProjectContainer.css';

const NoProjectContainer: React.FC = () => {
  const { actions } = useVulnerabilities();

  return (
    <div className="no-project-container">
      <div className="no-project-card">
        <div className="no-project-icon">
          <i className="fas fa-folder-open"></i>
        </div>
        <div className="no-project-content">
          <h3 className="no-project-title">Project Not Found</h3>
          <p className="no-project-description">
            This workspace hasn't been scanned by Corgea yet. Run a security scan to discover vulnerabilities in your code.
          </p>
          <div className="no-project-actions">
            <button 
              className="btn btn-primary scan-button d-flex align-items-center justify-content-center" 
              onClick={actions.scanProject}
            >
              <i className="fas fa-shield-alt"></i>
              &nbsp;Run Security Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoProjectContainer;
