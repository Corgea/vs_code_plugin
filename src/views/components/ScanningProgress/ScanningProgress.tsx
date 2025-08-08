import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import ProgressSteps from '../ProgressSteps/ProgressSteps';
import CurrentProgress from '../CurrentProgress/CurrentProgress';
import ScanningActions from '../ScanningActions/ScanningActions';
import './ScanningProgress.css';

const ScanningProgress: React.FC = () => {
  const { state } = useVulnerabilities();
  const { scanState } = state;

  return (
    <div className="scanning-progress">
      <ProgressSteps scanState={scanState} />
      <CurrentProgress scanState={scanState} />
      <ScanningActions scanState={scanState} />
    </div>
  );
};

export default ScanningProgress;
