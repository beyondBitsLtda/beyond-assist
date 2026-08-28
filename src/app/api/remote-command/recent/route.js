import { listRecentCommands } from "@/lib/remoteCommands.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/remote-command/recent?since=<iso opcional>&deviceId=<meu id>
 * Comandos mais novos que `since` que não vieram deste dispositivo — ver src/lib/remoteCommands.js.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const since = url.searchParams.get("since") || null;
  const deviceId = url.searchParams.get("deviceId") || null;

  try {
    const commands = await listRecentCommands({ since, excludeDevice: deviceId });
    return jsonResponse({ ok: true, commands, now: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
