import { OnCommand } from "../utils/commandsManager";
import TerminalManager from "../utils/terminalManager";
import * as vscode from "vscode";
import ContextManager from "../utils/contextManager";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import StorageManager, { StorageKeys, StorageSecretKeys } from "../utils/storageManager";

export default class scanningService {
  
  @OnCommand("corgea.scan-uncommitted")
  public static async scanUncommittedFiles() {
    await scanningService.scanProject(false);
  }

  /*
    Scan cammand should only scan changed files unless the projecty doesnt have any previous scan results
    Options to be (forced full scan)
    before commit (git hooks integration), warning...
  */
  @OnCommand("corgea.scan-full")
  public static async scanProject(isFullScan: boolean = true) {
    const contextUri = ContextManager.getContext().extensionUri;
    const myVenvPath = vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myvenv");

    // Ensure the virtual environment is set up
    await scanningService.ensureVirtualEnvExists(contextUri, myVenvPath);

    const pythonPath = scanningService.getPythonPath();
    const corgeaPath = scanningService.getCorgeaPath();
    if (!pythonPath) {
      vscode.window.showErrorMessage("Could not determine Python path.");
      return;
    }

    // Check if corgea is installed
    if (!scanningService.isCorgeaInstalled(pythonPath.fsPath)) {
      vscode.window.showInformationMessage("Installing Corgea...");
      scanningService.installCorgea(pythonPath.fsPath);
    }

    // Set environment variables for Corgea CLI
    const corgeaUrl = await StorageManager.getValue(StorageKeys.corgeaUrl);
    const corgeaToken = await StorageManager.getSecretValue(StorageSecretKeys.corgeaApiKey);

    if (!corgeaUrl || !corgeaToken) {
      vscode.window.showErrorMessage("Corgea URL or API Key not set.");
      return;
    }

    // Execute corgea scan with environment variables
    const command = `${corgeaPath?.fsPath} scan`;
    let envCommand = "";
    if (os.platform() === "win32") {
      envCommand = `set CORGEA_URL="${corgeaUrl}"`;
    } else {
      envCommand = `export CORGEA_URL="${corgeaUrl}"`;
    }
    TerminalManager.executeCommand(envCommand);
    TerminalManager.executeCommand(`${corgeaPath?.fsPath} login ${corgeaToken}`);
    // Clear the terminal before executing the scan command
    if (os.platform() === "win32") {
      TerminalManager.executeCommand("cls");
    } else {
      TerminalManager.executeCommand("clear");
    }
    TerminalManager.executeCommand(`${corgeaPath?.fsPath} scan ${isFullScan ? "" : "--only-uncommitted"}`);
  }

  private static async ensureVirtualEnvExists(contextUri: vscode.Uri, myVenvPath: vscode.Uri) {
    try {
      await vscode.workspace.fs.stat(myVenvPath);
    } catch (error) {
      const platform = os.platform();
      let zipFileName = "";
      if (platform === "win32") {
        zipFileName = "myenv.windows.zip";
      } else if (platform === "darwin") {
        zipFileName = "myenv.mac.zip";
      } else if (platform === "linux") {
        zipFileName = "myenv.linux.zip";
      }

      const zipFilePath = vscode.Uri.joinPath(contextUri, `./assets/runtimes/python/${zipFileName}`);
      try {
        const extract = require('extract-zip');
        await extract(zipFilePath.fsPath, { dir: myVenvPath.fsPath });
      } catch (extractionError: any) {
        vscode.window.showErrorMessage(`Failed to setup virtual environment. Please try again.`);
        throw extractionError;
      }
    }
  }

  private static getPythonPath(): vscode.Uri | null {
    const contextUri = ContextManager.getContext().extensionUri;

    if (os.platform() === "win32") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myvenv/Scripts/python.exe");
    } else if (os.platform() === "darwin") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myvenv/bin/python3");
    } else if (os.platform() === "linux") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/myvenv/bin/python3");
    }
    
    return null;
  }

  private static getCorgeaPath(): vscode.Uri | null {
    const pythonPath = scanningService.getPythonPath();
    if (pythonPath) {
      let corgeaPath = path.dirname(pythonPath.fsPath);
      if (os.platform() === "win32") {
        corgeaPath = path.join(corgeaPath, "./corgea.exe");
      } else {
        corgeaPath = path.join(corgeaPath, "./corgea");
      }
      return vscode.Uri.file(corgeaPath);
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
      execSync(`${pythonPath} -m pip install corgea-cli`, { stdio: "inherit" });
      vscode.window.showInformationMessage("Corgea installed successfully!");
    } catch (error) {
      vscode.window.showErrorMessage("Failed to install Corgea.");
    }
  }

  public static activate() {}
}
