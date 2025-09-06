import * as vscode from "vscode";
import ContextManager from "./utils/contextManager";
import EventsManager from "./utils/eventsManager";
import CommandsManager from "./utils/commandsManager";
import providers from "./providers";
import services from "./services";

export function activate(context: vscode.ExtensionContext) {
  ContextManager.setContext(context);

  // Registering Commands
  CommandsManager.regiserCommandsListeners();

  // Registering Services
  services.forEach((service) => {
    service.activate();
    if ((service as any).initialize) {
      (service as any).initialize(context);
    }
  });

  // Registering Providers
  providers.forEach((provider) => {
    // Register webview provider
    vscode.window.registerWebviewViewProvider(provider.viewType, new provider(context.extensionUri));
  });

  // Registering Events
  vscode.workspace.onDidSaveTextDocument((document) => {
    EventsManager.emit("workspace.document_saved", document);
  });

  vscode.workspace.onDidOpenTextDocument((document) => {
    EventsManager.emit("workspace.document_opened", document);
  });

  vscode.workspace.onDidCloseTextDocument((document) => {
    EventsManager.emit("workspace.document_closed", document);
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    EventsManager.emit("workspace.document_changed", event.document);
  });

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        console.log("URI Handler called with:", uri.toString());
        EventsManager.emit("navigate", uri);
      },
    }),
  );
}

export function deactivate() {}
