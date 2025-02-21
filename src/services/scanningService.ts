import { OnCommand } from "../utils/commandsManager";
import TerminalManager from "../utils/terminalManager";
import * as vscode from "vscode";
import ContextManager from "../utils/contextManager";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";

export default class scanningService {
  
  @OnCommand("corgea.scan")
  public static async scanProject() {
    const pythonPath = scanningService.getPythonPath();

    if (!pythonPath) {
      vscode.window.showErrorMessage("Could not determine Python path.");
      return;
    }

    // Check if corgea is installed
    if (!scanningService.isCorgeaInstalled(pythonPath.fsPath)) {
      vscode.window.showInformationMessage("Installing Corgea...");
      scanningService.installCorgea(pythonPath.fsPath);
    }

    // Execute corgea scan
    const command = `${pythonPath.fsPath} -m corgea scan`;
    TerminalManager.executeCommand(command);
  }

  private static getPythonPath(): vscode.Uri | null {
    const contextUri = ContextManager.getContext().extensionUri;

    if (os.platform() === "win32") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myenv/Scripts/python.exe");
    } else if (os.platform() === "darwin") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myenv/bin/python3");
    } else if (os.platform() === "linux") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myenv/bin/python3");
    }
    
    return null;
  }

  private static isCorgeaInstalled(pythonPath: string): boolean {
    try {
      execSync(`${pythonPath} -m corgea --help`, { stdio: "ignore" });
      return true;
    } catch (error) {
      return false;
    }
  }

  private static installCorgea(pythonPath: string): void {
    try {
      execSync(`${pythonPath} -m pip install corgea`, { stdio: "inherit" });
      vscode.window.showInformationMessage("Corgea installed successfully!");
    } catch (error) {
      vscode.window.showErrorMessage("Failed to install Corgea.");
    }
  }

  public static activate() {}
}
