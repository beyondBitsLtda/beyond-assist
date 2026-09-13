import { listSchedules, createSchedule } from "@/lib/scheduledAnnouncements.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/scheduled-announcements — lista todos os agendamentos (ver tela /scheduled-announcements). */
export async function GET() {
  try {
    const schedules = await listSchedules();
    return jsonResponse({ ok: true, schedules });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/**
 * POST /api/scheduled-announcements   body: {
 *   label, timeOfDay: "HH:MM", daysOfWeek?: number[] (0=domingo..6=sábado),
 *   mode: "fixed"|"report", message?, scope?, instruction?, personaMode?, enabled?
 * }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const schedule = await createSchedule(body);
    return jsonResponse({ ok: true, schedule });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 400);
  }
}
