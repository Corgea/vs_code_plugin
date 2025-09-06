import React, { useEffect, useState } from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './ScanningIdle.css';
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

const ScanningIdle: React.FC = () => {
  const { state, actions } = useVulnerabilities();
  const { uncommittedFiles } = state;
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Count only scannable files for the button
  const scannableFilesCount = uncommittedFiles.filter(file => !isFileIgnored(file.path)).length;

  // Get uncommitted files when component mounts (always include all files)
  useEffect(() => {
    actions.getUncommittedFiles(true);
  }, []);

  const handleShowUncommittedFiles = async () => {
    setIsLoadingFiles(true);
    actions.getUncommittedFiles(true); // Refresh the list (include all files)
    // Small delay to show loading state
    setTimeout(() => {
      setIsLoadingFiles(false);
      actions.showUncommittedFilesModal();
    }, 300);
  };

  return (
    <div className="scanning-idle">
      <div className="idle-icon">
        <i className="fas fa-search"></i>
      </div>
      <div className="idle-message">
        Start a security scan to analyze your code for vulnerabilities
      </div>
      <div className="scan-buttons">
        <button className="btn btn-primary" onClick={actions.scanProject}>
          <i className="fas fa-search"></i>
          Start Full Scan
        </button>
        <div className="scan-separator">or</div>
        <button 
          className="btn btn-secondary" 
          onClick={handleShowUncommittedFiles}
          disabled={uncommittedFiles.length === 0 || isLoadingFiles}
          title={uncommittedFiles.length === 0 ? "No uncommitted files found" : scannableFilesCount === 0 ? `View ${uncommittedFiles.length} uncommitted file${uncommittedFiles.length === 1 ? '' : 's'} (all ignored)` : `Scan ${scannableFilesCount} uncommitted file${scannableFilesCount === 1 ? '' : 's'}`}
        >
          <i className={`fas ${isLoadingFiles ? 'fa-spinner fa-spin' : 'fa-code-branch'}`}></i>
          {isLoadingFiles ? 'Loading...' : scannableFilesCount === 0 && uncommittedFiles.length > 0 ? 'View Uncommitted Changes' : 'Scan Uncommitted Changes'}
          {uncommittedFiles.length > 0 && !isLoadingFiles && (
            <span className="file-count">{scannableFilesCount > 0 ? scannableFilesCount : uncommittedFiles.length}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default ScanningIdle;
