import { JANELA_PADRAO_H, montarPainel } from "@/lib/deployChecks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/map-of-deploy?horas=168
 *
 * O quadro do Trello (coluna = servidor, etiqueta = conta, descrição = link) com o estado de
 * cada aplicação por cima. Só LÊ — quem bate nas aplicações é /api/cron/deploy-check.
 */
export async function GET(req) {
  try {
    const horas = Number(new URL(req.url).searchParams.get("horas")) || JANELA_PADRAO_H;
    return jsonResponse(await montarPainel({ horas: Math.min(24 * 30, Math.max(1, horas)) }));
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
