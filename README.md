# Corgea for Visual Studio Code

Corgea for Visual Studio Code is an extension that helps developers automatically detect and fix security vulnerabilities in their code. By integrating AI-driven insights directly into your development environment, Corgea ensures that your codebase remains secure against the latest threats with minimal manual intervention.

## Features

- **Vulnerability Fixes Suggestions**: Provides AI-generated fixes for identified vulnerabilities.
- **Interactive Vulnerability Panel**: Displays a dedicated sidebar panel with a detailed list of potential security issues.
- **Diff Patching**: Allows you to apply suggested fixes directly with a simple click.
- **Webview Details Panel**: Shows detailed vulnerability descriptions and remediation advice within a rich webview panel.
- **API Key and URL Configuration**: Configure your connection to the Corgea backend easily through VS Code commands.
- **Login**: Securely log in from VS Code.

## Requirements

- **Corgea account**: have an active Corgea account. 
- **Visual Studio Code**: 1.50 or newer.

## Installation

To install the Corgea extension, follow these steps:

1. Open Visual Studio Code and navigate to the Extensions view by clicking on the square icon on the sidebar or pressing `Ctrl+Shift+X`.
2. Search for "Corgea" and click on the install button.
3. Once installed, you'll need to configure the API key and Corgea URL through the command palette (`Ctrl+Shift+P`), then select `Corgea: Set API Key`.

## Getting Started

Once the Corgea extension is installed and configured:

1. **Set the API Key**: Open the command palette and run `Corgea: Login`. Follow the prompts to enter your Corgea URL and API key.
2. **View Vulnerabilities**: Open the Corgea sidebar to see the current issues in your code.
3. **Apply Fixes**: Click on a vulnerability to view details and apply fixes directly from the webview panel.


---

For more information visit [Corgea's Documentation website](https://docs.corgea.app).
