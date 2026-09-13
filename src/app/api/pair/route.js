import { proposePairFeature, editCodeWithLisa } from "@/lib/gemini.js";
import { createPairSession, closePairSession, LEVELS } from "@/lib/activities.js";
import { listGithubRepos } from "@/lib/ingest/github.js";
import { getRepoTree, getBranchSha, createBranch, listBranches, getFileContentOnBranch, getFileSha, putFileContent } from "@/lib/github.js";
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

    // ---- ações da IDE (ver LisaPairIDE.js) ----
    if (body.action === "tree") {
      const tree = await getRepoTree(body.repo, body.branch);
      // só arquivos de texto que fazem sentido abrir num editor — sem binário, sem lock gigante
      const files = tree
        .filter((t) => t.type === "blob" && (t.size ?? 0) < 400_000)
        .map((t) => t.path)
        .filter((f) => !/(^|\/)(node_modules|\.next|dist|build)\//.test(f))
        .filter((f) => /\.(js|jsx|ts|tsx|css|scss|json|md|ya?ml|html|py|java|cs|cpp|c|h|go|rb|php|sql|sh|txt)$/i.test(f));
      return jsonResponse({ ok: true, files: files.slice(0, 800) });
    }

    if (body.action === "file") {
      const content = await getFileContentOnBranch(body.repo, body.path, body.branch);
      if (content === null) return jsonResponse({ ok: false, error: `não consegui ler ${body.path} (binário ou inexistente nessa branch)` }, 404);
      return jsonResponse({ ok: true, content });
    }

    if (body.action === "edit") {
      if (!body.instruction?.trim()) return jsonResponse({ ok: false, error: "instruction é obrigatório" }, 400);
      const current = body.content ?? "";
      const out = await editCodeWithLisa({ path: body.path, content: current, instruction: body.instruction });
      // o modelo costuma comer a quebra de linha final; sem isso TODO salvamento vira um diff
      // falso de "sem quebra de linha no fim do arquivo" mesmo quando ela só mexeu numa linha
      if (current.endsWith("\n") && !out.newContent.endsWith("\n")) out.newContent += "\n";
      return jsonResponse({ ok: true, ...out });
    }

    if (body.action === "save") {
      // sha atual do arquivo NA BRANCH: a API do GitHub exige pra ATUALIZAR (sem ele, só cria)
      const sha = await getFileSha(body.repo, body.path, body.branch);
      await putFileContent(body.repo, body.path, body.content, body.message || `Lisa + você: ${body.path}`, body.branch, sha);
      return jsonResponse({ ok: true });
    }

    if (body.action !== "start") return jsonResponse({ ok: false, error: "action inválida — use start, tree, file, edit, save ou close" }, 400);

    const { repo, level } = body;
    if (!repo) return jsonResponse({ ok: false, error: "repo é obrigatório" }, 400);
    if (!LEVELS.includes(level)) return jsonResponse({ ok: false, error: `nível inválido: ${level}` }, 400);

    // Descobre a branch base. ATENÇÃO: listBranches devolve STRINGS (ver src/lib/github.js e o
    // seletor em /code-tasks), não objetos — eu tratava como `b.name` e por isso `base` saía
    // sempre undefined MESMO com a listagem funcionando, e o erro acusava a listagem à toa.
    let branches = [];
    let listError = null;
    try {
      branches = await listBranches(repo);
    } catch (err) {
      listError = String(err?.message || err); // NÃO engole: é o que diz se foi permissão, 404, etc.
    }

    // se a listagem falhar, ainda dá pra tentar pela default_branch que já guardamos no banco
    let base = branches.find((b) => ["main", "master"].includes(b)) || branches[0];
    if (!base) {
      const known = (await listGithubRepos().catch(() => [])).find((r) => r.full_name === repo);
      base = known?.default_branch || null;
    }
    if (!base) {
      return jsonResponse(
        {
          ok: false,
          error: listError
            ? `não consegui ler as branches de ${repo}: ${listError}`
            : `${repo} não tem nenhuma branch — repositório vazio? (faça o primeiro commit antes)`,
        },
        500
      );
    }

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
