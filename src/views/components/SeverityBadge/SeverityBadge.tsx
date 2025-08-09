import React from 'react';
import './SeverityBadge.css';

interface SeverityBadgeProps {
  severity: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  // Severity mapping for consistent display (short format)
  const severityMap: { [key: string]: string } = {
    // Code vulnerabilities (already short)
    'HI': 'HI',
    'CR': 'CR',
    'ME': 'ME', 
    'LO': 'LO',
    // SCA vulnerabilities (convert to short)
    'CRITICAL': 'CR',
    'HIGH': 'HI',
    'MEDIUM': 'ME',
    'LOW': 'LO',
    'UNSPECIFIED': 'UN'
  };

  const getSeverityDisplay = (sev: string) => {
    return severityMap[sev?.toUpperCase()] || 'UN';
  };

  const displaySeverity = getSeverityDisplay(severity);

  return (
    <div className={`severity-badge ${displaySeverity.toLowerCase()}`}>
      {displaySeverity}
    </div>
  );
};

export default SeverityBadge;
