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
