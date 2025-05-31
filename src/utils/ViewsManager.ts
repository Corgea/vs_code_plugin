import { compileFile } from "pug";
import ContextManager from "./contextManager";
import * as vscode from "vscode";

export enum Views {
  VulnerabilityDetails = "vulnerabilityDetails.pug",
  SCAVulnerabilityDetails = "scaVulnerabilityDetails.pug",
  GenericError = "genericError.pug",
}

export default class ViewsManager {
  public static render(view: Views, data: any): string {
    const path = vscode.Uri.joinPath(
      ContextManager.getContext().extensionUri,
      "./assets/views/",
      view,
    );
    const template = compileFile(path.fsPath);
    return template(data);
  }
}
