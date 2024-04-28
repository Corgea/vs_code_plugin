// utils.ts
import * as vscode from 'vscode';
import * as path from 'path';


export function getWorkspaceFolderPath(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        // Get the path of the first workspace folder
        const fullPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        // Return only the last part of the path
        return path.basename(fullPath);
    }
    return undefined;
}