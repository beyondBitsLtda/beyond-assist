import { listDelpTasks } from "@/lib/delpTasks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/delp-tasks — alimenta o Kanban em src/app/(panels)/delp-tasks/page.js. */
export async function GET() {
  try {
    const tasks = await listDelpTasks();
    return jsonResponse({ ok: true, tasks });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
