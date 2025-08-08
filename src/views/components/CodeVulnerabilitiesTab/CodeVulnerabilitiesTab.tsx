import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import VulnerabilityAccordion from '../VulnerabilityAccordion/VulnerabilityAccordion';
import EmptyState from '../EmptyState/EmptyState';
import './CodeVulnerabilitiesTab.css';

const CodeVulnerabilitiesTab: React.FC = () => {
  const { state } = useVulnerabilities();

  if (state.hasVulnerabilities) {
    return (
      <div className="code-vulnerabilities-tab">
        <VulnerabilityAccordion 
          fileGroups={state.fileGroups}
          vulnerabilities={state.vulnerabilities}
          type="code"
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
      icon="📝"
      title="No code vulnerabilities found in this project"
      description="Your code appears to be secure! Check the Dependencies tab for any potential supply chain vulnerabilities."
    />
  );
};

export default CodeVulnerabilitiesTab;
