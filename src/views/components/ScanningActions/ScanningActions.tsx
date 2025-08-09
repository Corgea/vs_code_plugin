import React from 'react';
import { useVulnerabilities, ScanState } from '../../context/VulnerabilitiesContext';
import './ScanningActions.css';

interface ScanningActionsProps {
  scanState: ScanState;
}

const ScanningActions: React.FC<ScanningActionsProps> = ({ scanState }) => {
  const { actions } = useVulnerabilities();

  return (
    <div className="scanning-actions">
      {scanState.scanUrl && (
        <button className="btn btn-primary me-2" onClick={actions.openScanUrl}>
          <i className="fas fa-external-link-alt"></i>
          &nbsp;View in Corgea
        </button>
      )}
      <button className="btn btn-secondary" onClick={actions.cancelScan}>
        <i className="fas fa-times"></i>
        &nbsp;Cancel Scan
      </button>
    </div>
  );
};

export default ScanningActions;
