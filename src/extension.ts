import * as vscode from "vscode";
import {
  isAuthenticated,
  verifyAndStoreToken,
  getStoredApiKey,
  storeCorgeaUrl,
  getCorgeaUrl,
} from "./tokenManager.js";
import { VulnerabilitiesProvider } from "./vulnerabilitiesProvider.js";
import axios from "axios"; // Ensure you install axios via npm
import * as path from "path";
import { applyPatch } from "diff";

export function activate(context: vscode.ExtensionContext) {
  // Register the vulnerabilities view
  const vulnerabilitiesProvider = new VulnerabilitiesProvider(context);

  vscode.window.registerTreeDataProvider(
    "vulnerabilitiesView",
    vulnerabilitiesProvider
  );

  // Register the refresh command
  vscode.commands.registerCommand("vulnerabilities.refreshEntry", () =>
    vulnerabilitiesProvider.refresh()
  );

  // Refresh the view when a document is saved
  vscode.workspace.onDidSaveTextDocument((document) => {
    vulnerabilitiesProvider.refresh();
  });

  // Refresh the view when a document is opened
  vscode.workspace.onDidOpenTextDocument((document) => {
    vulnerabilitiesProvider.refresh();
  });

  // Register the applyDiff command to apply the fix
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "corgea.applyDiff",
      async (fileUri: vscode.Uri, diff: string) => {
        const document = await vscode.workspace.openTextDocument(fileUri);

        const currentContent = document.getText();
        const newContent = applyPatch(currentContent, diff);

        if (newContent === false) {
          vscode.window.showErrorMessage(
            "The diff couldn't be applied. This is likely due to your code being modified since the fix was generated. Please refresh the vulnerabilities and try again."
          );
          return;
        }

        const lineNum = parseInt(fileUri.fragment.replace("L", ""));
        const linePos = new vscode.Position(lineNum, 0);
        const range = new vscode.Range(linePos, linePos);

        const editor = await vscode.window.showTextDocument(document, { selection: range });

        await editor.edit((editBuilder) => {
          const entireRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(currentContent.length)
          );
          editBuilder.replace(entireRange, newContent);
        });

        vscode.window.showInformationMessage(
          "Fix applied successfully. Save the file to reflect the changes."
        );
      }
    )
  );

  // Register the logout command
  context.subscriptions.push(
    vscode.commands.registerCommand("corgea.logout", async () => {
      // Remove the API key and URL
      await context.globalState.update("corgeaApiKey", undefined);
      await context.globalState.update("corgeaUrl", undefined);

      // Update the login status
      await context.globalState.update("isLoggedIn", false);

      // Clear the vulnerabilities
      vulnerabilitiesProvider.clearData();

      vscode.window.showInformationMessage(
        "You have been logged out successfully."
      );
    })
  );

  // Register the setApiKey command
  let disposable = vscode.commands.registerCommand(
    "corgea.setApiKey",
    async () => {
      // First, ask for the Corgea URL
      const corgeaUrl = await vscode.window.showInputBox({
        value: "https://www.corgea.app",
        prompt: "Enter the Corgea URL or use the default URL provided",
        ignoreFocusOut: true,
      });

      // Store the Corgea URL
      if (corgeaUrl) {
        await storeCorgeaUrl(corgeaUrl, context);
      }

      // Then, ask for the API key
      const apiKey = await vscode.window.showInputBox({
        placeHolder: "Enter your Corgea API key",
        prompt: "API Key is found on the integrations page in Corgea.",
        ignoreFocusOut: true,
      });

      // Verify the API key
      if (apiKey) {
        try {
          const isValid = await verifyAndStoreToken(apiKey, corgeaUrl, context);
          if (isValid) {
            vulnerabilitiesProvider.refresh();
            vscode.window.showInformationMessage(
              "API Key verified successfully. View the Corgea extension to start fixing."
            );
          }
        } catch (error) {
          console.error(error);
          vscode.window.showErrorMessage(
            "Error occurred while verifying the API key. Please try again."
          );
        }
      }
    }
  );

  const panels = new Map<string, vscode.WebviewPanel>();

  // Register command to show vulnerability details
  vscode.commands.registerCommand(
    "vulnerabilities.showDetails",
    async (vulnerability) => {
      const fileName = path.basename(vulnerability.file_path);
      const panelId = `Corgea: ${fileName}:${vulnerability.line_num}`;

      let panel = panels.get(panelId);
      if (panel) {
        panel.reveal(vscode.ViewColumn.One);
      } else {
        panel = vscode.window.createWebviewPanel(
          "vulnerabilityDetails",
          panelId,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            enableCommandUris: true,
          }
        );
        panels.set(panelId, panel);

        panel.onDidDispose(() => {
          panels.delete(panelId);
        });
      }

      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case "applyDiff":
              applyDiffCommand(message.fileUri, message.diff);
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      function applyDiffCommand(fileUri: string, diff: any) {
        const uri = vscode.Uri.parse(fileUri);
        vscode.commands.executeCommand("corgea.applyDiff", uri, diff);
      } 

      try {
        // Fetch the full details from the API
        const corgeaUrl = await getCorgeaUrl(context);
        const apiKey = await getStoredApiKey(context);
        const url = `${corgeaUrl ?? ""}/api/cli/issue/${vulnerability.id}`;
        const response = await axios.get(url, {
          params: { token: apiKey },
        });
        if (response.data && response.data.status === "ok") {
          panel.webview.html = getWebviewContent(
            panel.webview,
            response.data,
            context,
            corgeaUrl ?? ""
          );
        } else {
          panel.webview.html = `<html><body><h1>Error</h1><p>Could not load vulnerability details.</p></body></html>`;
        }
      } catch (error) {
        console.error(error);
        if (
          (error as any).response &&
          (error as any).response.status >= 400 &&
          (error as any).response.status < 500
        ) {
          panel.webview.html = `<html><body><h1>Error</h1><p>Client error occurred while loading vulnerability details.</p></body></html>`;
        } else {
          panel.webview.html = `<html><body><h1>Error</h1><p>Could not load vulnerability details.</p></body></html>`;
        }
      }
    }
  );

  context.subscriptions.push(disposable);
}

// Function to get the webview content
function getWebviewContent(
  webview: vscode.Webview,
  vulnerability: any,
  context: any,
  corgeaUrl: string
) {
  const myStyle = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "main.css")
  );

  const fullPath = vscode.Uri.file(
    path.join(
      vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath ?? "",
      vulnerability.issue.file_path
    )
  );

  const fileUri = vscode.Uri.parse(
    fullPath.with({ fragment: `L${vulnerability.issue.line_num}` }).toString()
  );

  const CorgeaUri = {
    scheme: new URL(corgeaUrl).protocol.replace(":", ""),
    path: "/issue/" + vulnerability.issue.id,
    authority: corgeaUrl.replace(/^(https?:\/\/)/, ""),
  };

  const filePath = encodeURIComponent(JSON.stringify(fileUri));

  const filePathString = fileUri.toString();

  const goToCorgea = encodeURIComponent(JSON.stringify(CorgeaUri));

  const diffString = vulnerability.fix.diff;

  try {
    const false_positive_reason = vulnerability.issue.false_positive.reasoning;

  } catch (error) {
    const false_positive_reason = NaN;
  }

  const logoPath = vscode.Uri.joinPath(
    context.extensionUri,
    "images",
    "logo.png"
  );
  const logoSrc = webview.asWebviewUri(logoPath);

  return /*html*/ `
        <html>
        <head>  
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                img-src ${webview.cspSource} https:;
                style-src 'unsafe-inline' https://cdn.jsdelivr.net ${
                  webview.cspSource
                } https://cdnjs.cloudflare.com;
                script-src 'unsafe-inline' https://cdn.jsdelivr.net ${
                  webview.cspSource
                };
            ">
            <link href="${myStyle}" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css" media="screen and (prefers-color-scheme: dark)" />
            <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
            <script src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js"></script>
        </head>
        <body>        
            
            <h1><img src="${logoSrc}" alt="Logo" width="50"><a href="command:vscode.open?${filePath}">${
    vulnerability.issue.file_path
  }: ${vulnerability.issue.line_num}</a></h1>
            <strong><span class="${vulnerability.issue.urgency} severity">${
    vulnerability.issue.urgency
  }</span></strong> ${vulnerability.issue.classification}
  <hr>
  <a href="command:vscode.open?${goToCorgea}"><button class="btn-secondary">See on Corgea</button></a>
  ${vulnerability.issue.on_hold? /*html*/ 
      `
        <div class="card">
          <div class="card-header">Could Not Issue Fix</div>
        ${
          vulnerability.issue.hold_reason === "language"
            ? /*html*/ `<div class="card-body"><p class="fix_explanation">Corgea currently does not support this language.</p></div>`
            : vulnerability.issue.hold_reason === "plan"
            ? /*html*/ `<div class="card-body"><p class="fix_explanation">You've reached the limit of your plan. Please upgrade to get all the fixes.</p></div>`
            : vulnerability.issue.hold_reason === "false_positive"
            ? /*html*/ `<div class="card-body"><p class="fix_explanation"><h3>False Positive Detected</h3>${false_positive_reason}</p></div>`
            : vulnerability.issue.hold_reason === "gpt_error"
            ? /*html*/ `<div class="card-body"><p class="fix_explanation">Corgea was unable to generate a fix for this issue. This was because the fix suggested failed our QA checks. This was likely due to the AI not generating a best practice fix or it did not have enough context to generate a fix.</p></div>`
            : /*html*/ `<div class="card-body"><p class="fix_explanation">Corgea was unable to generate a fix for this issue. This was because the fix suggested failed our QA checks. This was likely due to the AI not generating a best practice fix or it did not have enough context to generate a fix.</p></div>`
        }</div>
      `
      : /*html*/ `
        ${vulnerability.fix.diff
            ? /*html*/ `
        <button class="btn-primary" onclick="applyDiff()">Apply Fix</button>
        <br><br>

        <div id="diffElement"></div>

        <br><br>
        <div class="card">
          <div class="card-header">Fix Explanation</div>
          <div class="card-body"><p class="fix_explanation">${vulnerability.fix.explanation}</p></div>
        </div>

        <script>

        const diffString = ${JSON.stringify(diffString)};

        document.addEventListener('DOMContentLoaded', function () {
          var targetElement = document.getElementById('diffElement');
          const configuration = { drawFileList: true, matching: 'lines', highlight: true, outputFormat: 'side-by-side', colorScheme: 'dark'};
          var diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
          diff2htmlUi.draw();
          diff2htmlUi.highlightCode();
        });

        const vscode = acquireVsCodeApi();

        function applyDiff() {
            const diff =  diffString;
            const fileUri = "${filePathString}";
            console.log(fileUri);
            vscode.postMessage({
                command: 'applyDiff',
                fileUri: fileUri,
                diff: diff
            });
        }
      </script>


        `
        : `
        <div class="card">
          <div class="card-header">Fix In Progress</div>
          <div class="card-body"><p class="fix_explanation">Corgea is processing the issue and will create a fix soon. Please check again later.</p></div>
        </div>
          `
        }
      `
  }
          

        </body>
        </html>
    `;
}

export function deactivate() {}
