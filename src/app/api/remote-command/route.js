import { sendRemoteCommand } from "@/lib/remoteCommands.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/remote-command  body: { target: string, originDevice: string }
 * Manda um comando de navegação pros outros dispositivos abertos (ver src/lib/remoteCommands.js).
 */
export async function POST(req) {
  try {
    const { target, originDevice } = await req.json();
    if (!target || !originDevice) return jsonResponse({ ok: false, error: "target e originDevice são obrigatórios" }, 400);
    await sendRemoteCommand({ target, originDevice });
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
