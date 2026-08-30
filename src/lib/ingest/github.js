import { supabase } from "@/lib/supabase.js";
import { listAccessibleRepos, getRepoTree, getBlobContent } from "@/lib/github.js";

// Indexação de código (GitHub) — mesmo formato de "doc" que loadTrello/loadBrain, pra entrar
// no MESMO pipeline de chunk+embedding+upsert (ver runSlice.js). Um "passo" de sincronização
// = UM repositório inteiro (mirror de "um board do Trello = um passo").

const ALLOWED_EXT = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte",
  "py", "java", "kt", "go", "rb", "php", "c", "h", "cpp", "hpp", "cs", "rs", "swift",
  "sql", "sh", "bash", "ps1",
  "md", "mdx", "txt",
  "json", "yml", "yaml", "toml", "xml",
  "html", "css", "scss", "less",
]);
const DENY_PATH_RE = /(^|\/)(node_modules|\.git|\.next|dist|build|out|vendor|coverage|\.cache|\.turbo)(\/|$)/i;
const DENY_FILE_RE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|\.min\.(js|css)|\.map)$/i;
const MAX_FILE_SIZE = 200_000; // bytes — arquivo maior que isso costuma ser gerado/dado, não código pra ler
const MAX_FILES_PER_REPO = 500; // teto por repo — mantém 1 tick de sincronização rápido e previsível

function isIndexable(entry) {
  if (entry.type !== "blob") return false;
  if (entry.size > MAX_FILE_SIZE) return false;
  if (DENY_PATH_RE.test(entry.path) || DENY_FILE_RE.test(entry.path)) return false;
  const ext = entry.path.split(".").pop()?.toLowerCase();
  return ALLOWED_EXT.has(ext);
}

/** Roda `fn` sobre `items` com no máximo `limit` chamadas em paralelo por vez — sem isso,
 * um repo com muitos arquivos levaria sequencialmente demais pra caber nos 60s da função. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Descobre todos os repositórios que o token enxerga e grava/atualiza em github_repos —
 * chamado pela tela /code-repos. Repos novos entram com enabled=true; repos já conhecidos
 * mantêm o `enabled` que o usuário já tinha escolhido (upsert não sobrescreve essa coluna). */
export async function discoverRepos() {
  const repos = await listAccessibleRepos();
  if (!repos.length) return { found: 0 };
  const { data: existing } = await supabase.from("github_repos").select("full_name, enabled");
  const enabledByName = new Map((existing || []).map((r) => [r.full_name, r.enabled]));
  const rows = repos.map((r) => ({
    full_name: r.full_name,
    default_branch: r.default_branch,
    private: r.private,
    enabled: enabledByName.has(r.full_name) ? enabledByName.get(r.full_name) : true,
  }));
  const { error } = await supabase.from("github_repos").upsert(rows, { onConflict: "full_name" });
  if (error) throw new Error(`discoverRepos: ${error.message}`);
  return { found: repos.length };
}

export async function listGithubRepos() {
  const { data, error } = await supabase.from("github_repos").select("*").order("full_name", { ascending: true });
  if (error) throw new Error(`listGithubRepos: ${error.message}`);
  return data || [];
}

export async function setRepoEnabled(id, enabled) {
  const { error } = await supabase.from("github_repos").update({ enabled: !!enabled }).eq("id", id);
  if (error) throw new Error(`setRepoEnabled: ${error.message}`);
}

/** Repos habilitados, na ordem usada pra indexar (id crescente — estável entre ticks, o que
 * importa pro `repoIndex` de um passo continuar apontando pro mesmo repo do início ao fim). */
async function enabledRepos() {
  const { data, error } = await supabase.from("github_repos").select("*").eq("enabled", true).order("id", { ascending: true });
  if (error) throw new Error(`enabledRepos: ${error.message}`);
  return data || [];
}

export async function countEnabledRepos() {
  return (await enabledRepos()).length;
}

/** Caminhos de arquivo já indexados de UM repositório — alimenta o 2º seletor ("arquivo")
 * do escopo "Código" no Assistente. Lê da tabela `documents` (o que JÁ foi sincronizado),
 * não faz nenhuma chamada ao GitHub — só mostra o que dá pra escolher de verdade. */
export async function listIndexedFiles(repo) {
  const { data, error } = await supabase.from("documents").select("title").eq("source", "github").eq("board", repo);
  if (error) throw new Error(`listIndexedFiles: ${error.message}`);
  return [...new Set((data || []).map((r) => r.title))].sort();
}

/** Carrega TODOS os arquivos indexáveis de UM repositório (identificado por posição, ver
 * enabledRepos) já no formato de "doc" do pipeline de ingestão — chamado a cada tick
 * enquanto esse repo for o passo atual (ver runSlice.js), então refaz o fetch da árvore/
 * conteúdo toda vez (mesmo padrão de loadTrello/loadBrain — só o offset de chunks já
 * processados muda entre ticks, não o que é carregado). */
export async function loadGithub({ repoIndex }) {
  const repos = await enabledRepos();
  const repo = repos[Number(repoIndex)];
  if (!repo) throw new Error("repoIndex fora do range");
  if (!repo.default_branch) throw new Error(`repo ${repo.full_name} sem default_branch conhecida — rode a descoberta de novo`);

  const tree = await getRepoTree(repo.full_name, repo.default_branch);
  const files = tree.filter(isIndexable).sort((a, b) => a.path.localeCompare(b.path)).slice(0, MAX_FILES_PER_REPO);

  const contents = await mapLimit(files, 8, async (f) => {
    try {
      return await getBlobContent(repo.full_name, f.sha);
    } catch {
      return null; // 1 arquivo falhar não derruba o repo inteiro
    }
  });

  const docs = [];
  files.forEach((f, i) => {
    const content = contents[i];
    if (!content?.trim()) return;
    docs.push({
      source: "github",
      external_id: f.path,
      board: repo.full_name,
      title: f.path,
      content: `// ${repo.full_name}/${f.path}\n\n${content}`,
      last_modified: null,
      metadata: { repo: repo.full_name, path: f.path, sha: f.sha },
    });
  });

  return docs;
}
