import axios, { AxiosResponse } from "axios";
import StorageManager, {
  StorageKeys,
  StorageSecretKeys,
} from "./storageManager";
import Vulnerability from "../types/vulnerability";
import VulnerabilityDetails from "../types/vulnerabilityDetails";
import * as vscode from "vscode";

export default class APIManager {
  private static statusBarItem: vscode.StatusBarItem | undefined;
  private static isStatusBarVisible: boolean = false;

  private static async getBaseUrl(): Promise<string> {
    const baseUrl = await StorageManager.getValue(StorageKeys.corgeaUrl);
    if (!baseUrl) throw new Error("Base URL not set");
    return baseUrl;
  }

  private static async getApiKey(): Promise<string> {
    const apiKey = await StorageManager.getSecretValue(
      StorageSecretKeys.corgeaApiKey,
    );
    if (!apiKey) throw new Error("API Key not set");
    return apiKey;
  }

  private static showLoadingStatus(
    message: string = "$(sync~spin) Corgea - Loading vulnerabilities...",
    tooltip: string = "Processing vulnerabilities",
  ): void {
    if (!this.statusBarItem) {
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
      );
    }
    if (this.isStatusBarVisible) {
      return;
    }
    this.statusBarItem.text = message;
    this.statusBarItem.tooltip = tooltip;
    this.isStatusBarVisible = true;
    this.statusBarItem.show();
  }
  private static hideLoadingStatus(): void {
    if (this.statusBarItem && this.isStatusBarVisible) {
      this.isStatusBarVisible = false;
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
    }
  }

  public static async verifyToken(apiKey: string): Promise<boolean> {
    const corgeaUrl = await APIManager.getBaseUrl();
    APIManager.showLoadingStatus(
      "$(sync~spin) Corgea - Verifying API Key",
      "Verifying API Key",
    );
    try {
      const url = `${corgeaUrl}/api/cli/verify/${apiKey}`;
      const response = await axios.get(url, {
        params: { url: corgeaUrl, token: apiKey },
      });
      if (response.data.status === "ok") return true;
      return false;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.hideLoadingStatus();
    }
  }

  public static async getVulnerabilityDetails(
    vulnerabilityId: string,
  ): Promise<VulnerabilityDetails> {
    const corgeaUrl = await APIManager.getBaseUrl();
    const apiKey = await APIManager.getApiKey();
    APIManager.showLoadingStatus(
      "$(sync~spin) Corgea - Fetching Vulnerability",
      "Fetching Vulnerability Details From Corgea Cloud",
    );
    try {
      const url = `${corgeaUrl}/api/cli/issue/${vulnerabilityId}`;
      const response = await axios.get(url, {
        params: { token: apiKey },
      });
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      APIManager.hideLoadingStatus();
    }
  }

  public static async getProjectVulnerabilities(workspacePath: string): Promise<
    AxiosResponse<{
      status: string;
      issues: Vulnerability[];
    }>
  > {
    const corgeaUrl = await APIManager.getBaseUrl();
    const apiKey = await APIManager.getApiKey();
    APIManager.showLoadingStatus();
    try {
      const response = await axios.get(`${corgeaUrl}/api/cli/issues`, {
        params: {
          token: apiKey,
          project: workspacePath,
        },
      });
      return response;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      APIManager.hideLoadingStatus();
    }
  }
}
