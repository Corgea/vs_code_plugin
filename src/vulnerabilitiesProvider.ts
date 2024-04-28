import * as vscode from 'vscode';
import { getCorgeaUrl, getStoredApiKey } from './tokenManager';
import axios from 'axios';

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
            // Fetch vulnerabilities here
            const url = await getCorgeaUrl(this.context);
            const apiKey = await getStoredApiKey(this.context);
            const response = await axios.get(`${url}/api/cli/issues`, { params: { token: apiKey } });
            const files = new Map<string, VulnerabilityItem[]>();

            response.data.issues.forEach(v => {
                const filePath = v.file_path;
                if (!files.has(filePath)) {
                    files.set(filePath, []);
                }
                files.get(filePath).push(new VulnerabilityItem(`${v.urgency} - ${v.classification}: ${v.line_num}`, vscode.TreeItemCollapsibleState.None, {
                    command: 'vulnerabilities.showDetails',
                    title: "Show Vulnerability Details",
                    arguments: [v]
                }));
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
