import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import VulnerabilityAccordion from '../VulnerabilityAccordion/VulnerabilityAccordion';
import EmptyState from '../EmptyState/EmptyState';
import './SCAVulnerabilitiesTab.css';

const SCAVulnerabilitiesTab: React.FC = () => {
  const { state } = useVulnerabilities();

  if (state.hasSCAVulnerabilities) {
    return (
      <div className="sca-vulnerabilities-tab">
        <VulnerabilityAccordion 
          packageGroups={state.packageGroups}
          scaVulnerabilities={state.scaVulnerabilities}
          type="sca"
        />
      </div>
    );
  }

  if (state.isInScanningMode) {
    return (
      <EmptyState
        icon="🔍"
        title="No results found yet, hang tight..."
        description="Scan is in progress. Vulnerabilities will appear here as they are discovered."
      />
    );
  }

  return (
    <EmptyState
      icon="📦"
      title="No dependency vulnerabilities found in this project"
      description="Your dependencies are up to date and secure! Check the Code tab for any potential code-level vulnerabilities."
    />
  );
};

export default SCAVulnerabilitiesTab;
