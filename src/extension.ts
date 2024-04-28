import * as vscode from 'vscode';
import { verifyAndStoreToken, getStoredApiKey, storeCorgeaUrl, getCorgeaUrl } from './tokenManager';
import { VulnerabilitiesProvider } from './vulnerabilitiesProvider';
import axios from 'axios'; // Ensure you install axios via npm


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

    });

    // Register command to show vulnerability details
    vscode.commands.registerCommand('vulnerabilities.showDetails', async (vulnerability) => {
        const panel = vscode.window.createWebviewPanel(
            'vulnerabilityDetails',
            `Vulnerability Details: ${vulnerability.cwe_name}`,
            vscode.ViewColumn.One,
            {}
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
				panel.webview.html = getWebviewContent(response.data);
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


function getWebviewContent(vulnerability) {
    return /*html*/`
        <html>
        <head>		
        </head>
        <body>
            <h1>${vulnerability.issue.file_path}: ${vulnerability.issue.line_num}</h1>
			<strong>Classification:${vulnerability.issue.classification}</strong>
			<strong>File:</strong> ${vulnerability.issue.file_path}<br>
            <strong>Severity:</strong> ${vulnerability.issue.urgency}<br>
            <strong>Description:</strong> ${vulnerability.issue.description}<br>
			<button onclick="alert('Hello!')">Click me</button>
			<vscode-button id="howdy">Apply Diff</vscode-button>
			<vscode-button id="howdy">Issue PR</vscode-button>
            <strong>Fix:</strong> ${vulnerability.fix.description}<br>
			<code>${vulnerability.fix.diff}</code>
        </body>
        </html>
    `;
}

export function deactivate() {}
