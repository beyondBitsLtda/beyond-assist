import { listScreenShareSignals } from "@/lib/screenShareSignals.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/screen-share/signal/recent?deviceId=<meu id>&alsoHost=1&since=<iso opcional>
 * Sinais WebRTC (Transmissão) novos endereçados a mim — ver src/lib/screenShareSignals.js.
 * `alsoHost=1`: também escuta o pseudo-endereço 'HOST' (quem está transmitindo agora).
 */
export async function GET(req) {
  const url = new URL(req.url);
  const myDevice = url.searchParams.get("deviceId");
  const alsoHost = url.searchParams.get("alsoHost") === "1";
  const since = url.searchParams.get("since") || null;
  if (!myDevice) return jsonResponse({ ok: false, error: "deviceId é obrigatório" }, 400);

  try {
    const signals = await listScreenShareSignals({ myDevice, alsoHost, since });
    return jsonResponse({ ok: true, signals, now: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
