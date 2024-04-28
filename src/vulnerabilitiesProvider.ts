import * as vscode from 'vscode';
import { getCorgeaUrl, getStoredApiKey } from './tokenManager';
import axios from 'axios';

export class VulnerabilitiesProvider implements vscode.TreeDataProvider<VulnerabilityItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<VulnerabilityItem | undefined> = new vscode.EventEmitter<VulnerabilityItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<VulnerabilityItem | undefined> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: VulnerabilityItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: VulnerabilityItem): Promise<VulnerabilityItem[]> {
        if (!element) {
            // Fetch vulnerabilities here
            const url = await getCorgeaUrl(this.context);
            const apiKey = await getStoredApiKey(this.context);
            const response = await axios.get(`${url}/api/cli/issues`, { params: { token: apiKey } });
            return response.data.issues.map(v => {
                const filePath = `${v.file_path}:${v.line_num} - ${v.classification}`;
                return new VulnerabilityItem(filePath, vscode.TreeItemCollapsibleState.None, {
                    command: 'vulnerabilities.showDetails',
                    title: "Show Vulnerabiity Details",
                    arguments: [v]
                });
            });
        } else {
            return [];
        }
    }
}

class VulnerabilityItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}
