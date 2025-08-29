import * as vscode from "vscode";
import StorageManager, {
  StorageSecretKeys,
  StorageKeys,
} from "../utils/storageManager";
import APIManager from "../utils/apiManager";
import EventsManager from "../utils/eventsManager";
import { OnCommand } from "../utils/commandsManager";
import { OnEvent } from "../utils/eventsManager";
import { withErrorHandling } from "../utils/ErrorHandlingManager";

export default class AuthService {
  private static _isOAuthInProgress = false;
  private static _oauthCancelToken: vscode.CancellationTokenSource | null = null;
  private static _context: vscode.ExtensionContext | null = null;

  public static initialize(context: vscode.ExtensionContext): void {
    AuthService._context = context;
  }

  private static getCallbackUri(): string {
    if (!AuthService._context) {
      throw new Error("AuthService not initialized with context");
    }
    return `${vscode.env.uriScheme}://${AuthService._context.extension.id}/callback`;
  }

  private static updateOAuthLoadingState(isLoading: boolean): void {
    // Use EventsManager to safely communicate with the webview provider
    EventsManager.emit("oauth.loading.update", isLoading);
  }

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

  @OnCommand("corgea.oauthLogin")
  @withErrorHandling()
  public static async oauthLogin(): Promise<void> {
    if (AuthService._isOAuthInProgress) {
      vscode.window.showWarningMessage("OAuth login is already in progress.");
      return;
    }

    try {
      AuthService._isOAuthInProgress = true;
      AuthService._oauthCancelToken = new vscode.CancellationTokenSource();

      // Update UI loading state
      AuthService.updateOAuthLoadingState(true);

      // Set the Corgea URL for OAuth
      const corgeaUrl = "https://www.corgea.app";
      StorageManager.setValue(StorageKeys.corgeaUrl, corgeaUrl);

      // Open the OAuth URL with proper callback
      const callbackUrl = AuthService.getCallbackUri();
      const authUrl = `${corgeaUrl}/authorize?callback=${encodeURIComponent(callbackUrl)}`;
      await vscode.env.openExternal(vscode.Uri.parse(authUrl));

      // Show progress with cancel option
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Waiting for authentication...",
          cancellable: true,
        },
        async (progress, token) => {
          return new Promise<void>((resolve, reject) => {
            // Set up cancellation
            const onCancel = () => {
              AuthService._isOAuthInProgress = false;
              AuthService._oauthCancelToken?.dispose();
              AuthService._oauthCancelToken = null;
              reject(new Error("Authentication cancelled by user"));
            };

            token.onCancellationRequested(onCancel);
            
            if (AuthService._oauthCancelToken) {
              AuthService._oauthCancelToken.token.onCancellationRequested(onCancel);
            }

            // Set up a simple polling mechanism for OAuth success
            const checkInterval = setInterval(() => {
              if (!AuthService._isOAuthInProgress) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 1000);

            // Set a timeout for the authentication
            setTimeout(() => {
              if (AuthService._isOAuthInProgress) {
                clearInterval(checkInterval);
                AuthService._isOAuthInProgress = false;
                AuthService._oauthCancelToken?.dispose();
                AuthService._oauthCancelToken = null;
                reject(new Error("Authentication timed out. Please try again."));
              }
            }, 300000); // 5 minutes timeout
          });
        }
      );

      vscode.window.showInformationMessage(
        "Authentication successful! View the Corgea extension to start fixing."
      );
    } catch (error: any) {
      AuthService._isOAuthInProgress = false;
      AuthService._oauthCancelToken?.dispose();
      AuthService._oauthCancelToken = null;
      
      // Update UI loading state
      AuthService.updateOAuthLoadingState(false);
      
      if (error.message !== "Authentication cancelled by user") {
        vscode.window.showErrorMessage(
          error.message || "Authentication failed. Please try again."
        );
      }
    }
  }

  @OnCommand("corgea.submitEnterpriseLogin")
  @withErrorHandling()
  public static async submitEnterpriseLogin(scope: string): Promise<void> {
    if (!scope || scope.trim() === "") {
      vscode.window.showErrorMessage("Scope is required");
      return;
    }

    const trimmedScope = scope.trim();

    if (trimmedScope === "corgea_debug") {
      StorageManager.setValue(StorageKeys.debugModeEnabled, "true");
      vscode.window.showInformationMessage(
        "Debug mode enabled. Messages will be printed in the .vscode/corgea.extension.log file.",
      );
      return;
    }

    // Construct the enterprise URL using the scope
    const enterpriseUrl = `https://${trimmedScope}.corgea.app`;
    StorageManager.setValue(StorageKeys.corgeaUrl, enterpriseUrl);

    if (AuthService._isOAuthInProgress) {
      vscode.window.showWarningMessage("OAuth login is already in progress.");
      return;
    }

    try {
      AuthService._isOAuthInProgress = true;
      AuthService._oauthCancelToken = new vscode.CancellationTokenSource();

      // Update UI loading state
      AuthService.updateOAuthLoadingState(true);

      // Open the OAuth URL for enterprise with proper callback
      const callbackUrl = AuthService.getCallbackUri();
      const authUrl = `${enterpriseUrl}/authorize?callback=${encodeURIComponent(callbackUrl)}`;
      await vscode.env.openExternal(vscode.Uri.parse(authUrl));

      // Show progress with cancel option
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Waiting for authentication at ${trimmedScope}.corgea.app...`,
          cancellable: true,
        },
        async (progress, token) => {
          return new Promise<void>((resolve, reject) => {
            // Set up cancellation
            const onCancel = () => {
              AuthService._isOAuthInProgress = false;
              AuthService._oauthCancelToken?.dispose();
              AuthService._oauthCancelToken = null;
              reject(new Error("Authentication cancelled by user"));
            };

            token.onCancellationRequested(onCancel);
            
            if (AuthService._oauthCancelToken) {
              AuthService._oauthCancelToken.token.onCancellationRequested(onCancel);
            }

            // Set up a simple polling mechanism for OAuth success
            const checkInterval = setInterval(() => {
              if (!AuthService._isOAuthInProgress) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 1000);

            // Set a timeout for the authentication
            setTimeout(() => {
              if (AuthService._isOAuthInProgress) {
                clearInterval(checkInterval);
                AuthService._isOAuthInProgress = false;
                AuthService._oauthCancelToken?.dispose();
                AuthService._oauthCancelToken = null;
                reject(new Error("Authentication timed out. Please try again."));
              }
            }, 300000); // 5 minutes timeout
          });
        }
      );

      vscode.window.showInformationMessage(
        "Enterprise authentication successful! View the Corgea extension to start fixing."
      );
    } catch (error: any) {
      AuthService._isOAuthInProgress = false;
      AuthService._oauthCancelToken?.dispose();
      AuthService._oauthCancelToken = null;
      
      // Update UI loading state
      AuthService.updateOAuthLoadingState(false);
      
      if (error.message !== "Authentication cancelled by user") {
        vscode.window.showErrorMessage(
          error.message || "Enterprise authentication failed. Please try again."
        );
      }
    }
  }

  @OnEvent("navigate")
  public static async handleNavigation(uri: vscode.Uri): Promise<void> {
    // Handle OAuth callback
    if (uri.path === '/callback') {
      await AuthService.handleOAuthCallback(uri);
    }
  }

  private static async handleOAuthCallback(uri: vscode.Uri): Promise<void> {
    try {
      const query = new URLSearchParams(uri.query);
      const code = query.get('code');

      if (!code) {
        throw new Error("No authorization code received");
      }

      // Exchange code for API key
      const corgeaUrl = await StorageManager.getValue<string>(StorageKeys.corgeaUrl) || "https://www.corgea.app";
      const response = await APIManager.exchangeOAuthCode(code, corgeaUrl);

      if (response.status === "ok" && response.user_token) {
        // Store the API key and set as logged in
        StorageManager.setValue(StorageKeys.isLoggedIn, true);
        StorageManager.setSecretValue(StorageSecretKeys.corgeaApiKey, response.user_token);
        
        // Mark OAuth as completed
        AuthService._isOAuthInProgress = false;
        
        // Update UI loading state
        AuthService.updateOAuthLoadingState(false);
        
        EventsManager.emit("internal.login");
      } else {
        throw new Error("Failed to exchange authorization code for API key");
      }
    } catch (error: any) {
      AuthService._isOAuthInProgress = false;
      AuthService._oauthCancelToken?.dispose();
      AuthService._oauthCancelToken = null;
      
      // Update UI loading state
      AuthService.updateOAuthLoadingState(false);
      
      vscode.window.showErrorMessage(
        `OAuth authentication failed: ${error.message}`
      );
    }
  }

  @OnCommand("corgea.loginWithApiKey")
  @withErrorHandling()
  public static async loginWithApiKey(): Promise<void> {
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
      let fixedUrl = corgeaUrl;
      if (!fixedUrl.includes("http")) {
        fixedUrl = `https://${fixedUrl}`;
      }
      if (fixedUrl.endsWith("/")) {
        fixedUrl = fixedUrl.slice(0, -1);
      }
      StorageManager.setValue(StorageKeys.corgeaUrl, fixedUrl);
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

  @OnCommand("corgea.cancelOAuth")
  public static cancelOAuth(): void {
    if (AuthService._oauthCancelToken) {
      AuthService._oauthCancelToken.cancel();
    }
    AuthService._isOAuthInProgress = false;
    AuthService._oauthCancelToken?.dispose();
    AuthService._oauthCancelToken = null;
    
    // Update UI loading state
    AuthService.updateOAuthLoadingState(false);
    
    vscode.window.showInformationMessage("OAuth authentication cancelled.");
  }

  public static activate() { }
}
