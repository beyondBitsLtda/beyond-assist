import { listThoughts } from "@/lib/notes.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/thoughts?limit=&offset=
 *
 * Pensamentos registrados (tabela `notes` do Beyond Brain), lidos direto do banco —
 * não depende do SYNC (que só afeta a tabela `documents`).
 */
export async function GET(req) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  try {
    const { thoughts, count, next_offset } = await listThoughts({ limit, offset });
    return jsonResponse({ ok: true, count, next_offset, thoughts });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
