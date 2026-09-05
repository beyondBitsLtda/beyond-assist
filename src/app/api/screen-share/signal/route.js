import { sendScreenShareSignal } from "@/lib/screenShareSignals.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/screen-share/signal   body: { fromDevice, toDevice, kind, payload? }
 * Manda um sinal WebRTC (Transmissão) — ver src/lib/screenShareSignals.js.
 */
export async function POST(req) {
  try {
    const { fromDevice, toDevice, kind, payload } = await req.json();
    await sendScreenShareSignal({ fromDevice, toDevice, kind, payload });
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
