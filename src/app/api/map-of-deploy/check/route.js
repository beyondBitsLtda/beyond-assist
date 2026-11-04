import { checarTodas } from "@/lib/deployChecks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/map-of-deploy/check
 *
 * Checa agora, sem esperar o cron. É o botão "checar agora" do painel: sem ele, uma aplicação
 * que você acabou de corrigir continuaria vermelha na tela até o próximo tique.
 */
export async function POST() {
  try {
    return jsonResponse(await checarTodas());
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
