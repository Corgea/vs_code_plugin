import { OnCommand } from "../utils/commandsManager";
import TerminalManager from "../utils/terminalManager";
import * as vscode from "vscode";
import ContextManager from "../utils/contextManager";
import * as os from "os";
import * as path from "path";

export default class scanningService {
  
  @OnCommand("corgea.scan")
  public static async scanProject() {
    const pythonPath = scanningService.getPythonPath();

    if (!pythonPath) {
      vscode.window.showErrorMessage("Could not determine Python path.");
      return;
    }

    // Execute the corgea scan directly using the .whl file
    const contextUri = ContextManager.getContext().extensionUri;
    const corgeaWhlPath = vscode.Uri.joinPath(contextUri, "./assets/packages/cli/corgea_cli-1.5.1-py3-none-win_amd64.whl");
    const command = `${pythonPath.fsPath} ${corgeaWhlPath.fsPath} scan`;
    TerminalManager.executeCommand(command);
  }

  private static getPythonPath(): vscode.Uri | null {
    const contextUri = ContextManager.getContext().extensionUri;

    if (os.platform() === "win32") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/windows/python.exe");
    } else if (os.platform() === "darwin") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/mac/bin/python3");
    } else if (os.platform() === "linux") {
      return vscode.Uri.joinPath(contextUri, "./assets/runtimes/python/linux/bin/python3");
    }
    
    return null;
  }

  public static activate() {}
}
