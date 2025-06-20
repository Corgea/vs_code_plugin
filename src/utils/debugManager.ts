import StorageManager, { StorageKeys } from "./storageManager";
import * as fs from "fs";
import * as path from "path";
import WorkspaceManager from "./workspaceManager";

export default class DebugManager {
  public static async log(message: string) {
    const debugModeEnabled = (await StorageManager.getValue(StorageKeys.debugModeEnabled)) === "true";
    if (debugModeEnabled) {
      const logFilePath = path.join(WorkspaceManager.getWorkspaceFolderURI()?.fsPath || "", ".vscode", "corgea.extension.log");
      const logDir = path.dirname(logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logContent = `[${new Date().toISOString()}] ${message}\n`;
      fs.appendFileSync(logFilePath, logContent);
    }
  }
}