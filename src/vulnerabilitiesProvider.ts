import * as vscode from 'vscode';
import { getCorgeaUrl, getStoredApiKey, isAuthenticated } from './tokenManager';
import axios from 'axios';
import { getWorkspaceFolderPath } from './utils';


export class VulnerabilitiesProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {

            const authenticated = await isAuthenticated(this.context); // Check if the user is authenticated
            if (!authenticated) {
                // Return a TreeItem that prompts the user to authenticate
                return [new TreeItem("Not logged in - Run '>Corgea: Login' from the command pallete", vscode.TreeItemCollapsibleState.None)];
            }


            const workspacePath = getWorkspaceFolderPath();
            if (!workspacePath) {
                vscode.window.showInformationMessage('No fixes loaded from Corgea as no workspace is open. Open a workspace and try again.');
                return [];
            }

        
            // Fetch vulnerabilities here
            const url = await getCorgeaUrl(this.context);
            const apiKey = await getStoredApiKey(this.context);
            
            const response = await axios.get(`${url}/api/cli/issues`, { 
                params: { 
                    token: apiKey, 
                    project: workspacePath
                } 
            }).catch(error => {
                console.error(error);
                vscode.window.showErrorMessage('Corgea: Failed to fetch issues. Please try again.');
                return [];
            });

            if (response.status >= 400) { 
                vscode.window.showInformationMessage('Corgea: No issues found. Please check your API key and try again.');
                return [];
            }

            if (response.data.issues === null) {  
                vscode.window.showInformationMessage('Corgea: No issues found for this project.');
                return [];
            }


            const files = new Map<string, VulnerabilityItem[]>();
            response.data.issues.forEach(v => {
                const filePath = v.file_path;
                if (!files.has(filePath)) {
                    files.set(filePath, []);
                }

                let label;
                if (v.hold_fix === true) {
                    label = '- On Hold';
                } else {
                    label = '';
                }

                const classification = v.classification.match(/(?:\('([^']+)'\))|$/);
                // Use the matched group if available, otherwise fall back to the original classification string
                const vulnerabilityLabel = classification && classification[1] ? classification[1] : v.classification.replace(/^CWE-\d+: /, '');
                const vulnerabilityItemLabel = `${v.urgency} - ${vulnerabilityLabel}: ${v.line_num} ${label}`;
                files.get(filePath).push(new VulnerabilityItem(vulnerabilityItemLabel, vscode.TreeItemCollapsibleState.None, {
                    command: 'vulnerabilities.showDetails',
                    title: "Show Vulnerability Details",
                    arguments: [v]
                }));
            });

            // Sort vulnerabilities by line number ascending
            Array.from(files.keys()).sort().forEach(filePath => {
                const vulnerabilities = files.get(filePath);
                vulnerabilities.sort((a, b) => {
                    const lineNumA = parseInt(a.label.split(':')[1].trim());
                    const lineNumB = parseInt(b.label.split(':')[1].trim());
                    return lineNumA - lineNumB;
                });
            });

            return Array.from(files.keys()).map(filePath => 
                new FileItem(filePath, files.get(filePath))
            );
        } else if (element instanceof FileItem) {
            return element.children;
        } else {
            return [];
        }
    }


    clearData(): void {
        this._onDidChangeTreeData.fire(undefined);
      }
    
    
}

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

class FileItem extends TreeItem {
    children: VulnerabilityItem[];

    constructor(
        public readonly label: string,
        children: VulnerabilityItem[]
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.children = children;
    }
}

class VulnerabilityItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}
