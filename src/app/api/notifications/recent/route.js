import { listRecentNotifications } from "@/lib/notifications.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/recent?since=<iso opcional>
 *
 * Eventos já detectados pelo cron de notificação (chamado novo/reaberto, SLA, tarefa
 * atrasada) mais novos que `since` — usado pela aba aberta pra mostrar um aviso na tela
 * (com voz), sem precisar da permissão de push do navegador. Não detecta nada por conta
 * própria: só lê o que o /api/cron/notify (a cada 5 min) já gravou.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const since = url.searchParams.get("since") || null;

  try {
    const events = await listRecentNotifications(since);
    return jsonResponse({ ok: true, events, now: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
