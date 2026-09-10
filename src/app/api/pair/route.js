import { proposePairFeature } from "@/lib/gemini.js";
import { createPairSession, closePairSession, LEVELS } from "@/lib/activities.js";
import { listGithubRepos } from "@/lib/ingest/github.js";
import { getRepoTree, getBranchSha, createBranch, listBranches } from "@/lib/github.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pair — repositórios disponíveis pra escolher (os mesmos da tela /code-repos). */
export async function GET() {
  try {
    const repos = await listGithubRepos();
    return jsonResponse({ ok: true, repos: repos.map((r) => ({ full_name: r.full_name, default_branch: r.default_branch, enabled: r.enabled })) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/**
 * POST /api/pair
 *   { action: "start", repo, level }        → ela escolhe a feature, CRIA a branch e abre a sessão
 *   { action: "close", id, status }         → fecha a sessão ('concluida' | 'abandonada')
 *
 * Sobre criar a branch: usa o mesmo GITHUB_TOKEN do resto do app. Se esse PAT for só de
 * leitura, o GitHub responde 403 — nesse caso a sessão ainda é aberta (com a feature e o plano),
 * só sem branch, e o erro volta em `branchError` pra ficar claro o motivo em vez de a coisa
 * falhar inteira.
 */
export async function POST(req) {
  try {
    const body = await req.json();

    if (body.action === "close") {
      if (!body.id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
      await closePairSession({ id: body.id, status: body.status });
      return jsonResponse({ ok: true });
    }

    if (body.action !== "start") return jsonResponse({ ok: false, error: "action inválida — use start ou close" }, 400);

    const { repo, level } = body;
    if (!repo) return jsonResponse({ ok: false, error: "repo é obrigatório" }, 400);
    if (!LEVELS.includes(level)) return jsonResponse({ ok: false, error: `nível inválido: ${level}` }, 400);

    // descobre a branch base e lista arquivos pra ela propor algo que EXISTE nesse repo
    const branches = await listBranches(repo).catch(() => []);
    const base = branches.find((b) => ["main", "master"].includes(b.name))?.name || branches[0]?.name;
    if (!base) return jsonResponse({ ok: false, error: `não consegui listar branches de ${repo}` }, 500);

    const tree = await getRepoTree(repo, base).catch(() => []);
    const fileList = tree.filter((t) => t.type === "blob").map((t) => t.path);

    const proposal = await proposePairFeature({ repo, level, fileList });

    // cria a branch de verdade; se o token não tiver escrita, segue sem ela
    let branch = proposal.branch;
    let branchError = null;
    try {
      const sha = await getBranchSha(repo, base);
      await createBranch(repo, branch, sha);
    } catch (err) {
      branchError = String(err?.message || err);
      branch = null;
    }

    const plan = [proposal.why, "", ...proposal.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n");
    let sessionId = null;
    let saveError = null;
    try {
      sessionId = await createPairSession({ repo, branch, level, feature: proposal.feature, plan });
    } catch (err) {
      saveError = String(err?.message || err);
    }

    return jsonResponse({ ok: true, sessionId, repo, base, branch, branchError, saveError, ...proposal });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
