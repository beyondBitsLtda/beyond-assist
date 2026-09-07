import * as vscode from "vscode";
import { gitSnapshot, gitHeadInfo, gitCreateBranch, gitStageAndCommit, gitPushCurrent } from "./gitContext";

/** Arquivos que NUNCA deveriam entrar num commit sem uma olhada extra — o aviso aparece em
 * destaque no diálogo de confirmação (mesmo cuidado de sempre: conferir o que vai no commit
 * antes de mandar, mesmo quando o nome do arquivo parece inofensivo). */
const SENSITIVE_PATH = /(^|\/)\.env|\.pem$|\.key$|\.pfx$|\.p12$|id_rsa|credential|secret|token/i;

/** Branches em que um push tem consequência maior que o normal neste projeto: subir na main
 * dispara o deploy de PRODUÇÃO na Vercel. O diálogo diz isso explicitamente pra confirmação
 * ser informada, não reflexa. */
const PROTECTED_BRANCH = /^(main|master|prod|production)$/i;

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

const MAX_TOOL_ROUNDS = 10; // trava de segurança — evita loop infinito se o modelo insistir em chamar função (folga extra pro report_progress não roubar rodada de ferramenta de verdade)

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool-start"; name: string; args: Record<string, unknown> }
  | { type: "tool-done"; name: string; summary: string }
  | { type: "progress"; percent: number; status: string }
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

  // ---- contexto escolhido na barra do painel (ver chatWebview.ts) ----
  /** branch usada como BASE DE COMPARAÇÃO — nunca faz checkout, é só referência pra ela saber
   * "o que mudou em relação a X". */
  private compareBase: string | undefined;
  /** injeta automaticamente qual arquivo está aberto (e o que está selecionado) na mensagem,
   * pra ela saber onde você está sem você precisar dizer. */
  private includeEditorContext = true;

  constructor(private context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider("lisa-code-proposed", this.proposedProvider)
    );
  }

  reset() {
    this.contents = [];
  }

  setCompareBase(base: string | undefined) {
    this.compareBase = base;
  }
  getCompareBase() {
    return this.compareBase;
  }
  setIncludeEditorContext(on: boolean) {
    this.includeEditorContext = on;
  }
  getIncludeEditorContext() {
    return this.includeEditorContext;
  }

  /** Bloco curto de contexto do editor, prefixado à mensagem do usuário quando a opção está
   * ligada — arquivo aberto, linha do cursor e o trecho selecionado (limitado, pra não estourar
   * a mensagem com um arquivo inteiro selecionado por acidente). */
  private editorContextBlock(): string {
    if (!this.includeEditorContext) return "";
    const ed = vscode.window.activeTextEditor;
    if (!ed) return "";
    const file = vscode.workspace.asRelativePath(ed.document.uri, false);
    const line = ed.selection.active.line + 1;
    const selected = ed.document.getText(ed.selection);
    const parts = [`[contexto do editor] arquivo aberto: ${file} (linha ${line})`];
    if (selected.trim()) {
      const MAX = 4000;
      parts.push(`trecho selecionado:\n${selected.length > MAX ? selected.slice(0, MAX) + "\n...(seleção truncada)" : selected}`);
    }
    if (this.compareBase) parts.push(`branch de comparação escolhida: ${this.compareBase}`);
    return parts.join("\n") + "\n\n";
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

  /** Erros e avisos que o VS Code já detectou (Problems panel) — não roda nenhuma análise nova,
   * só lê o que os language servers já calcularam até agora (por isso normalmente só cobre
   * arquivos que já foram abertos/visitados nesta sessão do editor). */
  private execGetProblems(args: Record<string, unknown>): unknown {
    const relPath = args.path ? String(args.path) : undefined;
    const SEVERITY = ["Erro", "Aviso", "Informação", "Dica"];
    const toEntry = (uri: vscode.Uri, d: vscode.Diagnostic) => ({
      path: vscode.workspace.asRelativePath(uri, false),
      line: d.range.start.line + 1,
      severity: SEVERITY[d.severity] || "Erro",
      message: d.message,
    });

    let entries: ReturnType<typeof toEntry>[];
    if (relPath) {
      const uri = this.resolveWorkspacePath(relPath);
      entries = vscode.languages.getDiagnostics(uri).map((d) => toEntry(uri, d));
    } else {
      entries = vscode.languages
        .getDiagnostics()
        .flatMap(([uri, diags]) => diags.map((d) => toEntry(uri, d)));
    }
    const MAX = 100;
    return { problems: entries.slice(0, MAX), truncated: entries.length > MAX };
  }

  /** Busca um texto LITERAL (não regex) em vários arquivos — implementação própria e simples
   * via findFiles + leitura linha a linha, já que a API estável do VS Code não expõe o motor de
   * busca completo do painel Search (findTextInFiles ainda é API proposta, não estável). Trava
   * de tamanho dos dois lados (arquivos escaneados e resultados) pra nunca travar num repo
   * gigante nem devolver um payload enorme pro modelo. */
  private async execSearchWorkspace(args: Record<string, unknown>): Promise<unknown> {
    const query = String(args.query || "");
    const glob = args.glob ? String(args.glob) : "**/*";
    if (!query) return { error: "query é obrigatório" };
    const EXCLUDE = "**/{node_modules,.git,dist,build,out,.next,coverage}/**";
    const MAX_FILES = 500;
    const MAX_MATCHES = 100;
    try {
      const uris = await vscode.workspace.findFiles(glob, EXCLUDE, MAX_FILES);
      const matches: { path: string; line: number; text: string }[] = [];
      for (const uri of uris) {
        if (matches.length >= MAX_MATCHES) break;
        let text: string;
        try {
          text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
        } catch {
          continue;
        }
        if (!text.includes(query)) continue;
        const relative = vscode.workspace.asRelativePath(uri, false);
        const lines = text.split("\n");
        for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
          if (lines[i].includes(query)) matches.push({ path: relative, line: i + 1, text: lines[i].trim().slice(0, 200) });
        }
      }
      return { matches, truncated: matches.length >= MAX_MATCHES };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  private async execCreateFile(args: Record<string, unknown>): Promise<unknown> {
    const relPath = String(args.path || "");
    const content = String(args.content ?? "");
    const explanation = String(args.explanation || "");
    try {
      const uri = this.resolveWorkspacePath(relPath);
      let exists = true;
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        exists = false;
      }
      if (exists) return { created: false, error: `${relPath} já existe — use propose_edit pra alterar um arquivo existente` };

      const choice = await vscode.window.showInformationMessage(
        `Lisa propõe CRIAR o arquivo ${relPath}: ${explanation}`,
        { modal: false },
        "Criar",
        "Rejeitar"
      );
      if (choice !== "Criar") return { created: false, reason: "usuário rejeitou a proposta" };

      const dir = uri.with({ path: uri.path.slice(0, uri.path.lastIndexOf("/")) });
      try {
        await vscode.workspace.fs.createDirectory(dir);
      } catch {
        /* já existe */
      }
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
      return { created: true };
    } catch (err) {
      return { created: false, error: (err as Error).message };
    }
  }

  /** Apagar é mais sério que editar — usa diálogo MODAL (força uma escolha explícita, não some
   * sozinho como as notificações normais) e sempre manda pra lixeira do sistema (useTrash),
   * nunca apaga de forma permanente. */
  private async execDeleteFile(args: Record<string, unknown>): Promise<unknown> {
    const relPath = String(args.path || "");
    const explanation = String(args.explanation || "");
    try {
      const uri = this.resolveWorkspacePath(relPath);
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        return { deleted: false, error: `${relPath} não existe` };
      }

      const choice = await vscode.window.showWarningMessage(
        `Lisa propõe APAGAR o arquivo ${relPath}: ${explanation}`,
        { modal: true },
        "Apagar"
      );
      if (choice !== "Apagar") return { deleted: false, reason: "usuário rejeitou a proposta" };

      await vscode.workspace.fs.delete(uri, { useTrash: true });
      return { deleted: true };
    } catch (err) {
      return { deleted: false, error: (err as Error).message };
    }
  }

  /** Interruptor geral das operações de escrita no git (configuração `lisaCode.gitWriteEnabled`)
   * — desligou, as três ferramentas recusam com uma mensagem clara em vez de agir. */
  private gitWriteEnabled(): boolean {
    return vscode.workspace.getConfiguration("lisaCode").get<boolean>("gitWriteEnabled", true);
  }

  private async execCreateBranch(args: Record<string, unknown>): Promise<unknown> {
    if (!this.gitWriteEnabled()) return { created: false, error: "escrita no git desligada (configuração lisaCode.gitWriteEnabled)" };
    const name = String(args.name || "").trim();
    const reason = String(args.reason || "");
    if (!name) return { created: false, error: "name é obrigatório" };

    const head = await gitHeadInfo();
    if (!head.available) return { created: false, error: head.error };

    const choice = await vscode.window.showInformationMessage(
      `Lisa quer criar a branch "${name}" (a partir de ${head.branch || "HEAD"}) e mudar pra ela.${reason ? ` Motivo: ${reason}` : ""}`,
      { modal: false },
      "Criar branch",
      "Cancelar"
    );
    if (choice !== "Criar branch") return { created: false, reason: "usuário cancelou" };

    try {
      await gitCreateBranch(name);
      return { created: true, branch: name, from: head.branch };
    } catch (err) {
      return { created: false, error: (err as Error).message };
    }
  }

  private async execCommit(args: Record<string, unknown>): Promise<unknown> {
    if (!this.gitWriteEnabled()) return { committed: false, error: "escrita no git desligada (configuração lisaCode.gitWriteEnabled)" };
    const message = String(args.message || "").trim();
    const files = Array.isArray(args.files) ? args.files.map((f) => String(f)) : [];
    if (!message) return { committed: false, error: "message é obrigatório" };
    if (!files.length) return { committed: false, error: "files é obrigatório — liste explicitamente os arquivos que entram no commit" };

    const head = await gitHeadInfo();
    if (!head.available) return { committed: false, error: head.error };

    const sensitive = files.filter((f) => SENSITIVE_PATH.test(f));
    const shown = files.slice(0, 15).map((f) => `  • ${f}`).join("\n");
    const more = files.length > 15 ? `\n  … e mais ${files.length - 15}` : "";
    const warn = sensitive.length
      ? `\n\n⚠ ATENÇÃO: estes arquivos parecem conter segredo/credencial — confira antes:\n${sensitive.map((f) => `  • ${f}`).join("\n")}`
      : "";

    // modal: commit é consequente o suficiente pra exigir uma escolha explícita, não uma
    // notificação que some sozinha.
    const choice = await vscode.window.showWarningMessage(
      `Commit na branch "${head.branch}"\n\nMensagem:\n${message}\n\nArquivos (${files.length}):\n${shown}${more}${warn}`,
      { modal: true },
      "Commitar"
    );
    if (choice !== "Commitar") return { committed: false, reason: "usuário cancelou" };

    try {
      await gitStageAndCommit(files, message);
      return { committed: true, branch: head.branch, files: files.length };
    } catch (err) {
      return { committed: false, error: (err as Error).message };
    }
  }

  private async execPush(args: Record<string, unknown>): Promise<unknown> {
    if (!this.gitWriteEnabled()) return { pushed: false, error: "escrita no git desligada (configuração lisaCode.gitWriteEnabled)" };
    const reason = String(args.reason || "");
    const head = await gitHeadInfo();
    if (!head.available) return { pushed: false, error: head.error };
    if (!head.branch) return { pushed: false, error: "HEAD desanexado — sem branch pra empurrar" };

    const protectedWarn = PROTECTED_BRANCH.test(head.branch)
      ? `\n\n⚠ "${head.branch}" é a branch principal: isso vai pro repositório COMPARTILHADO e dispara o deploy de PRODUÇÃO na Vercel.`
      : "";
    const upstreamNote = head.hasUpstream ? "" : "\n\n(a branch ainda não existe no remoto — o push vai criá-la)";
    const aheadNote = typeof head.ahead === "number" ? `\n\nCommits a enviar: ${head.ahead}` : "";
    const pendingNote = head.pending.length
      ? `\n\nObs.: ${head.pending.length} arquivo(s) com mudança NÃO commitada não vão nesse push.`
      : "";

    const choice = await vscode.window.showWarningMessage(
      `Push de "${head.branch}" para "${head.remote || "origin"}".${reason ? `\n\nMotivo: ${reason}` : ""}${aheadNote}${protectedWarn}${upstreamNote}${pendingNote}`,
      { modal: true },
      "Enviar push"
    );
    if (choice !== "Enviar push") return { pushed: false, reason: "usuário cancelou" };

    try {
      const res = await gitPushCurrent();
      return { pushed: true, ...res };
    } catch (err) {
      return { pushed: false, error: (err as Error).message };
    }
  }

  private async execTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "read_file") return this.execReadFile(args);
    if (name === "propose_edit") return this.execProposeEdit(args);
    if (name === "list_pending_work") return this.execListPendingWork(args);
    if (name === "get_problems") return this.execGetProblems(args);
    if (name === "search_workspace") return this.execSearchWorkspace(args);
    if (name === "create_file") return this.execCreateFile(args);
    if (name === "delete_file") return this.execDeleteFile(args);
    if (name === "get_git_context") return gitSnapshot(args.base ? String(args.base) : this.compareBase);
    if (name === "create_branch") return this.execCreateBranch(args);
    if (name === "git_commit") return this.execCommit(args);
    if (name === "git_push") return this.execPush(args);
    if (name === "report_progress") return { ok: true }; // não executa nada de verdade — só um sinal de UI (ver send())
    return { error: `ferramenta desconhecida: ${name}` };
  }

  /** Manda a mensagem do usuário, roda o loop de function-calling até a Lisa dar uma resposta
   * final em texto (ou até MAX_TOOL_ROUNDS, trava de segurança), emitindo eventos conforme
   * cada coisa acontece (texto falado, ferramenta chamada/concluída, erro). */
  async *send(userText: string): AsyncGenerator<ChatEvent> {
    this.contents.push({ role: "user", parts: [{ text: this.editorContextBlock() + userText }] });

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

        // report_progress não é uma ferramenta de verdade (não mexe em nada) — vira só uma
        // atualização da barra de progresso na UI, não uma linha de "usando ferramenta X".
        if (name === "report_progress") {
          const percent = Math.max(0, Math.min(100, Number(args.percent) || 0));
          const status = String(args.status || "");
          yield { type: "progress", percent, status };
          const result = await this.execTool(name, args);
          responseParts.push({ functionResponse: { id: call.id, name, response: result as object } });
          continue;
        }

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
