import * as vscode from "vscode";
import ContextManager from "./contextManager";

export default class CommandsManager {
  private static commandsListeners: { [key: string]: () => any } = {};

  public static regiserCommandsListeners(): void {
    for (const command in this.commandsListeners) {
      ContextManager.getContext().subscriptions.push(
        vscode.commands.registerCommand(
          command,
          this.commandsListeners[command],
        ),
      );
    }
  }

  public static registerCommandDecorator = (name: string): MethodDecorator => {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      CommandsManager.commandsListeners[name] = descriptor.value.bind(target);
    };
  };
}

export const OnCommand = CommandsManager.registerCommandDecorator;
