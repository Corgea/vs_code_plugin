import * as vscode from "vscode";
import WorkspacManager from "../utils/workspaceManager";
import APIManager from "../utils/apiManager";
import StorageManager, { StorageKeys } from "../utils/storageManager";
import { OnCommand } from "../utils/commandsManager";
import { OnEvent } from "../utils/eventsManager";
import ViewsManager, { Views } from "../utils/ViewsManager";
import Vulnerability from "../types/vulnerability";
import SCAVulnerability from "../types/scaVulnerability";

export default class VulnerabilitiesWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "vulnerabilitiesWebview";
  
  private static _instance?: VulnerabilitiesWebviewProvider;
  private _view?: vscode.WebviewView;
  private _vulnerabilities: Vulnerability[] = [];
  private _scaVulnerabilities: SCAVulnerability[] = [];
  private _isLoading = false;
  private _projectNotFound = false;

  constructor(private readonly _extensionUri: vscode.Uri) {
    VulnerabilitiesWebviewProvider._instance = this;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

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
          console.log('Login button clicked from webview');
          vscode.commands.executeCommand("corgea.setApiKey");
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
        default:
          console.log('Unknown message type:', data.type);
      }
    });

    // Load initial data
    this.refresh();
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

    const isAuthenticated = await StorageManager.getValue<boolean>(StorageKeys.isLoggedIn);
    const hasVulnerabilities = this._vulnerabilities.length > 0;
    const hasSCAVulnerabilities = this._scaVulnerabilities.length > 0;


    // Group vulnerabilities by file
    const fileGroups = hasVulnerabilities ? this._groupVulnerabilitiesByFile() : [];
    
    // Group SCA vulnerabilities by package
    const packageGroups = hasSCAVulnerabilities ? this._groupSCAVulnerabilitiesByPackage() : [];

    return ViewsManager.render(Views.VulnerabilitiesList, {
      cspSource: webview.cspSource,
      styleURI: styleMainUri.toString(),
      logoURI: logoUri.toString(),
      isLoading: this._isLoading,
      isAuthenticated,
      hasVulnerabilities,
      hasSCAVulnerabilities,
      projectNotFound: this._projectNotFound,
      vulnerabilities: this._vulnerabilities,
      scaVulnerabilities: this._scaVulnerabilities,
      fileGroups,
      packageGroups,
    });
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
}

 