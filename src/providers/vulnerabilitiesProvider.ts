import * as vscode from "vscode";
import WorkspacManager from "../utils/workspaceManager";
import APIManager from "../utils/apiManager";
import StorageManager, { StorageKeys } from "../utils/storageManager";
import { OnCommand } from "../utils/commandsManager";
import { OnEvent } from "../utils/eventsManager";
import GitManager from "../utils/gitManager";
import * as path from "path";

export default class VulnerabilitiesProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  public static readonly viewName = "vulnerabilitiesView";

  private static _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined
  > = new vscode.EventEmitter<TreeItem | undefined>();
  static readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  @OnCommand("vulnerabilities.refreshEntry")
  @OnEvent("workspace.document_opened")
  @OnEvent("workspace.document_saved")
  @OnEvent("internal.login")
  refresh(): void {
    VulnerabilitiesProvider._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      const authenticated = StorageManager.getValue<boolean>(
        StorageKeys.isLoggedIn,
      );
      if (!authenticated) {
        return [
          new TreeItem(
            "Not logged in - Run '>Corgea: Login' from the command pallete.",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      let workspacePath: any = WorkspacManager.getWorkspaceFolderURI();
      workspacePath = workspacePath ? workspacePath.fsPath : undefined;
      if (!workspacePath) {
        // Return a TreeItem that show that no fixes were loaded.
        return [
          new TreeItem(
            "This projects doesn't have fixes in Corgea.",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
      const remotes = (await GitManager.getRemoteUrls(workspacePath))
        .map((item) => {
          const repoName = item.split("/").pop()?.replace(".git", "");
          return repoName || "";
        })
        .filter(Boolean);
      const response = await APIManager.getProjectVulnerabilities([
        path.basename(workspacePath),
        ...remotes,
      ]).catch((error) => {
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
        const filePath = v.file_path;
        if (!files.has(filePath)) {
          files.set(filePath, []);
        }

        let label = ""; // Default label is empty

        if (v.hold_fix === true) {
          switch (v.hold_reason) {
            case "language":
              label = "- Unsupported";
              break;
            case "gpt_error":
              label = "- On Hold";
              break;
            case "false_positive":
              label = "- False Positive Detected";
              break;
            case "plan":
              label = "- On Hold";
              break;
            default:
              label = "- Unspecified Reason"; // Optional: Handle unexpected reasons
          }
        }

        const classification = v.classification.match(/(?:\('([^']+)'\))|$/);
        // Use the matched group if available, otherwise fall back to the original classification string
        const vulnerabilityLabel =
          classification && classification[1]
            ? classification[1]
            : v.classification.replace(/^CWE-\d+: /, "");
        const vulnerabilityItemLabel = `${v.urgency} - ${vulnerabilityLabel}: ${v.line_num} ${label}`;
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
