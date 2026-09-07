import * as vscode from "vscode";
import { LisaClient } from "./lisaClient";
import { getChatHtml, bindChatMessages, ChatHandle } from "./chatWebview";

/** O "widget flutuante" pedido — a API estável do VS Code não tem overlay flutuante de verdade,
 * então o mais próximo (e honesto) é um WebviewPanel aberto ao lado do editor: o usuário pode
 * arrastar a aba pra fora e virar uma janela separada de verdade (comportamento nativo do VS
 * Code em qualquer aba). Fica como singleton — clicar no ícone de novo só traz o mesmo painel
 * pra frente, não abre um segundo. */
export class LisaPanel {
  private static current: LisaPanel | undefined;
  private panel: vscode.WebviewPanel;
  private handle: ChatHandle;

  private constructor(client: LisaClient) {
    this.panel = vscode.window.createWebviewPanel(
      "lisaCode.floating",
      "Lisa Code",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.webview.html = getChatHtml();
    this.handle = bindChatMessages(this.panel.webview, client);
    this.panel.onDidDispose(() => {
      this.handle.dispose(); // solta os listeners de contexto (ver bindChatMessages)
      LisaPanel.current = undefined;
    });
  }

  static open(client: LisaClient) {
    if (LisaPanel.current) {
      LisaPanel.current.panel.reveal(vscode.ViewColumn.Beside, false);
      return;
    }
    LisaPanel.current = new LisaPanel(client);
  }

  static clear() {
    LisaPanel.current?.handle.clear();
  }
}
