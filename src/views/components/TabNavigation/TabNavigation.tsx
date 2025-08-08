import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './TabNavigation.css';

const TabNavigation: React.FC = () => {
  const { state, dispatch } = useVulnerabilities();

  const handleTabClick = (tab: 'code' | 'sca' | 'scanning') => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  };

  return (
    <ul className="nav nav-tabs" role="tablist">
      <li className="nav-item" role="presentation">
        <button
          className={`nav-link ${state.activeTab === 'code' ? 'active' : ''}`}
          onClick={() => handleTabClick('code')}
          type="button"
          role="tab"
        >
          <i className="fas fa-code"></i>
          &nbsp;Code
          {state.hasVulnerabilities && (
            <span className="count-badge">{state.vulnerabilities.length}</span>
          )}
        </button>
      </li>
      <li className="nav-item" role="presentation">
        <button
          className={`nav-link ${state.activeTab === 'sca' ? 'active' : ''}`}
          onClick={() => handleTabClick('sca')}
          type="button"
          role="tab"
        >
          <i className="fas fa-cube"></i>
          &nbsp;Dependencies
          {state.hasSCAVulnerabilities && (
            <span className="count-badge">{state.scaVulnerabilities.length}</span>
          )}
        </button>
      </li>
      <li className="nav-item" role="presentation">
        <button
          className={`nav-link ${state.activeTab === 'scanning' ? 'active' : ''}`}
          onClick={() => handleTabClick('scanning')}
          type="button"
          role="tab"
        >
          <i className="fas fa-search"></i>
          &nbsp;Scanning
          {state.scanState.isScanning && (
            <span className="count-badge scanning-indicator">
              <i className="fas fa-spinner fa-spin"></i>
            </span>
          )}
        </button>
      </li>
    </ul>
  );
};

export default TabNavigation;
