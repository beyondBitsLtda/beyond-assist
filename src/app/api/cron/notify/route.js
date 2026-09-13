import { coletarEnviosPendentes, detectAndNotify } from "@/lib/notifications.js";
import { checkAndFireDueSchedules } from "@/lib/scheduledAnnouncements.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/notify
 * Disparado pela Vercel a cada poucos minutos (ver vercel.json). A Vercel manda
 * automaticamente "Authorization: Bearer <CRON_SECRET>" quando essa env var está definida —
 * também dá pra chamar manualmente (ex.: testar) mandando o mesmo header.
 */
export async function GET(req) {
  const need = (process.env.CRON_SECRET || "").trim();
  if (need) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${need}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  // as duas checagens são independentes — uma falhar (ex.: Sentinela fora do ar) não pode
  // impedir a outra de rodar (ex.: uma fala agendada que estava na hora de disparar).
  const [notifyResult, scheduleResult] = await Promise.all([
    detectAndNotify().catch((err) => ({ ok: false, error: String(err?.message || err) })),
    checkAndFireDueSchedules().catch((err) => ({ ok: false, error: String(err?.message || err) })),
  ]);

  // A fila vai na RESPOSTA, e quem envia é o Worker de cron (workers/lisa-cron). O envio saiu
  // daqui porque o web-push precisa de http/https/net do Node, que não existem no Edge runtime.
  return jsonResponse({
    ok: true,
    notify: notifyResult,
    schedules: scheduleResult,
    pendentes: coletarEnviosPendentes(),
  });
}
