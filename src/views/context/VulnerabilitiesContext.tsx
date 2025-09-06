import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types based on the existing structure
export interface Vulnerability {
  id: string;
  classification?: {
    name: string;
  };
  location: {
    line_number: number;
    file: {
      path: string;
    };
  };
  urgency: string;
  status: string;
}

export interface SCAVulnerability {
  id: string;
  cve: string;
  severity: string;
  package: {
    name: string;
    fix_version: string;
    ecosystem: string;
  };
}

export interface ScanProgress {
  stage: string;
  message: string;
  percentage?: number;
}

export interface ScanState {
  isScanning: boolean;
  scanId?: string;
  scanUrl?: string;
  progress?: ScanProgress[];
  output?: string[];
  error?: string;
  stages?: {
    init: boolean;
    package: boolean;
    upload: boolean;
    scan: boolean;
  };
}

export interface FileGroup {
  index: number;
  path: string;
  vulnerabilities: Vulnerability[];
}

export interface PackageGroup {
  index: number;
  name: string;
  vulnerabilities: SCAVulnerability[];
}

export interface VulnerabilitiesState {
  isLoading: boolean;
  isAuthenticated: boolean;
  projectNotFound: boolean;
  vulnerabilities: Vulnerability[];
  scaVulnerabilities: SCAVulnerability[];
  fileGroups: FileGroup[];
  packageGroups: PackageGroup[];
  hasVulnerabilities: boolean;
  hasSCAVulnerabilities: boolean;
  scanState: ScanState;
  isInScanningMode: boolean;
  autoRefreshEnabled: boolean;
  activeTab: 'code' | 'sca' | 'scanning';
  ideScanningEnabled: boolean;
}

type VulnerabilitiesAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AUTHENTICATION'; payload: boolean }
  | { type: 'SET_PROJECT_NOT_FOUND'; payload: boolean }
  | { type: 'SET_VULNERABILITIES'; payload: { vulnerabilities: Vulnerability[]; fileGroups: FileGroup[] } }
  | { type: 'SET_SCA_VULNERABILITIES'; payload: { scaVulnerabilities: SCAVulnerability[]; packageGroups: PackageGroup[] } }
  | { type: 'SET_SCAN_STATE'; payload: ScanState }
  | { type: 'SET_SCANNING_MODE'; payload: boolean }
  | { type: 'SET_AUTO_REFRESH'; payload: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: 'code' | 'sca' | 'scanning' }
  | { type: 'SET_IDE_SCANNING_ENABLED'; payload: boolean }
  | { type: 'UPDATE_VULNERABILITY_LISTS'; payload: {
      vulnerabilities: Vulnerability[];
      scaVulnerabilities: SCAVulnerability[];
      fileGroups: FileGroup[];
      packageGroups: PackageGroup[];
      hasVulnerabilities: boolean;
      hasSCAVulnerabilities: boolean;
    }};

const initialState: VulnerabilitiesState = {
  isLoading: false,
  isAuthenticated: false,
  projectNotFound: false,
  vulnerabilities: [],
  scaVulnerabilities: [],
  fileGroups: [],
  packageGroups: [],
  hasVulnerabilities: false,
  hasSCAVulnerabilities: false,
  scanState: {
    isScanning: false,
    progress: [],
    output: [],
    stages: {
      init: false,
      package: false,
      upload: false,
      scan: false
    }
  },
  isInScanningMode: false,
  autoRefreshEnabled: false,
  activeTab: 'code',
  ideScanningEnabled: true
};

function vulnerabilitiesReducer(state: VulnerabilitiesState, action: VulnerabilitiesAction): VulnerabilitiesState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_AUTHENTICATION':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_PROJECT_NOT_FOUND':
      return { ...state, projectNotFound: action.payload };
    case 'SET_VULNERABILITIES':
      return {
        ...state,
        vulnerabilities: action.payload.vulnerabilities,
        fileGroups: action.payload.fileGroups,
        hasVulnerabilities: action.payload.vulnerabilities.length > 0,
      };
    case 'SET_SCA_VULNERABILITIES':
      return {
        ...state,
        scaVulnerabilities: action.payload.scaVulnerabilities,
        packageGroups: action.payload.packageGroups,
        hasSCAVulnerabilities: action.payload.scaVulnerabilities.length > 0,
      };
    case 'SET_SCAN_STATE':
      return { ...state, scanState: action.payload };
    case 'SET_SCANNING_MODE':
      return { ...state, isInScanningMode: action.payload };
    case 'SET_AUTO_REFRESH':
      return { ...state, autoRefreshEnabled: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_IDE_SCANNING_ENABLED':
      return { ...state, ideScanningEnabled: action.payload };
    case 'UPDATE_VULNERABILITY_LISTS':
      return {
        ...state,
        vulnerabilities: action.payload.vulnerabilities,
        scaVulnerabilities: action.payload.scaVulnerabilities,
        fileGroups: action.payload.fileGroups,
        packageGroups: action.payload.packageGroups,
        hasVulnerabilities: action.payload.hasVulnerabilities,
        hasSCAVulnerabilities: action.payload.hasSCAVulnerabilities,
        projectNotFound: false
      };
    default:
      return state;
  }
}

const VulnerabilitiesContext = createContext<{
  state: VulnerabilitiesState;
  dispatch: React.Dispatch<VulnerabilitiesAction>;
  actions: {
    login: () => void;
    refresh: () => void;
    scanProject: () => void;
    cancelScan: () => void;
    openScanUrl: () => void;
    toggleAutoRefresh: () => void;
    showVulnerabilityDetails: (vulnerability: Vulnerability) => void;
    showSCAVulnerabilityDetails: (vulnerability: SCAVulnerability) => void;
  };
} | undefined>(undefined);

// VS Code API interface
interface VSCodeAPI {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
}

declare global {
  interface Window {
    vscode: VSCodeAPI;
    initialData: any;
  }
}

export function VulnerabilitiesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(vulnerabilitiesReducer, initialState);

  // Get VS Code API from global window object
  const vscode = window.vscode;

  // Safety check for VS Code API
  if (!vscode) {
    console.error('VS Code API not available. Make sure you are running this in a VS Code webview.');
    return <div>Error: VS Code API not available</div>;
  }

  // Actions that communicate with the extension
  const actions = {
    login: () => {
      vscode.postMessage({ type: 'login' });
    },
    refresh: () => {
      vscode.postMessage({ type: 'refresh' });
    },
    scanProject: () => {
      vscode.postMessage({ type: 'scanProject' });
    },
    cancelScan: () => {
      vscode.postMessage({ type: 'cancelScan' });
    },
    openScanUrl: () => {
      vscode.postMessage({ type: 'openScanUrl' });
    },
    toggleAutoRefresh: () => {
      vscode.postMessage({ type: 'toggleAutoRefresh' });
    },
    showVulnerabilityDetails: (vulnerability: Vulnerability) => {
      vscode.postMessage({ 
        type: 'showVulnerabilityDetails', 
        vulnerability 
      });
    },
    showSCAVulnerabilityDetails: (vulnerability: SCAVulnerability) => {
      vscode.postMessage({ 
        type: 'showSCAVulnerabilityDetails', 
        vulnerability,
        allIssues: state.scaVulnerabilities,
        project: {}
      });
    }
  };

  // Listen for messages from the extension
  useEffect(() => {
    // Load initial data from window if available
    if (window.initialData) {
      const data = window.initialData;
      dispatch({ type: 'SET_LOADING', payload: data.isLoading });
      dispatch({ type: 'SET_AUTHENTICATION', payload: data.isAuthenticated });
      dispatch({ type: 'SET_PROJECT_NOT_FOUND', payload: data.projectNotFound });
      dispatch({ type: 'SET_VULNERABILITIES', payload: {
        vulnerabilities: data.vulnerabilities || [],
        fileGroups: data.fileGroups || []
      }});
      dispatch({ type: 'SET_SCA_VULNERABILITIES', payload: {
        scaVulnerabilities: data.scaVulnerabilities || [],
        packageGroups: data.packageGroups || []
      }});
      dispatch({ type: 'SET_SCAN_STATE', payload: data.scanState || initialState.scanState });
      dispatch({ type: 'SET_SCANNING_MODE', payload: data.isInScanningMode });
      dispatch({ type: 'SET_AUTO_REFRESH', payload: data.autoRefreshEnabled });
      dispatch({ type: 'SET_IDE_SCANNING_ENABLED', payload: data.ideScanningEnabled });
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'scanStateUpdate':
          dispatch({ type: 'SET_SCAN_STATE', payload: message.scanState });
          break;
        case 'enterScanningMode':
          dispatch({ type: 'SET_SCANNING_MODE', payload: true });
          dispatch({ type: 'SET_AUTO_REFRESH', payload: message.autoRefreshEnabled });
          // Auto-switch to scanning tab when entering scanning mode
          dispatch({ type: 'SET_ACTIVE_TAB', payload: 'scanning' });
          break;
        case 'exitScanningMode':
          dispatch({ type: 'SET_SCANNING_MODE', payload: false });
          break;
        case 'autoRefreshToggled':
          dispatch({ type: 'SET_AUTO_REFRESH', payload: message.enabled });
          break;
        case 'updateVulnerabilityLists':
          dispatch({ type: 'UPDATE_VULNERABILITY_LISTS', payload: message });
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <VulnerabilitiesContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </VulnerabilitiesContext.Provider>
  );
}

export function useVulnerabilities() {
  const context = useContext(VulnerabilitiesContext);
  if (context === undefined) {
    throw new Error('useVulnerabilities must be used within a VulnerabilitiesProvider');
  }
  return context;
}
