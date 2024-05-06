async function loadToolkit() {
    const toolkit = await import('@vscode/webview-ui-toolkit');
    const { provideVSCodeDesignSystem, vsCodeButton } = toolkit;
    provideVSCodeDesignSystem().register(vsCodeButton());
}

loadToolkit();