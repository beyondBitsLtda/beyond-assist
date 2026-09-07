import * as vscode from "vscode";

// Formato mínimo do jeito que o Gemini (@google/genai) representa uma conversa — só o que este
// cliente realmente usa (texto e chamadas/respostas de função). O servidor (src/lib/gemini.js,
// runLisaCodeTurn) é quem realmente fala com o Gemini; aqui só precisamos do formato pra manter
// o histórico e montar as respostas de função.
interface FunctionCallPart {
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
}
interface TextPart {
  text?: string;
}
type Part = TextPart & FunctionCallPart & { functionResponse?: { id?: string; name?: string; response?: unknown } };
interface Content {
  role: string;
  parts: Part[];
}

const MAX_TOOL_ROUNDS = 8; // trava de segurança — evita loop infinito se o modelo insistir em chamar função

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool-start"; name: string; args: Record<string, unknown> }
  | { type: "tool-done"; name: string; summary: string }
  | { type: "error"; message: string };

/** Provedor de conteúdo virtual pro diff de propose_edit — serve o "depois" proposto sem
 * escrever nada no disco ainda (ver applyProposedEdit). */
class ProposedContentProvider implements vscode.TextDocumentContentProvider {
  private content = new Map<string, string>();
  private emitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.emitter.event;

  set(key: string, text: string) {
    this.content.set(key, text);
    this.emitter.fire(vscode.Uri.parse(`lisa-code-proposed:${key}`));
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.path) || "";
  }
}

export class LisaClient {
  private contents: Content[] = [];
  private proposedProvider = new ProposedContentProvider();

  constructor(private context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider("lisa-code-proposed", this.proposedProvider)
    );
  }

  reset() {
    this.contents = [];
  }

  private async getToken(): Promise<string | undefined> {
    return this.context.secrets.get("lisaCode.token");
  }

  private getBaseUrl(): string {
    return (vscode.workspace.getConfiguration("lisaCode").get<string>("baseUrl") || "").replace(/\/+$/, "");
  }

  private async callChat(): Promise<Content> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    if (!token) throw new Error('Token não configurado — rode "Lisa Code: Configurar token pessoal" primeiro.');
    if (!baseUrl) throw new Error('URL do Beyond Bits não configurada — rode "Lisa Code: Configurar URL do Beyond Bits" primeiro.');

    const res = await fetch(`${baseUrl}/api/lisa-code/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-lisa-token": token },
      body: JSON.stringify({ contents: this.contents }),
    });
    const data = (await res.json()) as { ok: boolean; content?: Content; error?: string };
    if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (!data.content) throw new Error("resposta vazia do servidor");
    return data.content;
  }

  private resolveWorkspacePath(relPath: string): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) throw new Error("nenhuma pasta aberta no VS Code");
    return vscode.Uri.joinPath(folders[0].uri, relPath);
  }

  private async execReadFile(args: Record<string, unknown>): Promise<unknown> {
    const relPath = String(args.path || "");
    try {
      const uri = this.resolveWorkspacePath(relPath);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString("utf8");
      const MAX = 200_000; // não manda arquivos gigantes pro modelo à toa
      return { content: text.length > MAX ? text.slice(0, MAX) + "\n...(arquivo truncado, muito grande)" : text };
    } catch (err) {
      return { error: `não consegui ler ${relPath}: ${(err as Error).message}` };
    }
  }

  private async execProposeEdit(args: Record<string, unknown>): Promise<unknown> {
    const relPath = String(args.path || "");
    const newContent = String(args.newContent ?? "");
    const explanation = String(args.explanation || "");
    try {
      const uri = this.resolveWorkspacePath(relPath);
      let fileExists = true;
      try {
        await vscode.workspace.fs.readFile(uri);
      } catch {
        fileExists = false; // arquivo novo — ainda não existe
      }

      const stamp = Date.now();
      const afterKey = `${relPath}#${stamp}-depois`;
      this.proposedProvider.set(afterKey, newContent);
      const afterUri = vscode.Uri.parse(`lisa-code-proposed:${afterKey}`);

      let beforeUri: vscode.Uri;
      if (fileExists) {
        beforeUri = uri; // compara com o arquivo real, sempre atualizado
      } else {
        const beforeKey = `${relPath}#${stamp}-antes`;
        this.proposedProvider.set(beforeKey, "");
        beforeUri = vscode.Uri.parse(`lisa-code-proposed:${beforeKey}`);
      }

      await vscode.commands.executeCommand("vscode.diff", beforeUri, afterUri, `Lisa Code: ${relPath} (proposta)`);

      const choice = await vscode.window.showInformationMessage(
        `Lisa propõe uma mudança em ${relPath}: ${explanation}`,
        { modal: false },
        "Aplicar",
        "Rejeitar"
      );

      if (choice !== "Aplicar") return { applied: false, reason: "usuário rejeitou a proposta" };

      const dir = uri.with({ path: uri.path.slice(0, uri.path.lastIndexOf("/")) });
      try {
        await vscode.workspace.fs.createDirectory(dir);
      } catch {
        /* já existe */
      }
      await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent, "utf8"));
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
      return { applied: true };
    } catch (err) {
      return { applied: false, error: (err as Error).message };
    }
  }

  private async execListPendingWork(args: Record<string, unknown>): Promise<unknown> {
    const source = String(args.source || "");
    try {
      const token = await this.getToken();
      const baseUrl = this.getBaseUrl();
      const res = await fetch(`${baseUrl}/api/lisa-code/pending-work?source=${encodeURIComponent(source)}`, {
        headers: { "x-lisa-token": token || "" },
      });
      const data = (await res.json()) as { ok: boolean; data?: string; error?: string };
      if (!data.ok) return { error: data.error || `HTTP ${res.status}` };
      return { data: data.data };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  private async execTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "read_file") return this.execReadFile(args);
    if (name === "propose_edit") return this.execProposeEdit(args);
    if (name === "list_pending_work") return this.execListPendingWork(args);
    return { error: `ferramenta desconhecida: ${name}` };
  }

  /** Manda a mensagem do usuário, roda o loop de function-calling até a Lisa dar uma resposta
   * final em texto (ou até MAX_TOOL_ROUNDS, trava de segurança), emitindo eventos conforme
   * cada coisa acontece (texto falado, ferramenta chamada/concluída, erro). */
  async *send(userText: string): AsyncGenerator<ChatEvent> {
    this.contents.push({ role: "user", parts: [{ text: userText }] });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let modelTurn: Content;
      try {
        modelTurn = await this.callChat();
      } catch (err) {
        yield { type: "error", message: (err as Error).message };
        return;
      }
      this.contents.push(modelTurn);

      const calls = modelTurn.parts.filter((p) => p.functionCall?.name);
      for (const part of modelTurn.parts) {
        if (part.text) yield { type: "text", text: part.text };
      }

      if (!calls.length) return; // resposta final, sem mais ferramentas pra chamar

      const responseParts: Part[] = [];
      for (const part of calls) {
        const call = part.functionCall!;
        const name = call.name!;
        const args = call.args || {};
        yield { type: "tool-start", name, args };
        const result = await this.execTool(name, args);
        responseParts.push({ functionResponse: { id: call.id, name, response: result as object } });
        yield { type: "tool-done", name, summary: JSON.stringify(result).slice(0, 200) };
      }
      this.contents.push({ role: "user", parts: responseParts });
    }

    yield { type: "error", message: "muitas chamadas de ferramenta em sequência — parei por segurança." };
  }
}
