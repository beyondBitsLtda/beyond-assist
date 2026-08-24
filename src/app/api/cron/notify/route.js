import { detectAndNotify } from "@/lib/notifications.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  try {
    const result = await detectAndNotify();
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
