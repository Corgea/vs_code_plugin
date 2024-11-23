import * as vscode from "vscode";
import * as path from "path";

export default class WorkspaceManager {
  public static getWorkspaceFolderURI(): vscode.Uri | undefined {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      return vscode.workspace.workspaceFolders[0].uri;
    }
    return undefined;
  }

  public static getWorkspaceFolderPath(): string | undefined {
    const workspaceURI = this.getWorkspaceFolderURI();
    if (!workspaceURI) {
      return undefined;
    }
    return path.basename(workspaceURI.fsPath);
  }

  public static getRelativePathToWorkspace(
    doc: vscode.TextDocument,
  ): string | undefined {
    const workspaceFolder = this.getWorkspaceFolderURI();
    if (!workspaceFolder) {
      return undefined;
    }
    const documentPath = doc.uri.fsPath;
    const workspacePath = workspaceFolder.fsPath;
    return path.relative(workspacePath, documentPath);
  }

  public static comparePaths(path1: string, path2: string): boolean {
    const normalizedPath1 = path.normalize(path1);
    const normalizedPath2 = path.normalize(path2);

    return normalizedPath1 === normalizedPath2;
  }
}
