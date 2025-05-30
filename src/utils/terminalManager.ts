import * as vscode from "vscode";

export default class TerminalManager {
  public static executeCommand(command: string): void {
    let terminal = vscode.window.terminals.find((t) => t.name === "Corgea");
    if (!terminal) {
      terminal = vscode.window.createTerminal("Corgea");
    }
    terminal.show();
    terminal.sendText(command);
  }
}
