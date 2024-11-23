import ContextManager from "./contextManager";

export enum StorageKeys {
  isLoggedIn = "isLoggedIn",
  corgeaUrl = "corgeaUrl",
}

export enum StorageSecretKeys {
  corgeaApiKey = "corgeaApiKey",
}

export default class StorageManager {
  public static async getValue<T = string>(
    key: StorageKeys,
  ): Promise<T | undefined> {
    return ContextManager.getContext().globalState.get(key);
  }

  public static async setValue<T = string>(
    key: StorageKeys,
    value: T,
  ): Promise<void> {
    ContextManager.getContext().globalState.update(key, value);
  }

  public static async getSecretValue(
    key: StorageSecretKeys,
  ): Promise<string | undefined> {
    const secrets = ContextManager.getContext()["secrets"];
    return await secrets.get(key);
  }

  public static async setSecretValue(
    key: StorageSecretKeys,
    value: string,
  ): Promise<void> {
    const secrets = ContextManager.getContext()["secrets"];
    await secrets.store(key, value);
  }
}
