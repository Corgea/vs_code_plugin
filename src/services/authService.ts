import * as vscode from "vscode";
import StorageManager, {
  StorageSecretKeys,
  StorageKeys,
} from "../utils/storageManager";
import APIManager from "../utils/apiManager";
import EventsManager from "../utils/eventsManager";
import { OnCommand } from "../utils/commandsManager";
import { withErrorHandling } from "../utils/ErrorHandlingManager";

export default class AuthService {
  @OnCommand("corgea.logout")
  public static logout(): void {
    StorageManager.setValue(StorageKeys.isLoggedIn, false);
    StorageManager.setValue(StorageKeys.corgeaUrl, undefined);
    StorageManager.setSecretValue(StorageSecretKeys.corgeaApiKey, "");
    EventsManager.emit("internal.logout");
    vscode.window.showInformationMessage(
      "You have been logged out successfully.",
    );
  }

  @OnCommand("corgea.setApiKey")
  @withErrorHandling()
  public static async setApiKey(): Promise<void> {
    const corgeaUrl = await vscode.window.showInputBox({
      value: "https://www.corgea.app",
      prompt: "Enter the Corgea URL or use the default URL provided",
      ignoreFocusOut: true,
    });
    if (corgeaUrl && corgeaUrl.trim() === "corgea_debug") {
      StorageManager.setValue(StorageKeys.debugModeEnabled, "true");
      vscode.window.showInformationMessage(
        "Debug mode enabled. Messages will be printed in the .vscode/corgea.extension.log file.",
      );
      return;
    }

    if (corgeaUrl) {
      StorageManager.setValue(StorageKeys.corgeaUrl, corgeaUrl);
    }

    const apiKey = await vscode.window.showInputBox({
      placeHolder: "Enter your Corgea API key",
      prompt: "API Key is found on the integrations page in Corgea.",
      ignoreFocusOut: true,
    });

    if (!apiKey || !corgeaUrl) {
      vscode.window.showErrorMessage("API Key or URL is missing.");
      return;
    }

    if (apiKey) {
      try {
        let isValid = await APIManager.verifyToken(apiKey);
        if (isValid) {
          StorageManager.setValue(StorageKeys.isLoggedIn, true);
          StorageManager.setSecretValue(StorageSecretKeys.corgeaApiKey, apiKey);
          EventsManager.emit("internal.login");
          vscode.window.showInformationMessage(
            "API Key verified successfully. View the Corgea extension to start fixing.",
          );
        } else {
          vscode.window.showErrorMessage("Invalid API Key. Please try again.");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          "Failed to verify API Key. Please check your connection and try again.",
        );
      }
    }
  }

  public static activate() {}
}
