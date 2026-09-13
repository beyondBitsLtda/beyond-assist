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

// Repositórios grandes precisam de VÁRIOS ticks pra terminar (teto de chunks por chamada,
// ver MAX_CHUNKS_PER_CALL em runSlice.js) — sem cache, cada tick refazia o fetch da árvore +
// conteúdo de TODOS os arquivos de novo, só pra usar uma fatia diferente, e isso estourava o
// limite de taxa da API do GitHub (5000/hora, um token só — sem rodízio como o pool de chaves
// do Gemini). O cache guarda o que já foi buscado.
//
// A validade era de 15 minutos, curta de propósito pra pegar código novo rápido. Passou a ser
// longa por uma razão de CORREÇÃO, não de eficiência: com o carregamento agora fatiado (ver
// ORCAMENTO_DE_BUSCAS abaixo), um repositório no teto de 500 arquivos precisa de ~15 invocações
// pra terminar de baixar, e a cada 5 minutos isso dá mais de uma hora. Com validade de 15
// minutos o snapshot parcial expirava antes de ficar pronto, e o repositório recomeçava do zero
// pra sempre, sem nunca ser indexado.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Um snapshot parcial não expira pela validade normal (senão nunca terminaria de montar), mas
// também não pode ficar preso pra sempre se algo der errado no meio.
const PARCIAL_MAX_MS = 24 * 60 * 60 * 1000;

// Quantos arquivos buscar por invocação.
//
// Este número existe por causa da Cloudflare: um Worker do plano gratuito pode fazer no máximo
// 50 chamadas de saída por invocação. Buscar os 500 arquivos de um repositório de uma vez —
// que é o que este arquivo fazia, e funcionava na Vercel — dá "Too many subrequests by single
// Worker invocation", e o passo do GitHub nunca passa.
//
// Sobra: 35 arquivos + árvore + gravação do cache + leitura dos repos ≈ 39 chamadas.
const ORCAMENTO_DE_BUSCAS = 35;

/**
 * O que está guardado para um repositório.
 *
 * Formato novo: { v: 2, completo, pendentes: [{path, sha}], arquivos: [{path, sha, content}] }
 * Formato antigo (array puro de arquivos) é aceito e tratado como um snapshot completo — assim
 * o que já estava no banco continua valendo, sem migração.
 */
async function lerCache(repo) {
  const { data } = await supabase.from("github_fetch_cache").select("files, fetched_at").eq("repo", repo).maybeSingle();
  if (!data) return null;

  const idade = Date.now() - new Date(data.fetched_at).getTime();
  const estado = Array.isArray(data.files)
    ? { v: 2, completo: true, pendentes: [], arquivos: data.files }
    : data.files;

  if (estado?.completo) return idade > CACHE_TTL_MS ? null : estado;
  return idade > PARCIAL_MAX_MS ? null : estado;
}

async function gravarCache(repo, estado) {
  await supabase.from("github_fetch_cache").upsert(
    { repo, files: estado, fetched_at: new Date().toISOString() },
    { onConflict: "repo" }
  );
}

/**
 * Carrega os arquivos indexáveis de UM repositório (identificado por posição, ver
 * enabledRepos) já no formato de "doc" do pipeline de ingestão.
 *
 * Devolve `{ docs, incompleto, faltam, board }`. Quando `incompleto` é true, esta invocação
 * gastou o orçamento dela só baixando arquivos e ainda não há o que indexar — quem chama
 * (ingestSlice) deve devolver "em andamento" sem avançar o offset, e o próximo tique continua
 * de onde parou. É assim que um repositório grande atravessa o limite de chamadas do Worker.
 */
export async function loadGithub({ repoIndex }) {
  const repos = await enabledRepos();
  const repo = repos[Number(repoIndex)];
  if (!repo) throw new Error("repoIndex fora do range");
  if (!repo.default_branch) throw new Error(`repo ${repo.full_name} sem default_branch conhecida — rode a descoberta de novo`);

  let estado = await lerCache(repo.full_name);

  if (!estado) {
    const tree = await getRepoTree(repo.full_name, repo.default_branch);
    const entries = tree.filter(isIndexable).sort((a, b) => a.path.localeCompare(b.path)).slice(0, MAX_FILES_PER_REPO);
    estado = { v: 2, completo: false, pendentes: entries.map((e) => ({ path: e.path, sha: e.sha })), arquivos: [] };
  }

  if (!estado.completo) {
    const lote = estado.pendentes.slice(0, ORCAMENTO_DE_BUSCAS);
    const contents = await mapLimit(lote, 8, async (f) => {
      try {
        return await getBlobContent(repo.full_name, f.sha);
      } catch {
        return null; // 1 arquivo falhar não derruba o repo inteiro
      }
    });

    estado.arquivos.push(
      ...lote.map((f, i) => ({ path: f.path, sha: f.sha, content: contents[i] })).filter((f) => f.content?.trim())
    );
    estado.pendentes = estado.pendentes.slice(lote.length);
    estado.completo = estado.pendentes.length === 0;

    await gravarCache(repo.full_name, estado).catch(() => {});

    if (!estado.completo) {
      return { docs: [], incompleto: true, faltam: estado.pendentes.length, board: repo.full_name };
    }
  }

  return {
    incompleto: false,
    faltam: 0,
    board: repo.full_name,
    docs: estado.arquivos.map((f) => ({
      source: "github",
      external_id: f.path,
      board: repo.full_name,
      title: f.path,
      content: `// ${repo.full_name}/${f.path}\n\n${f.content}`,
      last_modified: null,
      metadata: { repo: repo.full_name, path: f.path, sha: f.sha },
    })),
  };
}
