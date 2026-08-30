import { listGithubRepos, discoverRepos } from "@/lib/ingest/github.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/code-repos — lista repositórios já conhecidos (tela /code-repos). */
export async function GET() {
  try {
    const repos = await listGithubRepos();
    return jsonResponse({ ok: true, repos });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/** POST /api/code-repos — redescobre a lista (consulta o GitHub de novo e atualiza a
 * tabela); repositórios novos entram habilitados, os já conhecidos mantêm a escolha do
 * usuário. Chamado pelo botão "↻ redescobrir" na tela /code-repos. */
export async function POST() {
  try {
    const result = await discoverRepos();
    const repos = await listGithubRepos();
    return jsonResponse({ ok: true, ...result, repos });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
