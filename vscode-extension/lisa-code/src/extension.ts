import * as vscode from "vscode";
import { LisaClient } from "./lisaClient";
import { ChatViewProvider } from "./chatViewProvider";
import { LisaPanel } from "./lisaPanel";

const TOKEN_KEY = "lisaCode.token";

export function activate(context: vscode.ExtensionContext) {
  const client = new LisaClient(context);
  const openFloating = () => LisaPanel.open(client);
  const provider = new ChatViewProvider(openFloating);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider),

    vscode.commands.registerCommand("lisaCode.openFloating", openFloating),

    vscode.commands.registerCommand("lisaCode.setToken", async () => {
      const value = await vscode.window.showInputBox({
        title: "Lisa Code — token pessoal",
        prompt: "Cole o mesmo valor configurado em LISA_EXTENSION_TOKEN no Vercel. Fica guardado só nesta máquina.",
        password: true,
        ignoreFocusOut: true,
      });
      if (value === undefined) return;
      await context.secrets.store(TOKEN_KEY, value);
      vscode.window.showInformationMessage("Lisa Code: token salvo.");
    }),

    vscode.commands.registerCommand("lisaCode.setBaseUrl", async () => {
      const current = vscode.workspace.getConfiguration("lisaCode").get<string>("baseUrl") || "";
      const value = await vscode.window.showInputBox({
        title: "Lisa Code — URL do Beyond Bits",
        prompt: "Ex.: https://seu-deploy.vercel.app (sem barra no final)",
        value: current,
        ignoreFocusOut: true,
      });
      if (value === undefined) return;
      await vscode.workspace.getConfiguration("lisaCode").update("baseUrl", value.trim(), vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Lisa Code: URL salva.");
    }),

    vscode.commands.registerCommand("lisaCode.newConversation", () => {
      client.reset();
      LisaPanel.clear();
    })
  );
}

export function deactivate() {}
