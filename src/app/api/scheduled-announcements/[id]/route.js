import { updateSchedule, deleteSchedule } from "@/lib/scheduledAnnouncements.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/scheduled-announcements/:id — atualização parcial (ex.: só {enabled:false}). */
export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const schedule = await updateSchedule(params.id, body);
    return jsonResponse({ ok: true, schedule });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 400);
  }
}

export async function DELETE(_req, { params }) {
  try {
    await deleteSchedule(params.id);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 400);
  }
}
