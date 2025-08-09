import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import ScanningProgress from '../ScanningProgress/ScanningProgress';
import ScanningError from '../ScanningError/ScanningError';
import ScanningCompleted from '../ScanningCompleted/ScanningCompleted';
import ScanningIdle from '../ScanningIdle/ScanningIdle';
import TerminalOutput from '../TerminalOutput/TerminalOutput';
import './ScanningTab.css';

const ScanningTab: React.FC = () => {
  const { state } = useVulnerabilities();
  const { scanState } = state;

  const renderScanContent = () => {
    if (scanState.isScanning) {
      return <ScanningProgress />;
    } else if (scanState.error) {
      return <ScanningError />;
    } else if (scanState.progress && scanState.progress.some(p => p.stage === 'completed')) {
      return <ScanningCompleted />;
    } else if (scanState.progress && scanState.progress.some(p => p.stage === 'cancelled')) {
      return <ScanningError isCancelled={true} />;
    } else {
      return <ScanningIdle />;
    }
  };

  return (
    <div className="scanning-container">
      {renderScanContent()}
      {scanState.output && scanState.output.length > 0 && (
        <TerminalOutput output={scanState.output} />
      )}
    </div>
  );
};

export default ScanningTab;
