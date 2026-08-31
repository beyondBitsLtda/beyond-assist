// Cliente GitHub (REST API) — leitura só, via fine-grained PAT (GITHUB_TOKEN). Usado pra
// descobrir repositórios (src/lib/ingest/github.js) e indexar o código deles por embeddings
// (mesmo pipeline do Trello/Beyond Brain — ver src/lib/ingest/runSlice.js).

const API = "https://api.github.com";

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN não configurado");
  return t;
}

async function gh(path, { params } = {}) {
  const url = new URL(`${API}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${path} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Chamada de ESCRITA (POST/PUT) — exige GITHUB_TOKEN com Contents + Pull requests em
 * "Read and write" (a leitura/indexação de código, acima, funciona só com Read-only). */
async function ghWrite(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${method} ${path} → ${res.status} ${res.statusText} ${text.slice(0, 300)}`);
  }
  return res.json();
}

// A API de Contents/branches usa o PATH do arquivo literalmente na URL, com "/" separando
// diretório — encodeURIComponent no path inteiro escaparia essas barras (%2F) e quebraria a
// rota; encoda só cada PEDAÇO entre barras.
function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Todos os repositórios que o token enxerga (própios + orgs + colaborações), paginado. */
export async function listAccessibleRepos() {
  const repos = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await gh("/user/repos", { params: { per_page: 100, page, affiliation: "owner,collaborator,organization_member" } });
    repos.push(...batch.map((r) => ({ full_name: r.full_name, default_branch: r.default_branch, private: r.private })));
    if (batch.length < 100) break;
  }
  return repos;
}

/** Árvore completa (recursiva) de um repo numa branch — cada entrada tem path/type/sha/size. */
export async function getRepoTree(fullName, branch) {
  const data = await gh(`/repos/${fullName}/git/trees/${encodeURIComponent(branch)}`, { params: { recursive: 1 } });
  return data.tree || [];
}

/** Conteúdo de um blob (arquivo) já decodificado de base64 pra utf8 — null se não for texto
 * (binário genuíno; a Buffer decodifica de qualquer jeito, então checamos "replacement
 * character" como indício de que não era texto de verdade). */
export async function getBlobContent(fullName, sha) {
  const data = await gh(`/repos/${fullName}/git/blobs/${sha}`);
  if (data.encoding !== "base64") return null;
  const buf = Buffer.from(data.content, "base64");
  const text = buf.toString("utf8");
  if (text.includes("�")) return null; // indício forte de binário
  return text;
}

// ---------- escrita (tarefas de código — ver src/lib/codeTasks.js) ----------

/** Nomes de todas as branches do repo — pro seletor "branch" da tela /code-tasks. */
export async function listBranches(fullName) {
  const branches = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(`/repos/${fullName}/branches`, { params: { per_page: 100, page } });
    branches.push(...batch.map((b) => b.name));
    if (batch.length < 100) break;
  }
  return branches;
}

/** SHA do commit mais recente de uma branch — ponto de partida pra criar a branch nova da
 * Lisa (sempre a partir da branch BASE escolhida pelo usuário, nunca de outra coisa). */
export async function getBranchSha(fullName, branch) {
  const data = await gh(`/repos/${fullName}/git/ref/heads/${encodeURIComponent(branch)}`);
  return data.object.sha;
}

/** Cria uma branch nova apontando pro mesmo commit que `fromSha` — a Lisa NUNCA commita
 * direto na branch base; toda mudança nasce numa branch própria dela. */
export async function createBranch(fullName, newBranch, fromSha) {
  return ghWrite(`/repos/${fullName}/git/refs`, "POST", { ref: `refs/heads/${newBranch}`, sha: fromSha });
}

/** sha atual do arquivo NESSA branch (exigido pela API de Contents pra ATUALIZAR um arquivo
 * existente) — null se o arquivo ainda não existe ali (a API então CRIA, sem sha). */
export async function getFileSha(fullName, path, branch) {
  try {
    const data = await gh(`/repos/${fullName}/contents/${encodePath(path)}`, { params: { ref: branch } });
    return data.sha || null;
  } catch {
    return null;
  }
}

/** Conteúdo ATUAL de um arquivo numa branch específica (decodificado de base64) — diferente
 * de getFullFileContents (codeTasks.js), que lê do índice (documents), possivelmente
 * DESATUALIZADO em relação a commits recentes. Usado quando o usuário está CONTINUANDO uma
 * tarefa na branch da Lisa (ex.: "corrige esse erro") — precisa ver o que ela mesma acabou de
 * commitar ali, não o conteúdo original da branch base. null se o arquivo não existe ali. */
export async function getFileContentOnBranch(fullName, path, branch) {
  try {
    const data = await gh(`/repos/${fullName}/contents/${encodePath(path)}`, { params: { ref: branch } });
    if (!data || data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** Cria ou atualiza UM arquivo numa branch (commit direto via API de Contents — simples e
 * suficiente pra um punhado de arquivos por tarefa; não tenta juntar tudo num commit único). */
export async function putFileContent(fullName, path, content, message, branch, sha) {
  const body = { message, content: Buffer.from(content, "utf8").toString("base64"), branch };
  if (sha) body.sha = sha;
  return ghWrite(`/repos/${fullName}/contents/${encodePath(path)}`, "PUT", body);
}

/** Abre o Pull Request (head → base) — é aqui, e só aqui, que a mudança fica visível pro
 * usuário revisar; mesclar é sempre manual, feito por ele no GitHub. */
export async function createPullRequest(fullName, { title, body, head, base }) {
  return ghWrite(`/repos/${fullName}/pulls`, "POST", { title, body, head, base });
}
