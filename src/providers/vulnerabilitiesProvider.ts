import * as vscode from "vscode";
import WorkspacManager from "../utils/workspaceManager";
import APIManager from "../utils/apiManager";
import StorageManager, { StorageKeys } from "../utils/storageManager";
import { OnCommand } from "../utils/commandsManager";
import { OnEvent } from "../utils/eventsManager";

interface CacheEntry {
  data: TreeItem[];
  timestamp: number;
  workspaceNames: string[];
}

export default class VulnerabilitiesProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  public static readonly viewName = "vulnerabilitiesView";

  private static _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined
  > = new vscode.EventEmitter<TreeItem | undefined>();
  static readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  // Add static promise to prevent concurrent API calls
  private static currentRequest: Promise<TreeItem[]> | null = null;

  public get _onDidChangeTreeData(): vscode.EventEmitter<TreeItem | undefined> {
    return VulnerabilitiesProvider._onDidChangeTreeData;
  }

  public get onDidChangeTreeData(): vscode.Event<TreeItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  @OnCommand("vulnerabilities.refreshEntry")
  @OnEvent("internal.login")
  @OnEvent("internal.logout")
  @OnCommand("corgea.refreshVulnerabilities")
  refresh(): void {
    // Clear the current request when refreshing to force a new fetch
    APIManager.clearAllCaches();
    VulnerabilitiesProvider.currentRequest = null;
    VulnerabilitiesProvider._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // If there's already a request in progress, return it
      if (VulnerabilitiesProvider.currentRequest) {
        return VulnerabilitiesProvider.currentRequest;
      }

      // Create a new request and store it
      VulnerabilitiesProvider.currentRequest = this.fetchRootChildren();
      
      try {
        const result = await VulnerabilitiesProvider.currentRequest;
        return result;
      } finally {
        // Clear the request when it completes (success or error)
        VulnerabilitiesProvider.currentRequest = null;
      }
    } else if (
      element instanceof FileItem ||
      element instanceof VulnerabilityListSection
    ) {
      return element.children;
    } else {
      return [
        new TreeItem(
          "This projects doesn't have fixes in Corgea.",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }
  }

  private async fetchRootChildren(): Promise<TreeItem[]> {
    const authenticated = await StorageManager.getValue<boolean>(
      StorageKeys.isLoggedIn,
    );
    if (!authenticated) {
      const helpMessage = new TreeItem(
        "Seems like you are not logged in.",
        vscode.TreeItemCollapsibleState.None,
      );
      const loginItem = new vscode.TreeItem(
        "Click Here to login",
        vscode.TreeItemCollapsibleState.None,
      );

      loginItem.command = {
        command: "corgea.setApiKey",
        title: "Login",
      };

      loginItem.iconPath = new vscode.ThemeIcon("key");
      return [helpMessage, loginItem as TreeItem];
    }

    const potentialNames = await WorkspacManager.getWorkspacePotentialNames();
    if (!potentialNames || potentialNames.length === 0) {
      return [
        new TreeItem(
          "This projects doesn't have fixes in Corgea.",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    // Fetch fresh data
    const repoNames = await WorkspacManager.getWorkspaceRepoNames();
    const response = await APIManager.getProjectVulnerabilities(
      potentialNames,
      repoNames
    ).catch(async (error: any) => {
      if (error.status == 401) {
        await StorageManager.setValue<boolean>(StorageKeys.isLoggedIn, false);
      }
      return {
        status: error.status,
        data: {
          status: "no_project_found",
        },
        issues: [],
      } as any;
    });

    const scaResponse = await APIManager.getProjectSCAVulnerabilities(
      potentialNames,
    ).catch(async (error: any) => {
      return {
        status: error.status,
        data: {
          status: "no_project_found",
          issues: [],
        },
      } as any;
    });

    if (!response) {
      return [];
    }
    if (response.status >= 400 && response.status < 500) {
      vscode.window.showInformationMessage(
        "Corgea: No issues found. Please check your API key and try again.",
      );
      return [];
    }

    if (response.data.status === "no_project_found") {
      const result = [
        new TreeItem(
          "This projects doesn't have fixes in Corgea.",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
      return result;
    }
    let hasSCAVulnerabilities = false;
    if (scaResponse.data.issues && scaResponse.data.issues.length > 0) {
      hasSCAVulnerabilities = true;
    }

    const files = new Map<string, VulnerabilityItem[]>();
    if (response.data.issues.length === 0 && !hasSCAVulnerabilities) {
      const result = [
        new TreeItem(
          "Project doesnt't have any issue",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
      return result;
    }

    response.data.issues.forEach((v: any) => {
      const filePath = v.location.file.path;
      if (!files.has(filePath)) {
        files.set(filePath, []);
      }

      let label = v.status; // Default label is empty
      const vulnerabilityLabel = v.classification?.name;
      const vulnerabilityItemLabel = `${v.urgency}${label ? " - " : ""}${label} - ${vulnerabilityLabel}: ${v.location.line_number}`;
      let file = files.get(filePath);

      if (file) {
        file.push(
          new VulnerabilityItem(
            vulnerabilityItemLabel,
            vscode.TreeItemCollapsibleState.None,
            {
              command: "vulnerabilities.showDetails",
              title: "Show Vulnerability Details",
              arguments: [v],
            },
          ),
        );
      } else {
        console.error("File not found");
        //show error message
        vscode.window.showInformationMessage(
          "Corgea: File not found. Please check if the file exists.",
        );
      }
    });

    // Sort vulnerabilities by line number ascending
    Array.from(files.keys())
      .sort()
      .forEach((filePath) => {
        const vulnerabilities = files.get(filePath);
        if (!vulnerabilities) {
          vscode.window.showInformationMessage(
            "Corgea: No vulnerabilities found.",
          );
          return;
        }
        vulnerabilities.sort((a, b) => {
          const lineNumA = parseInt(a.label.split(":")[1].trim());
          const lineNumB = parseInt(b.label.split(":")[1].trim());
          return lineNumA - lineNumB;
        });
      });
    const vulnerabilitiesList = Array.from(files.keys()).map(
      (filePath) => new FileItem(filePath, files.get(filePath) || []),
    );
    
    let result: TreeItem[];
    if (!hasSCAVulnerabilities) {
      result = vulnerabilitiesList;
    } else {
      const scaPackages = new Map<string, VulnerabilityItem[]>();
      scaResponse.data.issues?.forEach((v: any) => {
        const key = `${v.package.name}`;
        if (!scaPackages.has(key)) {
          scaPackages.set(key, []);
        }
        scaPackages.get(key)?.push(
          new VulnerabilityItem(
            `${v.cve}: ${v.severity} Severity - Fixed in ${v.package.fix_version}`,
            vscode.TreeItemCollapsibleState.None,
            {
              command: "vulnerabilities.showSCAVulnerabilityDetails",
              title: "Show SCA Vulnerability Details",
              arguments: [v, scaResponse.data.issues, scaResponse.data.project],
            },
          ),
        );
      });
      const scaPackagesList = Array.from(scaPackages.keys()).map(
        (packageName) =>
          new VulnerabilityListSection(
            packageName,
            scaPackages.get(packageName) || [],
          ),
      );
      result = [
        new VulnerabilityListSection(
          `Code Vulnerabilities (${response.data.issues.length})`,
          vulnerabilitiesList,
        ),
        new VulnerabilityListSection(
          `SCA Vulnerabilities (${scaResponse.data.issues?.length || 0})`,
          scaPackagesList,
        ),
      ];
    }

    return result;
  }

  @OnEvent("internal.logout")
  clearData(): void {
    // Clear the current request when logging out
    VulnerabilitiesProvider.currentRequest = null;
    VulnerabilitiesProvider._onDidChangeTreeData.fire(undefined);
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }
}

class FileItem extends TreeItem {
  children: VulnerabilityItem[];

  constructor(
    public readonly label: string,
    children: VulnerabilityItem[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.children = children;
  }
}

class VulnerabilityListSection extends TreeItem {
  children: VulnerabilityItem[];

  constructor(
    public readonly label: string,
    children: VulnerabilityItem[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.children = children;
  }
}

class VulnerabilityItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
  ) {
    super(label, collapsibleState);
  }
}
