import { checarTodas } from "@/lib/deployChecks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/deploy-check
 *
 * O tique periódico do Map of Deploy: bate em cada aplicação do quadro e grava o resultado. É
 * ele que constrói o histórico — sem tiques regulares não existe "quantas vezes caiu", só o
 * estado do instante em que alguém abriu a tela.
 *
 * Agendar na Vercel (Settings → Cron Jobs) apontando pra esta rota. Mesmo esquema de segredo
 * do /api/cron/notify: com CRON_SECRET definida, a Vercel manda o Bearer sozinha.
 */
export async function GET(req) {
  const need = (process.env.CRON_SECRET || "").trim();
  if (need) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${need}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    return jsonResponse(await checarTodas());
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
