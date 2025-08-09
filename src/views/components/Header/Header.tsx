import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './Header.css';

const Header: React.FC = () => {
  const { state, actions } = useVulnerabilities();

  const logoSrc = window.initialData?.logoURI || '';

  return (
    <div className="header">
      <div className="header-left">
        <img className="logo" src={logoSrc} alt="Corgea Logo" />
        <div className="title">Vulnerabilities</div>
      </div>
      {state.isAuthenticated && (
        <div className="header-actions">
          {state.isInScanningMode ? (
            <button 
              className={`auto-refresh-btn ${state.autoRefreshEnabled ? 'auto-refresh-enabled' : ''}`}
              onClick={actions.toggleAutoRefresh}
            >
              <i className={`fas fa-sync-alt ${state.autoRefreshEnabled ? 'fa-spin' : ''}`}></i>
              &nbsp;Auto-refresh
            </button>
          ) : (
            <button className="refresh-btn" onClick={actions.refresh}>
              <i className="fas fa-refresh"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Header;
