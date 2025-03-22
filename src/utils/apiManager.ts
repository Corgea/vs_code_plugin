import axios, { AxiosInstance, AxiosResponse } from "axios";
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
  private static apiVersion: string = "v1";

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

  private static checkForWarnings(headers: any, status: number): void {
    if (headers['warning']) {
      const warnings = headers['warning'].split(',');
      warnings.forEach((warning: string) => {
        const code = warning.trim().split(' ')[0];
        if (code === '299') {
          vscode.window.showWarningMessage("This version of the Corgea plugin is deprecated. Please upgrade to the latest version to ensure continued support and better performance.");
        }
      });
    }
    if (status === 410) {
      vscode.window.showErrorMessage("Support for this extension version has dropped. Please upgrade Corgea extension immediately to continue using it.");
    }
  }

  private static async getBaseClient(showError: boolean = true): Promise<AxiosInstance> {
    const apiKey = await this.getApiKey();
    const client = axios.create({
      headers: { "CORGEA-TOKEN": apiKey },
    });

    client.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          if (showError) {
            vscode.window.showErrorMessage("Token is expired or invalid. Please update it.");
          }
        }
        return Promise.reject(error);
      }
    );

    return client;
  }

  public static async verifyToken(apiKey: string): Promise<boolean> {
    const corgeaUrl = await APIManager.getBaseUrl();
    APIManager.showLoadingStatus(
      "$(sync~spin) Corgea - Verifying API Key",
      "Verifying API Key",
    );
    try {
      const client = await this.getBaseClient(false);
      const url = `${corgeaUrl}/api/${this.apiVersion}/verify/${apiKey}`;
      const response = await client.get(url, {
        params: { url: corgeaUrl },
      });
      this.checkForWarnings(response.headers, response.status);
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
    APIManager.showLoadingStatus(
      "$(sync~spin) Corgea - Fetching Vulnerability",
      "Fetching Vulnerability Details From Corgea Cloud",
    );
    try {
      const client = await this.getBaseClient();
      const url = `${corgeaUrl}/api/${this.apiVersion}/issue/${vulnerabilityId}`;
      const response = await client.get(url);
      this.checkForWarnings(response.headers, response.status);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      APIManager.hideLoadingStatus();
    }
  }

  public static async getProjectVulnerabilities(
    workspacePath: string | string[],
  ): Promise<
    AxiosResponse<{
      status: string;
      page: number;
      total_pages: number;
      issues: Vulnerability[];
    }>
  > {
    const corgeaUrl = await APIManager.getBaseUrl();
    APIManager.showLoadingStatus();
    try {
      const client = await this.getBaseClient();
      let response: any;
      for (const path of workspacePath) {
        response = await client.get(`${corgeaUrl}/api/${this.apiVersion}/issues`, {
          params: {
            project: path,
          },
        });
        this.checkForWarnings(response.headers, response.status);
        if (response.data.status === "no_project_found") {
          continue;
        } else {
          break;
        }
      }
      return response;
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      APIManager.hideLoadingStatus();
    }
  }
}
