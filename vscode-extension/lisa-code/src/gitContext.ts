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
interface Repository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { name?: string };
    refs: Ref[];
    workingTreeChanges: Change[];
    indexChanges: Change[];
  };
  diffWith(ref: string): Promise<Change[]>;
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
