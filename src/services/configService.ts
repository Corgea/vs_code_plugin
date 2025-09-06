import APIManager from "../utils/apiManager";
import StorageManager, { StorageKeys } from "../utils/storageManager";
import { withErrorHandling } from "../utils/ErrorHandlingManager";

export interface CompanyConfigs {
  ide: {
    ide_scanning_enabled: boolean;
  };
}

export default class ConfigService {
  private static defaultConfigs: CompanyConfigs = {
    ide: {
      ide_scanning_enabled: true, 
    },
  };

  @withErrorHandling()
  public static async fetchAndStoreConfigs(): Promise<CompanyConfigs> {
    try {
      const response = await APIManager.getCompanyConfigs();
      if (response.status === "ok" && response.configs) {
        await StorageManager.setValue(StorageKeys.companyConfigs, response.configs);
        return response.configs;
      } else {
        return await this.getStoredConfigs();
      }
    } catch (error) {
      console.warn("Failed to fetch company configs, using stored or default configs:", error);
      return await this.getStoredConfigs();
    }
  }


  public static async getStoredConfigs(): Promise<CompanyConfigs> {
    try {
      const storedConfigs = await StorageManager.getValue<CompanyConfigs>(StorageKeys.companyConfigs);
      return storedConfigs || this.defaultConfigs;
    } catch (error) {
      console.warn("Failed to get stored configs, using defaults:", error);
      return this.defaultConfigs;
    }
  }


  public static async isIdeScanningEnabled(): Promise<boolean> {
    const configs = await this.getStoredConfigs();
    return configs.ide.ide_scanning_enabled;
  }


  public static async clearStoredConfigs(): Promise<void> {
    try {
      await StorageManager.setValue(StorageKeys.companyConfigs, undefined);
    } catch (error) {
      console.warn("Failed to clear stored configs:", error);
    }
  }

  public static activate() {}
}
