import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import TabNavigation from '../TabNavigation/TabNavigation';
import CodeVulnerabilitiesTab from '../CodeVulnerabilitiesTab/CodeVulnerabilitiesTab';
import SCAVulnerabilitiesTab from '../SCAVulnerabilitiesTab/SCAVulnerabilitiesTab';
import ScanningTab from '../ScanningTab/ScanningTab';
import './TabsContainer.css';

const TabsContainer: React.FC = () => {
  const { state } = useVulnerabilities();

  const renderActiveTab = () => {
    switch (state.activeTab) {
      case 'code':
        return <CodeVulnerabilitiesTab />;
      case 'sca':
        return <SCAVulnerabilitiesTab />;
      case 'scanning':
        return <ScanningTab />;
      default:
        return <CodeVulnerabilitiesTab />;
    }
  };

  return (
    <div className="tabs-container">
      <TabNavigation />
      <div className="tab-content">
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default TabsContainer;
