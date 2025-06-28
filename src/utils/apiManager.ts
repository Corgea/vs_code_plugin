import axios, { AxiosInstance, AxiosResponse } from "axios";
import StorageManager, {
  StorageKeys,
  StorageSecretKeys,
} from "./storageManager";
import Vulnerability from "../types/vulnerability";
import VulnerabilityDetails from "../types/vulnerabilityDetails";
import * as vscode from "vscode";
import SCAVulnerability from "../types/scaVulnerability";
import DebugManager from "./debugManager";

const cacheMap = new Map<string, {data: any, timestamp: number}>();
const pendingRequests = new Map<string, Promise<any>>();

function cache(ttlSeconds: number = 10) {
  
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    const cachedMethod = async function (...args: any[]) {
      const cacheKey = `${propertyKey}-${JSON.stringify(args)}`;
      const now = Date.now();
      const cached = cacheMap.get(cacheKey);

      // Check if we have a valid cached result
      if (cached && (now - cached.timestamp) < ttlSeconds * 1000) {
        return cached.data;
      }

      // Check if there's already a pending request with the same parameters
      const pendingRequest = pendingRequests.get(cacheKey);
      if (pendingRequest) {
        return await pendingRequest;
      }

      // Create a new promise for this request
      const requestPromise = (async () => {
        try {
          // Call original method and cache result
          const result = await originalMethod.apply(target, args);
          cacheMap.set(cacheKey, {
            data: result,
            timestamp: now
          });
          return result;
        } finally {
          // Clean up the pending request
          pendingRequests.delete(cacheKey);
        }
      })();

      // Store the pending request
      pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;
    };
    
    cachedMethod.withoutCache = async function (...args: any[]) {
      return await originalMethod.apply(this, args);
    };
    
    descriptor.value = cachedMethod;
    return descriptor;
  };
}

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

  public static clearAllCaches(): void {
    cacheMap.clear();
    pendingRequests.clear();
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
    if (headers["warning"]) {
      const warnings = headers["warning"].split(",");
      warnings.forEach((warning: string) => {
        const code = warning.trim().split(" ")[0];
        if (code === "299") {
          vscode.window.showWarningMessage(
            "This version of the Corgea plugin is deprecated. Please upgrade to the latest version to ensure continued support and better performance.",
          );
        }
      });
    }
    if (status === 410) {
      vscode.window.showErrorMessage(
        "Support for this extension version has dropped. Please upgrade Corgea extension immediately to continue using it.",
      );
    }
  }

  private static async getBaseClient(
    showError: boolean = true,
    throwOnMissingToken: boolean = true,
  ): Promise<AxiosInstance> {
    let apiKey;
    try {
      apiKey = await this.getApiKey();
    } catch (error) {
      if (throwOnMissingToken) {
        throw error;
      }
    }
    const client = axios.create({
      headers: apiKey ? { "CORGEA-TOKEN": apiKey } : undefined,
    });

    // Request interceptor
    client.interceptors.request.use(
      async (config) => {
        await DebugManager.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
        await DebugManager.log(`Request Headers: ${JSON.stringify(config.headers)}`);
        await DebugManager.log(`Request Params: ${JSON.stringify(config.params)}`);
        await DebugManager.log(`Request Data: ${JSON.stringify(config.data)}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      async (response) => {
        await DebugManager.log(`Response Status: ${response.status}`);
        await DebugManager.log(`Response Headers: ${JSON.stringify(response.headers)}`);
        await DebugManager.log(`Response Data: ${JSON.stringify(response.data)}`);
        return response;
      },
      async (error) => {
        if (error.response) {
          await DebugManager.log(`Error Status: ${error.response.status}`);
          await DebugManager.log(`Error Headers: ${JSON.stringify(error.response.headers)}`);
          await DebugManager.log(`Error Data: ${JSON.stringify(error.response.data)}`);
          
          if (error.response.status === 401 && showError) {
            vscode.window.showErrorMessage(
              "Token is expired or invalid. Please update it.",
            );
          }
        } else {
          await DebugManager.log(`Request Error: ${error.message}`);
        }
        return Promise.reject(error);
      },
    );

    return client;
  }

  @cache()
  public static async verifyToken(apiKey: string): Promise<boolean> {
    const corgeaUrl = await APIManager.getBaseUrl();
    APIManager.showLoadingStatus(
      "$(sync~spin) Corgea - Verifying API Key",
      "Verifying API Key",
    );
    try {
      const client = await this.getBaseClient(false, false);
      const url = `${corgeaUrl}/api/${this.apiVersion}/verify/${apiKey}`;
      const response = await client.get(url, {
        params: { url: corgeaUrl },
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

  @cache(60)
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

  @cache(60 * 10)
  public static async getProjectVulnerabilities(
    workspacePath: string[],
    repoName: string[] = []
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
      const loopItem: {path?: string, repo?: string}[] = [...workspacePath.map(p => ({path: p})), ...repoName.map(p => ({repo: p}))]
      for (const item of loopItem) {
        // Fetch all pages recursively
        const allIssues: Vulnerability[] = [];
        let currentPage = 1;
        let totalPages = 1;
        
        do {
          const params: {page: number, page_size: number, repo?: string, project?: string} = {
            page: currentPage,
            page_size: 50,
          }
          if (item.repo) {
            params.repo = item.repo
          } else {
            params.project = item.path
          }
          response = await client.get(
            `${corgeaUrl}/api/${this.apiVersion}/issues`,
            {
              params: params
            }
          );
          this.checkForWarnings(response.headers, response.status);
          
          if (response.data.status === "no_project_found") {
            break;
          }
          
          if (response.data.status === "ok" && response.data.issues) {
            allIssues.push(...response.data.issues);
            totalPages = response.data.total_pages;
            currentPage++;
          } else {
            break;
          }
        } while (currentPage <= totalPages);
        
        // If we found issues, return the combined result
        if (allIssues.length > 0) {
          return {
            ...response,
            data: {
              status: "ok",
              page: 1,
              total_pages: 1,
              issues: allIssues,
            },
          };
        }
      }
      
      // If no issues found in any workspace path, return empty result
      return {
        ...response,
        data: {
          status: "ok",
          page: 1,
          total_pages: 1,
          issues: [],
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      APIManager.hideLoadingStatus();
    }
  }

  @cache(100)
  public static async getProjectSCAVulnerabilities(
    workspacePath: string | string[],
  ): Promise<
    AxiosResponse<{
      status: string;
      page: number;
      total_pages: number;
      total_issues: number;
      issues: SCAVulnerability[];
      project: string;
    }>
  > {
    const corgeaUrl = await APIManager.getBaseUrl();
    APIManager.showLoadingStatus();
    try {
      const client = await this.getBaseClient();
      let response: any;
      
      for (const path of workspacePath) {
        // Fetch all pages recursively
        const allIssues: SCAVulnerability[] = [];
        let currentPage = 1;
        let totalPages = 1;
        let totalIssues = 0;
        
        do {
          response = await client.get(
            `${corgeaUrl}/api/${this.apiVersion}/issues/sca`,
            {
              params: {
                project: path,
                page: currentPage,
                page_size: 50, // Maximum page size as per API
              },
            },
          );
          this.checkForWarnings(response.headers, response.status);
          
          if (response.data.status === "no_project_found") {
            break;
          }
          
          if (response.data.status === "ok" && response.data.issues) {
            allIssues.push(...response.data.issues);
            totalPages = response.data.total_pages;
            totalIssues = response.data.total_issues;
            currentPage++;
          } else {
            break;
          }
        } while (currentPage <= totalPages);
        
        // If we found issues, return the combined result
        if (allIssues.length > 0) {
          return {
            ...response,
            data: {
              status: "ok",
              page: 1,
              total_pages: 1,
              total_issues: totalIssues,
              issues: allIssues,
              project: path,
            },
          };
        }
      }
      
      // If no issues found in any workspace path, return empty result
      return {
        ...response,
        data: {
          status: "ok",
          page: 1,
          total_pages: 1,
          total_issues: 0,
          issues: [],
          project: "",
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      APIManager.hideLoadingStatus();
    }
  }
}
