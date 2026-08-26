import { ingestSlice } from "@/lib/ingest/runSlice.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/ingest?source=trello|brain&boardIndex=<n>&offset=<n>
 *
 * Processa UMA fatia de reindexação (ver ingestSlice em src/lib/ingest/runSlice.js) —
 * chamado repetidamente em loop pelo botão SYNC (src/lib/sync.js) e, de forma automática
 * e agendada, pelo /api/cron/sync (Supabase pg_cron, uma fatia por tick).
 */
async function handle(req) {
  const need = (process.env.INGEST_SECRET || "").trim();
  if (need) {
    const u = new URL(req.url);
    const got = req.headers.get("x-ingest-secret") || u.searchParams.get("secret") || "";
    if (got !== need) return json({ ok: false, error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const source = (url.searchParams.get("source") || "").toLowerCase();
  const boardIndexParam = url.searchParams.get("boardIndex");
  const offset = Number(url.searchParams.get("offset") || 0);

  if (source === "trello" && (boardIndexParam === null || boardIndexParam === "")) {
    return json({ ok: false, error: "boardIndex obrigatório p/ trello" }, 400);
  }
  if (source !== "trello" && source !== "brain") {
    return json({ ok: false, error: "source obrigatório: trello|brain" }, 400);
  }

  try {
    const report = await ingestSlice({
      source,
      boardIndex: source === "trello" ? Number(boardIndexParam) : null,
      offset,
    });
    return json({ ok: true, ...report, errors: [] });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg === "boardIndex fora do range") return json({ ok: false, error: msg }, 400);
    return json({ ok: false, source, boardIndex: boardIndexParam, offset, errors: [msg] }, 500);
  }
}

export const GET = handle;
export const POST = handle;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
