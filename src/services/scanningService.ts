import { OnCommand } from "../utils/commandsManager";
import TerminalManager from "../utils/terminalManager";
import * as vscode from "vscode";
import ContextManager from "../utils/contextManager";
import * as os from "os";
import * as path from "path";
import { execSync, spawn, ChildProcess } from "child_process";
import StorageManager, {
  StorageKeys,
  StorageSecretKeys,
} from "../utils/storageManager";
import ErrorHandlingManager, { withErrorHandling } from "../utils/ErrorHandlingManager";
import EventsManager from "../utils/eventsManager";
import WorkspaceManager from "../utils/workspaceManager";
import ConfigService from "./configService";
const kill = require('tree-kill');

export interface ScanProgress {
  stage: string;
  percentage?: number;
  message: string;
  timestamp: number;
}

export interface ScanStages {
  init: boolean;
  package: boolean;
  upload: boolean;
  scan: boolean;
}

export interface ScanState {
  isScanning: boolean;
  progress: ScanProgress[];
  stages: ScanStages;
  scanUrl?: string;
  scanId?: string;
  output: string[];
  error?: string;
}

export default class scanningService {
  private static _currentScanProcess: ChildProcess | null = null;
  private static _scanCancelledByUser: boolean = false;
  private static _scanState: ScanState = {
    isScanning: false,
    progress: [],
    stages: {
      init: false,
      package: false,
      upload: false,
      scan: false
    },
    output: [],
  };

  @OnCommand("corgea.scan-uncommitted")
  @withErrorHandling()
  public static async scanUncommittedFiles() {
    // Check if IDE scanning is enabled
    const isIdeScanningEnabled = await ConfigService.isIdeScanningEnabled();
    if (!isIdeScanningEnabled) {
      vscode.window.showInformationMessage(
        "IDE scanning is disabled for your organization. Please contact your administrator to enable this feature."
      );
      return;
    }
    
    await scanningService.scanProject(false);
  }

  /*
    Scan cammand should only scan changed files unless the projecty doesnt have any previous scan results
    Options to be (forced full scan)
    before commit (git hooks integration), warning...
  */
  @OnCommand("corgea.scan-full")
  @withErrorHandling()
  public static async scanProject(isFullScan: boolean = true) {
    // Check if IDE scanning is enabled
    const isIdeScanningEnabled = await ConfigService.isIdeScanningEnabled();
    if (!isIdeScanningEnabled) {
      vscode.window.showInformationMessage(
        "IDE scanning is disabled for your organization. Please contact your administrator to enable this feature."
      );
      return;
    }
    
    // Reset scan state
    scanningService._scanCancelledByUser = false;
    scanningService._scanState = {
      isScanning: true,
      progress: [{
        stage: "initializing",
        message: "Initializing scan...",
        timestamp: Date.now()
      }],
      stages: {
        init: false,
        package: false,
        upload: false,
        scan: false
      },
      output: [],
    };

    // Notify webview that scan started
    console.log('scanningService: Emitting scan.started event');
    EventsManager.emit("scan.started", scanningService._scanState);

    const contextUri = ContextManager.getContext().extensionUri;
    const myVenvPath = scanningService.getVersionedVenvPath();

    try {
      // Ensure the virtual environment is set up
      await scanningService.ensureVirtualEnvExists(contextUri, myVenvPath);

      const pythonPath = scanningService.getPythonPath();
      const corgeaPath = scanningService.getCorgeaPath();
      if (!pythonPath) {
        throw new Error("Could not determine Python path.");
      }

      // Check if corgea is installed
      if (!scanningService.isCorgeaInstalled()) {
        scanningService.updateScanProgress("installing", "Installing Corgea CLI...");
        scanningService.installCorgea(pythonPath.fsPath);
      }

      // Set environment variables for Corgea CLI
      const corgeaUrl = await StorageManager.getValue(StorageKeys.corgeaUrl);
      const corgeaToken = await StorageManager.getSecretValue(
        StorageSecretKeys.corgeaApiKey,
      );

      if (!corgeaUrl || !corgeaToken) {
        throw new Error("Corgea URL or API Key not set.");
      }

      scanningService.updateScanProgress("authenticating", "Authenticating with Corgea...");

      // Execute corgea scan with child process
      const command = corgeaPath?.fsPath || "";
      const loginArgs = ["login", "--url", corgeaUrl, corgeaToken];
      const scanArgs = ["scan"];
      
      if (!isFullScan) {
        scanArgs.push("--only-uncommitted");
      }

      // Run login first
      await scanningService.runCommand(command, loginArgs);
      
      // Then run scan
      scanningService.updateScanProgress("scanning", "Starting security scan...");
      await scanningService.runScanCommand(command, scanArgs);

    } catch (error: any) {
      scanningService._scanState.isScanning = false;
      scanningService._scanState.error = error.message;
      EventsManager.emit("scan.error", scanningService._scanState);
      vscode.window.showErrorMessage(`Scan failed: ${error.message}`);
    }
  }

  @OnCommand("corgea.cancelScan")
  public static cancelScan() {
    console.log('scanningService: Cancel scan requested, current process:', !!scanningService._currentScanProcess);
    
    // Mark that user initiated cancellation
    scanningService._scanCancelledByUser = true;
    
    if (scanningService._currentScanProcess && scanningService._currentScanProcess.pid) {
      try {
        console.log('scanningService: Killing process tree for PID:', scanningService._currentScanProcess.pid);
        
        // Use tree-kill to kill the entire process tree
        kill(scanningService._currentScanProcess.pid, 'SIGKILL', (err: any) => {
          if (err) {
            console.error('scanningService: Error killing process tree:', err);
          } else {
            console.log('scanningService: Process tree killed successfully');
          }
        });
        
      } catch (error) {
        console.error('scanningService: Error killing process:', error);
      }
      
      scanningService._currentScanProcess = null;
    }
    
    // Reset scan state immediately
    scanningService._scanState.isScanning = false;
    scanningService._scanState.error = undefined;
    scanningService.updateScanProgress("cancelled", "Scan cancelled by user");
    EventsManager.emit("scan.cancelled", scanningService._scanState);
    
    console.log('scanningService: Scan cancelled, state reset');
  }

  public static getScanState(): ScanState {
    return { ...scanningService._scanState };
  }

  private static updateScanProgress(stage: string, message: string, percentage?: number) {
    const progress: ScanProgress = {
      stage,
      message,
      percentage,
      timestamp: Date.now()
    };
    
    scanningService._scanState.progress.push(progress);
    console.log('scanningService: Emitting scan.progress event', stage, message);
    EventsManager.emit("scan.progress", scanningService._scanState);
  }

  private static runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        shell: true
      });

      let output = "";
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private static runScanCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        shell: true
      });

      scanningService._currentScanProcess = process;

      process.stdout?.on('data', (data) => {
        const output = data.toString();
        scanningService._scanState.output.push(output);
        
        // Parse output for progress and URLs
        scanningService.parseOutput(output);
        
        EventsManager.emit("scan.output", {
          ...scanningService._scanState,
          newOutput: output
        });
      });

      process.stderr?.on('data', (data) => {
        const output = data.toString();
        scanningService._scanState.output.push(output);
        EventsManager.emit("scan.output", {
          ...scanningService._scanState,
          newOutput: output
        });
      });

      process.on('close', (code, signal) => {
        console.log('scanningService: Process closed with code:', code, 'signal:', signal, 'user cancelled:', scanningService._scanCancelledByUser);
        scanningService._currentScanProcess = null;
        scanningService._scanState.isScanning = false;
        
        if (scanningService._scanCancelledByUser) {
          // Process was cancelled by user - don't treat as error
          console.log('scanningService: Process was cancelled by user, not treating as error');
          if (!scanningService._scanState.progress.some(p => p.stage === 'cancelled')) {
            scanningService.updateScanProgress("cancelled", "Scan cancelled by user");
            EventsManager.emit("scan.cancelled", scanningService._scanState);
          }
          resolve(); // Don't reject on cancellation
        } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          // Process was killed but not by user cancellation
          scanningService.updateScanProgress("cancelled", "Scan interrupted");
          EventsManager.emit("scan.cancelled", scanningService._scanState);
          resolve(); // Don't reject on signal termination
        } else if (code === 0) {
          scanningService._scanState.stages.scan = true; // Mark scan as complete
          scanningService.updateScanProgress("completed", "Scan completed successfully");
          EventsManager.emit("scan.completed", scanningService._scanState);
          resolve();
        } else if (code !== null) {
          scanningService._scanState.error = `Scan failed with code ${code}`;
          EventsManager.emit("scan.error", scanningService._scanState);
          reject(new Error(`Scan failed with code ${code}`));
        }
      });

      process.on('error', (error) => {
        console.log('scanningService: Process error:', error, 'user cancelled:', scanningService._scanCancelledByUser);
        scanningService._currentScanProcess = null;
        scanningService._scanState.isScanning = false;
        
        if (scanningService._scanCancelledByUser) {
          // Don't treat process errors as real errors if user cancelled
          console.log('scanningService: Ignoring process error because user cancelled');
          if (!scanningService._scanState.progress.some(p => p.stage === 'cancelled')) {
            scanningService.updateScanProgress("cancelled", "Scan cancelled by user");
            EventsManager.emit("scan.cancelled", scanningService._scanState);
          }
          resolve(); // Don't reject on user cancellation
        } else {
          scanningService._scanState.error = error.message;
          EventsManager.emit("scan.error", scanningService._scanState);
          reject(error);
        }
      });
    });
  }

  private static parseOutput(output: string) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Update stages based on output messages
      if (line.includes('Packaging your project')) {
        scanningService._scanState.stages.init = true;
        scanningService.updateScanProgress("packaging", "Packaging your project...");
      } else if (line.includes('Project packaged successfully')) {
        scanningService._scanState.stages.package = true;
        scanningService.updateScanProgress("packaged", "Project packaged successfully");
      } else if (line.includes('Submitting scan to Corgea')) {
        scanningService.updateScanProgress("submitting", "Submitting scan to Corgea...");
      } else if (line.includes('Scanning with')) {
        scanningService.updateScanProgress("scanning", line.trim());
      }
      
      // Extract progress percentage
      const progressMatch = line.match(/\[.*?\]\s*(\d+\.?\d*)%/);
      if (progressMatch) {
        const percentage = parseFloat(progressMatch[1]);
        scanningService.updateScanProgress("uploading", `Uploading... ${percentage}%`, percentage);
      }
      
      // Extract scan ID
      const scanIdMatch = line.match(/Scan has started with ID:\s*([a-f0-9-]+)/);
      if (scanIdMatch) {
        // Clean the scan ID by removing any ANSI escape sequences
        let cleanScanId = scanIdMatch[1];
        cleanScanId = cleanScanId.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        
        scanningService._scanState.scanId = cleanScanId;
        scanningService._scanState.stages.upload = true; // Mark upload as complete
        console.log('scanningService: Extracted clean scan ID:', cleanScanId);
        scanningService.updateScanProgress("started", `Scan started with ID: ${cleanScanId}`);
      }
      
      // Extract URL
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch && line.includes('localhost') && line.includes('scan_id')) {
        // Clean the URL by removing ANSI escape sequences
        let cleanUrl = urlMatch[1];
        // Remove ANSI escape sequences (like \x1b[0m, \x1b[31m, etc.)
        cleanUrl = cleanUrl.replace(/\x1b\[[0-9;]*m/g, '');
        // Remove any other common ANSI sequences
        cleanUrl = cleanUrl.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        
        scanningService._scanState.scanUrl = cleanUrl;
        console.log('scanningService: Extracted clean URL:', cleanUrl);
        scanningService.updateScanProgress("url_ready", "Scan URL available");
      }
    }
  }

  private static async ensureVirtualEnvExists(
    contextUri: vscode.Uri,
    myVenvPath: vscode.Uri,
  ) {
    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.joinPath(myVenvPath, `./python`),
      );
      await vscode.workspace.fs.stat(scanningService.getVenvPythonExecutablePath());
    } catch (error) {
      let tarFileName = "";
      if (scanningService.getPlatform() === "windows") {
        tarFileName = "windows.gz";
      } else if (scanningService.getPlatform() === "mac") {
        tarFileName = "mac.gz";
      } else if (scanningService.getPlatform() === "mac-intel") {
        tarFileName = "mac-intel.gz";
      } else if (scanningService.getPlatform() === "linux") {
        tarFileName = "linux.gz";
      }

      const tarFilePath = vscode.Uri.joinPath(
        scanningService.getPythonRuntimeBasePath(),
        tarFileName,
      );
      try {
        await vscode.workspace.fs.delete(myVenvPath, { recursive: true });
      } catch (deletionError) {
        ErrorHandlingManager.handleError(deletionError, {
          method: "scanningService.ensureVirtualEnvExists",
          additionalData: {
            myVenvPath: myVenvPath.fsPath,
            tarFilePath: tarFilePath.fsPath,
          }
        });
      }
      await vscode.workspace.fs.createDirectory(myVenvPath);
      try {
        const tar = require("tar");
        await tar.x({
          file: tarFilePath.fsPath,
          C: myVenvPath.fsPath,
        });
      } catch (extractionError: any) {
        vscode.window.showErrorMessage(
          `Failed to setup virtual environment. Please try again.`,
        );
        throw extractionError;
      }
    }
  }

  private static getPythonPath(): vscode.Uri | null {
    return scanningService.getVenvPythonExecutablePath();
  }

  private static getCorgeaPath(): vscode.Uri | null {
    const pythonPath = scanningService.getPythonPath();
    if (pythonPath) {
      let corgeaPath = path.dirname(pythonPath.fsPath);
      if (os.platform() === "win32") {
        corgeaPath = path.join(corgeaPath, "./Scripts/corgea.exe");
      } else {
        corgeaPath = path.join(corgeaPath, "./corgea");
      }
      return vscode.Uri.file(corgeaPath);
    }
    return null;
  }

  private static isCorgeaInstalled(): boolean {
    try {
      execSync(`${scanningService.getCorgeaPath()} --help`, {
        stdio: "ignore",
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  private static installCorgea(pythonPath: string): void {
    try {
      execSync(`${pythonPath} -m pip install -U corgea-cli`, {
        stdio: "inherit",
      });
      vscode.window.showInformationMessage(
        "Corgea cli installed successfully!",
      );
    } catch (error) {
      vscode.window.showErrorMessage("Failed to install Corgea cli.");
    }
  }

  private static getPlatform(): string {
    if (os.platform() === "win32") {
      return "windows";
    } else if (os.platform() === "darwin") {
      if (process.arch === "arm64") {
        return "mac";
      } else {
        return "mac-intel";
      }
    } else if (os.platform() === "linux") {
      return "linux";
    }
    return "";
  }

  /**
   * Gets the base Python runtime path
   */
  private static getPythonRuntimeBasePath(): vscode.Uri {
    const contextUri = ContextManager.getContext().extensionUri;
    return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python");
  }

  /**
   * Gets the versioned virtual environment path
   */
  private static getVersionedVenvPath(): vscode.Uri {
    return vscode.Uri.joinPath(
      this.getPythonRuntimeBasePath(),
      "myvenv",
      `version_${WorkspaceManager.getExtensionVersion() || "default"}`
    );
  }

  /**
   * Gets the Python executable path for the virtual environment
   */
  private static getVenvPythonExecutablePath(): vscode.Uri {
    const venvPath = this.getVersionedVenvPath();
    
    if (os.platform() === "win32") {
      return vscode.Uri.joinPath(venvPath, "python/python.exe");
    } else {
      return vscode.Uri.joinPath(venvPath, "python/bin/python");
    }
  }

  public static activate() {}
}
