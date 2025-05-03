import { OnCommand } from "../utils/commandsManager";
import TerminalManager from "../utils/terminalManager";
import * as vscode from "vscode";
import ContextManager from "../utils/contextManager";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import StorageManager, {
  StorageKeys,
  StorageSecretKeys,
} from "../utils/storageManager";

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
    const myVenvPath = vscode.Uri.joinPath(
      contextUri,
      "./assets/runtimes/python/myvenv",
    );

    // Ensure the virtual environment is set up
    await scanningService.ensureVirtualEnvExists(contextUri, myVenvPath);

    const pythonPath = scanningService.getPythonPath();
    const corgeaPath = scanningService.getCorgeaPath();
    if (!pythonPath) {
      vscode.window.showErrorMessage("Could not determine Python path.");
      return;
    }

    // Check if corgea is installed
    if (!scanningService.isCorgeaInstalled()) {
      vscode.window.showInformationMessage("Installing Corgea cli...");
      scanningService.installCorgea(pythonPath.fsPath);
    }

    // Set environment variables for Corgea CLI
    const corgeaUrl = await StorageManager.getValue(StorageKeys.corgeaUrl);
    const corgeaToken = await StorageManager.getSecretValue(
      StorageSecretKeys.corgeaApiKey,
    );

    if (!corgeaUrl || !corgeaToken) {
      vscode.window.showErrorMessage("Corgea URL or API Key not set.");
      return;
    }

    // Execute corgea scan with environment variables
    const command = `${corgeaPath?.fsPath} scan`;
    let envCommand = "";
    if (scanningService.getPlatform() === "windows") {
      envCommand = `set CORGEA_URL="${corgeaUrl}"`;
    } else {
      envCommand = `export CORGEA_URL="${corgeaUrl}"`;
    }
    TerminalManager.executeCommand(envCommand);
    TerminalManager.executeCommand(
      `${corgeaPath?.fsPath} login ${corgeaToken}`,
    );
    // Clear the terminal before executing the scan command
    if (scanningService.getPlatform() === "windows") {
      TerminalManager.executeCommand("cls");
    } else {
      TerminalManager.executeCommand("clear");
    }
    TerminalManager.executeCommand(
      `${corgeaPath?.fsPath} scan ${isFullScan ? "" : "--only-uncommitted"}`,
    );
  }

  private static async ensureVirtualEnvExists(
    contextUri: vscode.Uri,
    myVenvPath: vscode.Uri,
  ) {
    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.joinPath(myVenvPath, `./python`),
      );
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
        contextUri,
        `./assets/runtimes/python/${tarFileName}`,
      );
      // create the directory if it doesn't exist
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
    const contextUri = ContextManager.getContext().extensionUri;

    if (os.platform() === "win32") {
      return vscode.Uri.joinPath(
        contextUri,
        "./assets/runtimes/python/myvenv/python/python.exe",
      );
    } else if (os.platform() === "darwin") {
      return vscode.Uri.joinPath(
        contextUri,
        "./assets/runtimes/python/myvenv/python/bin/python",
      );
    } else if (os.platform() === "linux") {
      return vscode.Uri.joinPath(
        contextUri,
        "./assets/runtimes/python/myvenv/python/bin/python",
      );
    }

    return null;
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
      execSync(`${pythonPath} -m pip install corgea-cli`, { stdio: "inherit" });
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

  public static activate() {}
}
