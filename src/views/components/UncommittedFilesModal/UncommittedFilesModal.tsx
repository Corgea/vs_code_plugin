import React, { useState } from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './UncommittedFilesModal.css';
import { minimatch } from 'minimatch';
import { FILE_EXCLUDE_PATTERNS } from '../../../config/constants';

// Helper function to check if a file would be ignored during scanning
const isFileIgnored = (filePath: string): boolean => {
  return FILE_EXCLUDE_PATTERNS.some(pattern => {
    try {
      // Normalize the file path to use forward slashes
      const normalizedPath = filePath.replace(/\\/g, '/');
      return minimatch(normalizedPath, pattern, { 
        matchBase: true, 
        dot: true,
        nocase: true // Case insensitive matching for Windows
      });
    } catch (error) {
      console.warn(`Invalid glob pattern: ${pattern}`, error);
      return false;
    }
  });
};

const UncommittedFilesModal: React.FC = () => {
  const { state, actions } = useVulnerabilities();
  const { uncommittedFiles, showUncommittedFilesModal } = state;
  const [showIgnoredAccordion, setShowIgnoredAccordion] = useState(false);
  const [showScannableAccordion, setShowScannableAccordion] = useState(true);

  // Separate files into scannable and ignored
  const scannableFiles = uncommittedFiles.filter(file => !isFileIgnored(file.path));
  const ignoredFiles = uncommittedFiles.filter(file => isFileIgnored(file.path));
  const scannableFilesCount = scannableFiles.length;

  // Refresh files when modal opens (always include ignored files)
  React.useEffect(() => {
    if (showUncommittedFilesModal) {
      actions.getUncommittedFiles(true);
    }
  }, [showUncommittedFilesModal]);

  if (!showUncommittedFilesModal) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified':
        return <i className="fas fa-edit text-warning"></i>;
      case 'untracked':
        return <i className="fas fa-plus text-success"></i>;
      case 'deleted':
        return <i className="fas fa-trash text-danger"></i>;
      case 'staged':
        return <i className="fas fa-check text-info"></i>;
      default:
        return <i className="fas fa-file text-secondary"></i>;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'modified':
        return 'Modified';
      case 'untracked':
        return 'Untracked';
      case 'deleted':
        return 'Deleted';
      case 'staged':
        return 'Staged';
      default:
        return status;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="uncommitted-files-modal">
        <div className="modal-header">
          <h3>
            <i className="fas fa-code-branch"></i>
            &nbsp;Uncommitted Files ({uncommittedFiles.length})
          </h3>
          <button 
            className="btn-close"
            onClick={actions.hideUncommittedFilesModal}
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="modal-body">
          {uncommittedFiles.length === 0 ? (
            <div className="no-files">
              <i className="fas fa-check-circle text-success"></i>
              <p>No uncommitted files found</p>
            </div>
          ) : (
            <div className="files-container">
              {/* Scannable Files Accordion */}
              {scannableFiles.length > 0 && (
                <div className="files-section">
                  <div 
                    className="accordion-header"
                    onClick={() => setShowScannableAccordion(!showScannableAccordion)}
                  >
                    <div className="accordion-title">
                      <i className="fas fa-shield-alt"></i>
                      <span>Files to be Scanned ({scannableFiles.length})</span>
                    </div>
                    <i className={`fas fa-chevron-${showScannableAccordion ? 'up' : 'down'} accordion-icon`}></i>
                  </div>
                  {showScannableAccordion && (
                    <div className="accordion-content">
                      <div className="files-list">
                        {scannableFiles.map((file, index) => (
                          <div key={`scannable-${index}`} className="file-item">
                            <div className="file-status">
                              {getStatusIcon(file.status)}
                              <span className="status-text">{getStatusText(file.status)}</span>
                            </div>
                            <div className="file-path" title={file.path}>
                              {file.path}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ignored Files Accordion */}
              {ignoredFiles.length > 0 && (
                <div className="files-section">
                  <div 
                    className="accordion-header"
                    onClick={() => setShowIgnoredAccordion(!showIgnoredAccordion)}
                  >
                    <div className="accordion-title">
                      <i className="fas fa-eye-slash"></i>
                      <span>Files Ignored for Security Scanning ({ignoredFiles.length})</span>
                    </div>
                    <i className={`fas fa-chevron-${showIgnoredAccordion ? 'up' : 'down'} accordion-icon`}></i>
                  </div>
                  {showIgnoredAccordion && (
                    <div className="accordion-content">
                      <div className="files-list">
                        {ignoredFiles.map((file, index) => (
                          <div key={`ignored-${index}`} className="file-item file-ignored">
                            <div className="file-status">
                              {getStatusIcon(file.status)}
                              <span className="status-text">{getStatusText(file.status)}</span>
                            </div>
                            <div className="file-path" title={file.path}>
                              {file.path}
                              <span className="ignored-indicator" title="This file will be ignored during scanning">
                                <i className="fas fa-eye-slash"></i>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={actions.hideUncommittedFilesModal}
          >
            Cancel
          </button>
          {uncommittedFiles.length > 0 && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                actions.scanUncommittedFiles();
                actions.hideUncommittedFilesModal();
              }}
              disabled={scannableFilesCount === 0}
              title={scannableFilesCount === 0 ? "No scannable files - all files are ignored" : `Scan ${scannableFilesCount} file${scannableFilesCount === 1 ? '' : 's'}`}
            >
              <i className="fas fa-search"></i>
              &nbsp;{scannableFilesCount === 0 ? 'No Files to Scan' : 'Scan These Files'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UncommittedFilesModal;

