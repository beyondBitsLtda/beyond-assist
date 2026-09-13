import { loadActivityStats } from "@/lib/activities.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/activities — pontuação do quiz e do pair programming (ver src/lib/activities.js). */
export async function GET() {
  try {
    const stats = await loadActivityStats();
    return jsonResponse({ ok: true, ...stats });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
