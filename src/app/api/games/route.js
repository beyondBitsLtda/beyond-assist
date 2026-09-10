import { recordGameServer, loadGamesServer } from "@/lib/gameScores.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/games?game=velha&limit=12 — histórico + placar das partidas contra a Lisa. */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const game = url.searchParams.get("game") || null;
    const limit = Math.min(Number(url.searchParams.get("limit") || 12), 100);
    const data = await loadGamesServer({ game, limit });
    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/** POST /api/games  body: { game, result, detail?, device? } — registra uma partida. */
export async function POST(req) {
  try {
    const { game, result, detail, device } = await req.json();
    await recordGameServer({ game, result, detail, device });
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
