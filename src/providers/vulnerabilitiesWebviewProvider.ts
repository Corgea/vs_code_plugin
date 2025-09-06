import * as vscode from "vscode";
import WorkspacManager from "../utils/workspaceManager";
import APIManager from "../utils/apiManager";
import StorageManager, { StorageKeys } from "../utils/storageManager";
import { OnCommand } from "../utils/commandsManager";
import { OnEvent } from "../utils/eventsManager";
import ViewsManager, { Views } from "../utils/ViewsManager";
import Vulnerability from "../types/vulnerability";
import SCAVulnerability from "../types/scaVulnerability";
import scanningService, { ScanState } from "../services/scanningService";

export default class VulnerabilitiesWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "vulnerabilitiesWebview";
  
  private static _instance?: VulnerabilitiesWebviewProvider;
  private _view?: vscode.WebviewView;
  private _vulnerabilities: Vulnerability[] = [];
  private _scaVulnerabilities: SCAVulnerability[] = [];
  private _isLoading = false;
  private _projectNotFound = false;
  private _scanState: ScanState;
  private _autoRefreshEnabled = false;
  private _autoRefreshInterval?: NodeJS.Timeout;
  private _isInScanningMode = false;

  constructor(private readonly _extensionUri: vscode.Uri) {
    VulnerabilitiesWebviewProvider._instance = this;
    this._scanState = scanningService.getScanState();
    console.log('VulnerabilitiesWebviewProvider: Instance created');
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    console.log('VulnerabilitiesWebviewProvider: Webview resolved, view set:', !!this._view);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);
    
    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      console.log('Received message from webview:', data);
      switch (data.type) {
        case "login":
        case "oauthLogin":
          console.log('OAuth login button clicked from webview');
          vscode.commands.executeCommand("corgea.oauthLogin");
          break;
        case "enterpriseLogin":
          console.log('Enterprise login button clicked from webview');
          // This now just shows the form in UI, no command needed
          break;
        case "submitEnterpriseLogin":
          console.log('Enterprise login submitted from webview with scope:', data.scope);
          vscode.commands.executeCommand("corgea.submitEnterpriseLogin", data.scope);
          break;
        case "loginWithApiKey":
          console.log('API key login button clicked from webview');
          vscode.commands.executeCommand("corgea.loginWithApiKey");
          break;
        case "cancelOAuth":
          console.log('Cancel OAuth button clicked from webview');
          vscode.commands.executeCommand("corgea.cancelOAuth");
          break;
        case "refresh":
          console.log('Manual refresh triggered from webview');
          await this.refresh();
          break;
        case "showVulnerabilityDetails":
          console.log('Showing vulnerability details for:', data.vulnerability);
          vscode.commands.executeCommand("vulnerabilities.showDetails", data.vulnerability);
          break;
        case "showSCAVulnerabilityDetails":
          console.log('Showing SCA vulnerability details for:', data.vulnerability);
          vscode.commands.executeCommand("vulnerabilities.showSCAVulnerabilityDetails", 
            data.vulnerability, data.allIssues, data.project);
          break;
        case "scanProject":
          console.log('Scan project button clicked from webview');
          vscode.commands.executeCommand("corgea.scan-full");
          break;
        case "cancelScan":
          console.log('Cancel scan button clicked from webview');
          vscode.commands.executeCommand("corgea.cancelScan");
          break;
        case "openScanUrl":
          console.log('Open scan URL button clicked from webview');
          if (this._scanState.scanUrl) {
            vscode.env.openExternal(vscode.Uri.parse(this._scanState.scanUrl));
          }
          break;
        case "toggleAutoRefresh":
          console.log('Auto refresh toggle clicked from webview');
          await this.toggleAutoRefresh();
          break;
        case "getUncommittedFiles":
          console.log('Get uncommitted files requested from webview', data.includeIgnored ? 'including ignored files' : 'excluding ignored files');
          const uncommittedFiles = await scanningService.getUncommittedFiles(data.includeIgnored || false);
          this._view?.webview.postMessage({
            type: 'uncommittedFilesResponse',
            files: uncommittedFiles
          });
          break;
        case "scanUncommittedFiles":
          console.log('Scan uncommitted files button clicked from webview');
          vscode.commands.executeCommand("corgea.scan-uncommitted");
          break;
        case "clearScanState":
          console.log('Clear scan state requested from webview');
          // Reset scan state and exit scanning mode
          this._scanState = {
            isScanning: false,
            progress: [],
            output: [],
            stages: {
              init: false,
              package: false,
              upload: false,
              scan: false
            }
          };
          this._isInScanningMode = false;
          this._view?.webview.postMessage({
            type: 'exitScanningMode'
          });
          this._view?.webview.postMessage({
            type: 'scanStateUpdate',
            scanState: this._scanState
          });
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    });

    // Load initial data
    this.refresh();
    
    // Get initial scan state
    this._scanState = scanningService.getScanState();
  }

  @OnCommand("vulnerabilities.refreshEntry")
  @OnEvent("internal.login")
  @OnEvent("internal.logout")
  @OnCommand("corgea.refreshVulnerabilities")
  static async refreshStatic(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: static refresh() called');
    if (VulnerabilitiesWebviewProvider._instance) {
      await VulnerabilitiesWebviewProvider._instance.refresh();
    } else {
      console.log('VulnerabilitiesWebviewProvider: No instance available for refresh');
    }
  }

  @OnEvent("scan.started")
  static async onScanStarted(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: Scan started event received');
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._scanState = scanningService.getScanState();
      VulnerabilitiesWebviewProvider._instance._isInScanningMode = true;
      VulnerabilitiesWebviewProvider._instance._autoRefreshEnabled = true;
      VulnerabilitiesWebviewProvider._instance.startAutoRefresh();
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'scanStateUpdate',
        scanState: VulnerabilitiesWebviewProvider._instance._scanState
      });
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'enterScanningMode',
        autoRefreshEnabled: true
      });
    }
  }

  @OnEvent("scan.progress")
  static async onScanProgress(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: Scan progress event received');
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._scanState = scanningService.getScanState();
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'scanStateUpdate',
        scanState: VulnerabilitiesWebviewProvider._instance._scanState
      });
    }
  }

  @OnEvent("scan.output")
  static async onScanOutput(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: Scan output event received');
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._scanState = scanningService.getScanState();
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'scanStateUpdate',
        scanState: VulnerabilitiesWebviewProvider._instance._scanState
      });
    }
  }

  @OnEvent("oauth.loading.update")
  static async onOAuthLoadingUpdate(isLoading: boolean): Promise<void> {
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'oauthLoadingUpdate',
        isLoading: isLoading
      });
    }
  }

  @OnEvent("scan.completed")
  static async onScanCompleted(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: Scan completed event received');
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._scanState = scanningService.getScanState();
      VulnerabilitiesWebviewProvider._instance._isInScanningMode = false;
      VulnerabilitiesWebviewProvider._instance.stopAutoRefresh();
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'scanStateUpdate',
        scanState: VulnerabilitiesWebviewProvider._instance._scanState
      });
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'exitScanningMode'
      });
      // Refresh only the vulnerability lists without re-rendering the scanning tab
      await VulnerabilitiesWebviewProvider._instance.refreshVulnerabilityListsOnly();
    }
  }

  @OnEvent("scan.cancelled")
  static async onScanCancelled(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: Scan cancelled event received');
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._scanState = scanningService.getScanState();
      VulnerabilitiesWebviewProvider._instance._isInScanningMode = false;
      VulnerabilitiesWebviewProvider._instance.stopAutoRefresh();
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'scanStateUpdate',
        scanState: VulnerabilitiesWebviewProvider._instance._scanState
      });
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'exitScanningMode'
      });
      // Refresh only the vulnerability lists without re-rendering the scanning tab
      await VulnerabilitiesWebviewProvider._instance.refreshVulnerabilityListsOnly();
    }
  }

  @OnEvent("scan.error")
  static async onScanError(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: Scan error event received');
    if (VulnerabilitiesWebviewProvider._instance && VulnerabilitiesWebviewProvider._instance._view) {
      VulnerabilitiesWebviewProvider._instance._scanState = scanningService.getScanState();
      VulnerabilitiesWebviewProvider._instance._isInScanningMode = false;
      VulnerabilitiesWebviewProvider._instance.stopAutoRefresh();
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'scanStateUpdate',
        scanState: VulnerabilitiesWebviewProvider._instance._scanState
      });
      VulnerabilitiesWebviewProvider._instance._view.webview.postMessage({
        type: 'exitScanningMode'
      });
      // Refresh only the vulnerability lists without re-rendering the scanning tab
      await VulnerabilitiesWebviewProvider._instance.refreshVulnerabilityListsOnly();
    }
  }

  public static getInstance(): VulnerabilitiesWebviewProvider | undefined {
    return VulnerabilitiesWebviewProvider._instance;
  }



  async refresh(): Promise<void> {
    console.log('VulnerabilitiesWebviewProvider: instance refresh() called');
    if (!this._view) {
      console.log('VulnerabilitiesWebviewProvider: No view available, skipping refresh');
      return;
    }

    console.log('VulnerabilitiesWebviewProvider: Starting refresh, setting loading state');
    this._isLoading = true;
    await this._updateWebview();

    // Clear API caches and fetch fresh data
    APIManager.clearAllCaches();
    
    const authenticated = await StorageManager.getValue<boolean>(StorageKeys.isLoggedIn);
    console.log('VulnerabilitiesWebviewProvider: Authentication state:', authenticated);
    
    if (!authenticated) {
      console.log('VulnerabilitiesWebviewProvider: User not authenticated, clearing data');
      this._vulnerabilities = [];
      this._scaVulnerabilities = [];
      this._projectNotFound = false;
      this._isLoading = false;
      await this._updateWebview();
      return;
    }

    try {
      const potentialNames = await WorkspacManager.getWorkspacePotentialNames();
      
      if (!potentialNames || potentialNames.length === 0) {
        this._vulnerabilities = [];
        this._scaVulnerabilities = [];
        this._projectNotFound = false;
        this._isLoading = false;
        await this._updateWebview();
        return;
      }

      // Fetch vulnerabilities
      const [response, scaResponse] = await Promise.all([
        APIManager.getProjectVulnerabilities(potentialNames).catch((error: any) => ({
          status: error.status,
          data: { status: "no_project_found", issues: [] },
        })),
        APIManager.getProjectSCAVulnerabilities(potentialNames).catch((error: any) => ({
          status: error.status,
          data: { status: "no_project_found", issues: [] },
        }))
      ]);

      // Check project status
      this._projectNotFound = response.data.status === "no_project_found";

      this._vulnerabilities = response.data.issues || [];
      this._scaVulnerabilities = scaResponse.data.issues || [];
      
    } catch (error) {
      console.error("Error fetching vulnerabilities:", error);
      this._vulnerabilities = [];
      this._scaVulnerabilities = [];
      this._projectNotFound = false;
    } finally {
      this._isLoading = false;
      await this._updateWebview();
    }
  }

  private async _updateWebview() {
    if (this._view) {
      console.log('VulnerabilitiesWebviewProvider: Updating webview HTML');
      this._view.webview.html = await this._getHtmlForWebview(this._view.webview);
      console.log('VulnerabilitiesWebviewProvider: Webview HTML updated successfully');
    } else {
      console.log('VulnerabilitiesWebviewProvider: Cannot update webview - view is null');
    }
  }

  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "styles", "main.css")
    );

    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "images", "logo.png")
    );

    const bundleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "bundles", "vulnerabilities.mjs")
    );

    const bundleStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "bundles", "style.css")
    );

    const isAuthenticated = await StorageManager.getValue<boolean>(StorageKeys.isLoggedIn);
    const hasVulnerabilities = this._vulnerabilities.length > 0;
    const hasSCAVulnerabilities = this._scaVulnerabilities.length > 0;

    // Group vulnerabilities by file
    const fileGroups = hasVulnerabilities ? this._groupVulnerabilitiesByFile() : [];
    
    // Group SCA vulnerabilities by package
    const packageGroups = hasSCAVulnerabilities ? this._groupSCAVulnerabilitiesByPackage() : [];

    // Use React-based HTML template
    return this._getReactHtmlTemplate({
      cspSource: webview.cspSource,
      styleURI: styleMainUri.toString(),
      bundleStyleURI: bundleStyleUri.toString(),
      logoURI: logoUri.toString(),
      bundleURI: bundleUri.toString(),
      isLoading: this._isLoading,
      isAuthenticated,
      hasVulnerabilities,
      hasSCAVulnerabilities,
      projectNotFound: this._projectNotFound,
      vulnerabilities: this._vulnerabilities,
      scaVulnerabilities: this._scaVulnerabilities,
      fileGroups,
      packageGroups,
      scanState: this._scanState,
      isInScanningMode: this._isInScanningMode,
      autoRefreshEnabled: this._autoRefreshEnabled,
    });
  }

  private _getReactHtmlTemplate(data: any): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource} https: data:; style-src 'unsafe-inline' https://cdn.jsdelivr.net ${data.cspSource} https://cdnjs.cloudflare.com; script-src 'unsafe-inline' https://cdn.jsdelivr.net ${data.cspSource}; font-src *;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
  <link href="${data.styleURI}" rel="stylesheet">
  <link href="${data.bundleStyleURI}" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit@latest/dist/toolkit.js"></script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="${data.bundleURI}"></script>
  <script>
    // Acquire VS Code API once and make it available globally
    (function() {
      if (!window.vscode) {
        window.vscode = acquireVsCodeApi();
      }
    })();
    
    // Pass initial data to React app
    window.initialData = {
      logoURI: '${data.logoURI}',
      isLoading: ${data.isLoading},
      isAuthenticated: ${data.isAuthenticated},
      projectNotFound: ${data.projectNotFound},
      vulnerabilities: ${JSON.stringify(data.vulnerabilities)},
      scaVulnerabilities: ${JSON.stringify(data.scaVulnerabilities)},
      fileGroups: ${JSON.stringify(data.fileGroups)},
      packageGroups: ${JSON.stringify(data.packageGroups)},
      hasVulnerabilities: ${data.hasVulnerabilities},
      hasSCAVulnerabilities: ${data.hasSCAVulnerabilities},
      scanState: ${JSON.stringify(data.scanState)},
      isInScanningMode: ${data.isInScanningMode},
      autoRefreshEnabled: ${data.autoRefreshEnabled}
    };
  </script>
</body>
</html>`;
  }

  private _groupVulnerabilitiesByFile() {
    const fileGroups = new Map<string, Vulnerability[]>();
    this._vulnerabilities.forEach(vuln => {
      const filePath = vuln.location.file.path;
      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath)!.push(vuln);
    });

    return Array.from(fileGroups.entries()).map(([path, vulnerabilities], index) => ({
      index,
      path,
      vulnerabilities: vulnerabilities.sort((a, b) => a.location.line_number - b.location.line_number)
    }));
  }

  private _groupSCAVulnerabilitiesByPackage() {
    const packageGroups = new Map<string, SCAVulnerability[]>();
    this._scaVulnerabilities.forEach(vuln => {
      const packageName = vuln.package.name;
      if (!packageGroups.has(packageName)) {
        packageGroups.set(packageName, []);
      }
      packageGroups.get(packageName)!.push(vuln);
    });

    return Array.from(packageGroups.entries()).map(([name, vulnerabilities], index) => ({
      index,
      name,
      vulnerabilities
    }));
  }

  private async toggleAutoRefresh(): Promise<void> {
    this._autoRefreshEnabled = !this._autoRefreshEnabled;
    
    if (this._autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }

    // Notify webview of the state change
    if (this._view) {
      this._view.webview.postMessage({
        type: 'autoRefreshToggled',
        enabled: this._autoRefreshEnabled
      });
    }
  }

  private startAutoRefresh(): void {
    if (this._autoRefreshInterval) {
      clearInterval(this._autoRefreshInterval);
    }

    // Immediately fetch if we have a scan ID
    if (this._scanState.scanId && this._autoRefreshEnabled) {
      this.refreshScanVulnerabilities();
    }

    this._autoRefreshInterval = setInterval(async () => {
      if (this._autoRefreshEnabled && this._scanState.scanId) {
        await this.refreshScanVulnerabilities();
      }
    }, 3000); // 3 second interval
  }

  private stopAutoRefresh(): void {
    if (this._autoRefreshInterval) {
      clearInterval(this._autoRefreshInterval);
      this._autoRefreshInterval = undefined;
    }
  }

  private async refreshScanVulnerabilities(): Promise<void> {
    if (!this._scanState.scanId) {
      return;
    }

    try {
      const [response, scaResponse] = await Promise.all([
        APIManager.getScanVulnerabilities(this._scanState.scanId).catch((error: any) => ({
          data: { status: "error", issues: [] },
        })),
        APIManager.getScanSCAVulnerabilities(this._scanState.scanId).catch((error: any) => ({
          data: { status: "error", issues: [] },
        }))
      ]);

      const newVulnerabilities = response.data.issues || [];
      const newSCAVulnerabilities = scaResponse.data.issues || [];

      // Update vulnerabilities
      this._vulnerabilities = newVulnerabilities;
      this._scaVulnerabilities = newSCAVulnerabilities;
      
      // Group vulnerabilities by file and package
      const fileGroups = newVulnerabilities.length > 0 ? this._groupVulnerabilitiesByFile() : [];
      const packageGroups = newSCAVulnerabilities.length > 0 ? this._groupSCAVulnerabilitiesByPackage() : [];

      // Send update to webview
      if (this._view) {
        this._view.webview.postMessage({
          type: 'updateVulnerabilityLists',
          vulnerabilities: newVulnerabilities,
          scaVulnerabilities: newSCAVulnerabilities,
          fileGroups,
          packageGroups,
          hasVulnerabilities: newVulnerabilities.length > 0,
          hasSCAVulnerabilities: newSCAVulnerabilities.length > 0
        });
      }
         } catch (error) {
       console.error("Error refreshing scan vulnerabilities:", error);
     }
   }

   private async refreshVulnerabilityListsOnly(): Promise<void> {
     if (!this._view) {
       return;
     }

     try {
       // Clear API caches and fetch fresh data using regular project endpoints
       APIManager.clearAllCaches();
       
       const authenticated = await StorageManager.getValue<boolean>(StorageKeys.isLoggedIn);
       if (!authenticated) {
         return;
       }

       const potentialNames = await WorkspacManager.getWorkspacePotentialNames();
       if (!potentialNames || potentialNames.length === 0) {
         return;
       }

       // Fetch vulnerabilities using regular project endpoints
       const [response, scaResponse] = await Promise.all([
         APIManager.getProjectVulnerabilities(potentialNames).catch((error: any) => ({
           status: error.status,
           data: { status: "no_project_found", issues: [] },
         })),
         APIManager.getProjectSCAVulnerabilities(potentialNames).catch((error: any) => ({
           status: error.status,
           data: { status: "no_project_found", issues: [] },
         }))
       ]);

       const newVulnerabilities = response.data.issues || [];
       const newSCAVulnerabilities = scaResponse.data.issues || [];

       // Update internal state
       this._vulnerabilities = newVulnerabilities;
       this._scaVulnerabilities = newSCAVulnerabilities;
       this._projectNotFound = response.data.status === "no_project_found";
       
       // Group vulnerabilities by file and package
       const fileGroups = newVulnerabilities.length > 0 ? this._groupVulnerabilitiesByFile() : [];
       const packageGroups = newSCAVulnerabilities.length > 0 ? this._groupSCAVulnerabilitiesByPackage() : [];

       // Send update to webview (this won't affect the scanning tab)
       this._view.webview.postMessage({
         type: 'updateVulnerabilityLists',
         vulnerabilities: newVulnerabilities,
         scaVulnerabilities: newSCAVulnerabilities,
         fileGroups,
         packageGroups,
         hasVulnerabilities: newVulnerabilities.length > 0,
         hasSCAVulnerabilities: newSCAVulnerabilities.length > 0
       });
     } catch (error) {
       console.error("Error refreshing vulnerability lists only:", error);
     }
   }
 }

 