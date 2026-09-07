import * as vscode from "vscode";

/** A view docada na barra lateral (o que o ícone da Activity Bar tecnicamente abre — VS Code
 * exige que todo ícone de Activity Bar revele uma view real) não é onde a conversa acontece.
 * Ela só existe como um gatilho: assim que aparece, abre o painel flutuante de verdade
 * (LisaPanel, ao lado do editor) e fecha essa barra lateral fina de novo, pra não sobrar um
 * espaço vazio ocupando lugar. */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "lisaCode.chatView";

  constructor(private openFloating: () => void) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: false };
    webviewView.webview.html = `<!doctype html><body style="font-family:var(--vscode-font-family);padding:12px;color:var(--vscode-descriptionForeground);font-size:12px;">Abrindo a Lisa ao lado do editor…</body>`;

    const forward = () => {
      if (!webviewView.visible) return;
      this.openFloating();
      vscode.commands.executeCommand("workbench.action.closeSidebar");
    };
    forward();
    webviewView.onDidChangeVisibility(forward);
  }
}
