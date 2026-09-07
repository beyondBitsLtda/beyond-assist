import * as vscode from "vscode";

// Interfaces MÍNIMAS da API da extensão de Git embutida do VS Code ("vscode.git") — só o que
// realmente usamos. Escritas à mão porque a Microsoft não publica um pacote de tipos pra ela
// (o git.d.ts vive dentro do código da extensão dela, não no @types/vscode).
interface Ref {
  type: number; // 0 = branch local (RefType.Head), 1 = remota, 2 = tag
  name?: string;
}
interface Change {
  uri: vscode.Uri;
}
interface Remote {
  name: string;
}
interface Repository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { name?: string; upstream?: { remote: string; name: string }; ahead?: number; behind?: number };
    refs: Ref[];
    remotes: Remote[];
    workingTreeChanges: Change[];
    indexChanges: Change[];
  };
  diffWith(ref: string): Promise<Change[]>;
  // ---- operações de ESCRITA (usadas só depois de confirmação explícita do usuário, ver
  // lisaClient.ts) — nunca expomos force push ----
  createBranch(name: string, checkout: boolean, ref?: string): Promise<void>;
  add(paths: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  push(remoteName?: string, branchName?: string, setUpstream?: boolean): Promise<void>;
}
interface GitApi {
  repositories: Repository[];
}

const REF_LOCAL_BRANCH = 0;

async function getRepo(): Promise<Repository | undefined> {
  const ext = vscode.extensions.getExtension<{ getAPI(v: number): GitApi }>("vscode.git");
  if (!ext) return undefined;
  if (!ext.isActive) await ext.activate(); // sem isso `exports` pode não existir ainda
  return ext.exports?.getAPI?.(1)?.repositories?.[0];
}

export interface GitSnapshot {
  available: boolean;
  branch?: string;
  branches?: string[];
  /** arquivos modificados no working tree / staged, relativos à raiz do workspace */
  changed?: string[];
  /** branch usada como base de comparação (escolhida pelo usuário na barra de contexto) */
  base?: string;
  /** arquivos que diferem em relação à `base` — só vem quando uma base foi escolhida */
  changedVsBase?: string[];
  error?: string;
}

/** Estado atual do git do workspace. Nunca lança e nunca MUDA nada (não faz checkout, não
 * commita) — é só leitura pra dar contexto pra Lisa. */
export async function gitSnapshot(base?: string): Promise<GitSnapshot> {
  const repo = await getRepo();
  if (!repo) return { available: false, error: "extensão de Git do VS Code não disponível ou nenhum repositório aberto" };

  const rel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);
  const snap: GitSnapshot = {
    available: true,
    branch: repo.state.HEAD?.name,
    branches: repo.state.refs.filter((r) => r.type === REF_LOCAL_BRANCH && r.name).map((r) => r.name as string),
    changed: [...new Set([...repo.state.workingTreeChanges, ...repo.state.indexChanges].map((c) => rel(c.uri)))].slice(0, 60),
    base,
  };

  if (base && base !== snap.branch) {
    try {
      const diff = await repo.diffWith(base);
      snap.changedVsBase = [...new Set(diff.map((c) => rel(c.uri)))].slice(0, 100);
    } catch (err) {
      snap.error = `não consegui comparar com ${base}: ${(err as Error).message}`;
    }
  }
  return snap;
}

// ============================================================================================
// Operações de ESCRITA no git. Estas funções NÃO pedem confirmação — quem chama (lisaClient.ts)
// é responsável por confirmar com o usuário ANTES, do mesmo jeito que propose_edit/delete_file
// já fazem. Nenhuma delas usa force push, e nenhuma apaga branch/histórico.
// ============================================================================================

export interface HeadInfo {
  available: boolean;
  branch?: string;
  hasUpstream: boolean;
  remote?: string;
  ahead?: number;
  behind?: number;
  /** arquivos com mudança pendente (working tree + index), relativos à raiz */
  pending: string[];
  error?: string;
}

export async function gitHeadInfo(): Promise<HeadInfo> {
  const repo = await getRepo();
  if (!repo) return { available: false, hasUpstream: false, pending: [], error: "nenhum repositório git aberto" };
  const rel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);
  return {
    available: true,
    branch: repo.state.HEAD?.name,
    hasUpstream: !!repo.state.HEAD?.upstream,
    remote: repo.state.HEAD?.upstream?.remote || repo.state.remotes?.[0]?.name,
    ahead: repo.state.HEAD?.ahead,
    behind: repo.state.HEAD?.behind,
    pending: [...new Set([...repo.state.workingTreeChanges, ...repo.state.indexChanges].map((c) => rel(c.uri)))],
  };
}

/** Cria a branch e já muda pra ela (checkout: true) — a partir do HEAD atual. */
export async function gitCreateBranch(name: string): Promise<void> {
  const repo = await getRepo();
  if (!repo) throw new Error("nenhum repositório git aberto");
  await repo.createBranch(name, true);
}

/** Faz stage SÓ dos caminhos passados e commita. Nunca usa `git add -A`: o modelo tem que
 * dizer exatamente quais arquivos entram, e o usuário vê essa lista antes de confirmar. */
export async function gitStageAndCommit(paths: string[], message: string): Promise<void> {
  const repo = await getRepo();
  if (!repo) throw new Error("nenhum repositório git aberto");
  const absolute = paths.map((p) => vscode.Uri.joinPath(repo.rootUri, p).fsPath);
  await repo.add(absolute);
  await repo.commit(message);
}

/** Push da branch atual, sem force NUNCA. Define upstream automaticamente se a branch ainda
 * não tem (caso típico de branch nova). */
export async function gitPushCurrent(): Promise<{ remote?: string; branch?: string }> {
  const repo = await getRepo();
  if (!repo) throw new Error("nenhum repositório git aberto");
  const branch = repo.state.HEAD?.name;
  const hasUpstream = !!repo.state.HEAD?.upstream;
  const remote = repo.state.HEAD?.upstream?.remote || repo.state.remotes?.[0]?.name;
  if (!branch) throw new Error("HEAD desanexado (sem branch) — não dá pra fazer push assim");
  await repo.push(remote, branch, !hasUpstream);
  return { remote, branch };
}
