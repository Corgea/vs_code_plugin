import axios, { AxiosResponse } from "axios";
import StorageManager, {
  StorageKeys,
  StorageSecretKeys,
} from "./storageManager";
import Vulnerability from "../types/vulnerability";

export default class APIManager {
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

  public static async verifyToken(apiKey: string): Promise<boolean> {
    const corgeaUrl = await APIManager.getBaseUrl();
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
    }
  }

  public static async getVulnerabilityDetails(
    vulnerabilityId: string,
  ): Promise<any> {
    const corgeaUrl = await APIManager.getBaseUrl();
    const apiKey = await APIManager.getApiKey();
    try {
      const url = `${corgeaUrl}/api/cli/issue/${vulnerabilityId}`;
      const response = await axios.get(url, {
        params: { token: apiKey },
      });
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
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
    }
  }
}
