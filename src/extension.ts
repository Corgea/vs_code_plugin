import * as vscode from 'vscode';
import { verifyAndStoreToken, getStoredApiKey, storeCorgeaUrl, getCorgeaUrl } from './tokenManager';
import { VulnerabilitiesProvider } from './vulnerabilitiesProvider';
import axios from 'axios'; // Ensure you install axios via npm
import * as path from 'path';


export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "corgea" is now active!');
    let disposable = vscode.commands.registerCommand('corgea.setApiKey', async () => {
        // First, ask for the Corgea URL
        const corgeaUrl = await vscode.window.showInputBox({
            value: 'https://www.corgea.app',
            prompt: "Enter the Corgea URL or use the default URL provided",
            ignoreFocusOut: true
        });

        // Store the Corgea URL
        if (corgeaUrl) {
            await storeCorgeaUrl(corgeaUrl, context);
        }


        // Then, ask for the API key
        const apiKey = await vscode.window.showInputBox({
            placeHolder: "Enter your Corgea API key",
            prompt: "API Key is needed to authenticate with Corgea",
            ignoreFocusOut: true
        });

        if (apiKey) {
			const isValid = await verifyAndStoreToken(apiKey, corgeaUrl, context);
            if (isValid) {
                vscode.window.showInformationMessage('API Key verified successfully. View the Corgea extension to start fixing.');
            }
        }

		// Register the vulnerabilities view
		const vulnerabilitiesProvider = new VulnerabilitiesProvider(context);
		vscode.window.registerTreeDataProvider('vulnerabilitiesView', vulnerabilitiesProvider);
		vscode.commands.registerCommand('vulnerabilities.refreshEntry', () => vulnerabilitiesProvider.refresh());

		// Refresh the view when a document is opened or saved
		vscode.workspace.onDidSaveTextDocument(document => {
			vulnerabilitiesProvider.refresh();
		});
		vscode.workspace.onDidOpenTextDocument(document => {
			vulnerabilitiesProvider.refresh();
		});

        // Register command to open a file
        let openFileCommand = vscode.commands.registerCommand('extension.openFile', (filePath) => {
            const openPath = vscode.Uri.file(filePath);
            vscode.workspace.openTextDocument(openPath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        });

    });

    // Register command to show vulnerability details
    vscode.commands.registerCommand('vulnerabilities.showDetails', async (vulnerability) => {
        const panel = vscode.window.createWebviewPanel(
            'vulnerabilityDetails',
            `Vulnerability Details: ${vulnerability.cwe_name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableCommandUris: true,
            }

        );

		try {
			// Fetch the full details from the API
			const corgeaUrl = await getCorgeaUrl(context);
			const apiKey = await getStoredApiKey(context);
			const url = `${corgeaUrl}/api/cli/issue/${vulnerability.id}`;
			const response = await axios.get(url, {
				params: { token: apiKey }
			});
			if (response.data && response.data.status === 'ok') {
				panel.webview.html = getWebviewContent(panel.webview, response.data, context, corgeaUrl);
			} else {
				panel.webview.html = `<html><body><h1>Error</h1><p>Could not load vulnerability details 123.</p></body></html>`;
			}
		} catch (error) {
			console.error(error);
			panel.webview.html = `<html><body><h1>Error</h1><p>Could not load vulnerability details 456.</p></body></html>`;
		}


    });

    context.subscriptions.push(disposable);
}


function getWebviewContent(webview: vscode.Webview, vulnerability, context: any, corgeaUrl: string) {

    const myStyle = webview.asWebviewUri(vscode.Uri.joinPath(
        context.extensionUri, 'media', 'main.css')); 


    const fullPath_working = vscode.workspace.workspaceFolders[0].uri.fsPath + "/" + vulnerability.issue.file_path

    console.log('fullPath_working', fullPath_working)

    const fullPath = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, vulnerability.issue.file_path));

    console.log('fullPath', fullPath.path)


    const fileUri = {
        scheme: 'file',
        path: fullPath.path,
        authority: ''
    };

    const CorgeaUri = {
        scheme: new URL(corgeaUrl).protocol.replace(':', ''),
        path: '/issue/' + vulnerability.issue.id,
        authority: corgeaUrl.replace(/^(https?:\/\/)/, '')
    };

    const filePath = encodeURIComponent(JSON.stringify(fileUri)); 

    const goToCorgea = encodeURIComponent(JSON.stringify(CorgeaUri));

    console.log('filePath', filePath)
    
    return /*html*/`
        <html>
        <head>		
            <meta http-equiv="Content-Security-Policy" content="default-src self; img-src vscode-resource:; script-src vscode-resource: 'self' 'unsafe-inline'; style-src vscode-resource: 'self' 'unsafe-inline'; "/>

            <link href="${myStyle}" rel="stylesheet" />
            <script src="https://cdn.jsdelivr.net/npm/diff2html@3.4.48/bundles/js/diff2html-ui.min.js"></script>
            <link href="https://cdn.jsdelivr.net/npm/diff2html@3.4.48/bundles/css/diff2html.min.css" rel="stylesheet">
        </head>
        <body>
            <h1>${vulnerability.issue.file_path}: ${vulnerability.issue.line_num}</h1>
            <hr>
            <strong>${vulnerability.issue.urgency} - Classification:${vulnerability.issue.classification}</strong><br><br>
            <button class="primary" onclick="alert('Hello!')">Apply Diff</button>
            <a href="command:vscode.open?${filePath}"><button class="secondary">See File</button></a>
            <a href="command:vscode.open?${goToCorgea}"><button class="secondary">See on Corgea</button></a>

            <br><br>
            <code>${vulnerability.fix.diff}</code>
            <div id="diffElement"></div>

            <br><br>
            <strong>Fix:</strong> ${vulnerability.fix.explanation}<br><br>
            <br><br>

            <script src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html.min.js"></script>
            <script>
                const targetElement = document.getElementById('diffElement');
                const diffHtml = Diff2Html.html('${vulnerability.fix.diff}', {
                    inputFormat: 'diff', outputFormat: 'side-by-side', showFiles: true, matching: 'lines'
                });
                targetElement.innerHTML = diffHtml;
            </script>


        </body>
        </html>
    `;
}

export function deactivate() {}
