import * as vscode from "vscode";
import { LisaClient } from "./lisaClient";
import { ChatViewProvider } from "./chatViewProvider";
import { LisaPanel } from "./lisaPanel";

const TOKEN_KEY = "lisaCode.token";
const LOOK_BACKUP_KEY = "lisaCode.lookBackup";

// Um tema de cores do VS Code só controla CORES — fonte é configuração do usuário, não do tema.
// Por isso o "visual completo" (tema + fonte) é um comando que escreve nas configurações, com
// backup do que estava antes pra dar pra desfazer. Importante: o editor do VS Code só usa fonte
// INSTALADA no sistema (ele não baixa webfont como o navegador faz no Beyond Bits) — daí a
// cadeia de fallback: sem JetBrains Mono instalada, cai em Consolas sem quebrar nada.
const LOOK_FONT = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace";
const ACCENTS = ["Ciano", "Azul", "Roxo", "Rosa", "Vermelho", "Dourado"];

interface LookBackup {
  colorTheme?: string;
  editorFont?: string;
  terminalFont?: string;
  ligatures?: boolean | string;
}

async function applyLook(context: vscode.ExtensionContext) {
  const accent = await vscode.window.showQuickPick(ACCENTS, {
    title: "Visual da Lisa — cor de destaque",
    placeHolder: "A mesma paleta do seletor de tema do Beyond Bits",
  });
  if (!accent) return;

  const family = await vscode.window.showQuickPick(
    [
      { label: "Imersivo", description: "fundo do VS Code tingido com a cor da Lisa" },
      { label: "HUD", description: "fundo preto, igual o app" },
    ],
    { title: "Visual da Lisa — fundo" }
  );
  if (!family) return;

  const theme = `Lisa ${family.label} — ${accent}`;
  const cfg = vscode.workspace.getConfiguration();

  if (!context.globalState.get<LookBackup>(LOOK_BACKUP_KEY)) {
    await context.globalState.update(LOOK_BACKUP_KEY, {
      colorTheme: cfg.get<string>("workbench.colorTheme"),
      editorFont: cfg.get<string>("editor.fontFamily"),
      terminalFont: cfg.get<string>("terminal.integrated.fontFamily"),
      ligatures: cfg.get<boolean | string>("editor.fontLigatures"),
    } satisfies LookBackup);
  }

  await cfg.update("workbench.colorTheme", theme, vscode.ConfigurationTarget.Global);
  await cfg.update("editor.fontFamily", LOOK_FONT, vscode.ConfigurationTarget.Global);
  await cfg.update("terminal.integrated.fontFamily", LOOK_FONT, vscode.ConfigurationTarget.Global);
  await cfg.update("editor.fontLigatures", true, vscode.ConfigurationTarget.Global);

  vscode.window.showInformationMessage(
    `Visual aplicado: ${theme}. A fonte cai em Consolas se JetBrains Mono não estiver instalada nesta máquina — "Restaurar visual anterior" desfaz tudo.`
  );
}

async function restoreLook(context: vscode.ExtensionContext) {
  const backup = context.globalState.get<LookBackup>(LOOK_BACKUP_KEY);
  if (!backup) {
    vscode.window.showInformationMessage("Nada pra restaurar — o visual da Lisa ainda não foi aplicado por aqui.");
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  // `undefined` remove a configuração (volta pro padrão do VS Code) — que é justamente o certo
  // quando o usuário não tinha nada definido ali antes.
  await cfg.update("workbench.colorTheme", backup.colorTheme, vscode.ConfigurationTarget.Global);
  await cfg.update("editor.fontFamily", backup.editorFont, vscode.ConfigurationTarget.Global);
  await cfg.update("terminal.integrated.fontFamily", backup.terminalFont, vscode.ConfigurationTarget.Global);
  await cfg.update("editor.fontLigatures", backup.ligatures, vscode.ConfigurationTarget.Global);
  await context.globalState.update(LOOK_BACKUP_KEY, undefined);
  vscode.window.showInformationMessage("Visual anterior restaurado.");
}

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
    }),

    vscode.commands.registerCommand("lisaCode.applyLook", () => applyLook(context)),
    vscode.commands.registerCommand("lisaCode.restoreLook", () => restoreLook(context))
  );
}

export function deactivate() {}
