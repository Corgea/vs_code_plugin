import * as vscode from "vscode";
import axios from "axios"; // Ensure you install axios via npm


// Function to retrieve the stored URL
export async function isAuthenticated(
    context: vscode.ExtensionContext
  ): Promise<boolean | undefined> {
    return context.globalState.get("isLoggedIn");
  }

// Function to retrieve the stored API key
export async function getStoredApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const secrets = context["secrets"];
  return await secrets.get("corgeaApiKey");
}

// Function to store the API key
export async function storeApiKey(
  apiKey: string,
  context: vscode.ExtensionContext
): Promise<void> {
  const secrets = context["secrets"];
  await secrets.store("corgeaApiKey", apiKey);
}

// Function to store the URL
export async function storeCorgeaUrl(
  url: string,
  context: vscode.ExtensionContext
): Promise<void> {
  context.globalState.update("corgeaUrl", url);
}

// Function to retrieve the stored URL
export async function getCorgeaUrl(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return context.globalState.get("corgeaUrl");
}

// Function to verify the API key with the Corgea API
export async function verifyAndStoreToken(
  apiKey: string,
  corgeaUrl: string,
  context: vscode.ExtensionContext
): Promise<boolean> {
  try {
    const url = `${corgeaUrl}/api/cli/verify/${apiKey}`;
    const response = await axios.get(url, {
      params: { url: corgeaUrl, token: apiKey },
    });

    if (response.data.status === "ok") {
      await context.globalState.update('isLoggedIn', true);
      await storeApiKey(apiKey, context);
      return true;
    }
    vscode.window.showErrorMessage("Invalid API Key. Please try again.");
    return false;
  } catch (error) {
    console.error(error);
    vscode.window.showErrorMessage(
      "Failed to verify API Key. Please check your connection and try again."
    );
    return false;
  }
}
