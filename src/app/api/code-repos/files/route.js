import { listIndexedFiles } from "@/lib/ingest/github.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/code-repos/files?repo=owner/name — arquivos já indexados desse repositório,
 * pro 2º seletor ("arquivo específico") do escopo "Código" no Assistente. */
export async function GET(req) {
  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) return jsonResponse({ ok: false, error: "repo é obrigatório" }, 400);
  try {
    const files = await listIndexedFiles(repo);
    return jsonResponse({ ok: true, files });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
