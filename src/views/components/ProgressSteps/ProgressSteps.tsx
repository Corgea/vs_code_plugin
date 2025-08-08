import React from 'react';
import { ScanState } from '../../context/VulnerabilitiesContext';
import './ProgressSteps.css';

interface ProgressStepsProps {
  scanState: ScanState;
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ scanState }) => {
  const getStepClass = (stage: string) => {
    if (!scanState.stages) return '';
    
    const stageKey = getStageKey(stage);
    if (!stageKey) return '';
    
    if (scanState.stages[stageKey as keyof typeof scanState.stages]) {
      return 'completed';
    } else if (getCurrentActiveStage() === stage) {
      return 'active';
    }
    
    return '';
  };

  const getStageKey = (stage: string) => {
    const mapping: { [key: string]: string } = {
      'initializing': 'init',
      'packaging': 'package', 
      'uploading': 'upload',
      'scanning': 'scan'
    };
    return mapping[stage];
  };

  const getCurrentActiveStage = () => {
    if (!scanState.stages) return 'initializing';
    
    // Find the first false stage - that's the active one
    if (!scanState.stages.init) return 'initializing';
    if (!scanState.stages.package) return 'packaging';
    if (!scanState.stages.upload) return 'uploading';
    if (!scanState.stages.scan) return 'scanning';
    
    // All stages complete
    return null;
  };

  const getStepIcon = (stage: string) => {
    if (!scanState.stages) {
      return getDefaultIcon(stage);
    }
    
    const stageKey = getStageKey(stage);
    if (stageKey && scanState.stages[stageKey as keyof typeof scanState.stages]) {
      return <i className="fas fa-check"></i>;
    }
    
    return getDefaultIcon(stage);
  };

  const getDefaultIcon = (stage: string) => {
    switch (stage) {
      case 'initializing':
        return <i className="fas fa-cog"></i>;
      case 'packaging':
        return <i className="fas fa-box"></i>;
      case 'uploading':
        return <i className="fas fa-upload"></i>;
      case 'scanning':
        return <i className="fas fa-search"></i>;
      default:
        return <i className="fas fa-circle"></i>;
    }
  };

  return (
    <div className="progress-steps">
      <div className={`step ${getStepClass('initializing')}`}>
        <div className="step-icon">{getStepIcon('initializing')}</div>
        <div className="step-text">Initializing</div>
      </div>
      <div className={`step ${getStepClass('packaging')}`}>
        <div className="step-icon">{getStepIcon('packaging')}</div>
        <div className="step-text">Packaging</div>
      </div>
      <div className={`step ${getStepClass('uploading')}`}>
        <div className="step-icon">{getStepIcon('uploading')}</div>
        <div className="step-text">Uploading</div>
      </div>
      <div className={`step ${getStepClass('scanning')}`}>
        <div className="step-icon">{getStepIcon('scanning')}</div>
        <div className="step-text">Scanning</div>
      </div>
    </div>
  );
};

export default ProgressSteps;
