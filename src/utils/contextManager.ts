import * as vscode from "vscode";

export default class ContextManager {
  private static context: vscode.ExtensionContext;

  public static getContext(): vscode.ExtensionContext {
    if (!this.context) throw new Error("Context not set");
    return this.context;
  }

  public static setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }
}
