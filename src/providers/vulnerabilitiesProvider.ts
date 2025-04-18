import * as vscode from "vscode";
import WorkspacManager from "../utils/workspaceManager";
import APIManager from "../utils/apiManager";
import StorageManager, { StorageKeys } from "../utils/storageManager";
import { OnCommand } from "../utils/commandsManager";
import { OnEvent } from "../utils/eventsManager";

export default class VulnerabilitiesProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  public static readonly viewName = "vulnerabilitiesView";

  private static _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined
  > = new vscode.EventEmitter<TreeItem | undefined>();
  static readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  public get _onDidChangeTreeData(): vscode.EventEmitter<TreeItem | undefined> {
    return VulnerabilitiesProvider._onDidChangeTreeData;
  }

  public get onDidChangeTreeData(): vscode.Event<TreeItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  @OnCommand("vulnerabilities.refreshEntry")
  @OnEvent("workspace.document_opened")
  @OnEvent("workspace.document_saved")
  @OnEvent("internal.login")
  @OnEvent("internal.lgout")
  refresh(): void {
    VulnerabilitiesProvider._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
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
      const response = await APIManager.getProjectVulnerabilities(
        potentialNames,
      ).catch((error) => {
        console.error(error);
        vscode.window.showErrorMessage(
          "Corgea: Failed to fetch issues. Please try again.",
        );
        return undefined;
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
        return [
          new TreeItem(
            "This projects doesn't have fixes in Corgea.",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      const files = new Map<string, VulnerabilityItem[]>();

      response.data.issues.forEach((v) => {
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

      return Array.from(files.keys()).map(
        (filePath) => new FileItem(filePath, files.get(filePath) || []),
      );
    } else if (element instanceof FileItem) {
      return element.children;
    } else {
      return [];
    }
  }

  @OnEvent("internal.logout")
  clearData(): void {
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

class VulnerabilityItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
  ) {
    super(label, collapsibleState);
  }
}
