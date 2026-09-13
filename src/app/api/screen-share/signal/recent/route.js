import { listScreenShareSignals } from "@/lib/screenShareSignals.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/screen-share/signal/recent?deviceId=<meu id>&alsoAddress=HOST:camera&since=<iso opcional>
 * Sinais WebRTC (Transmissão) novos endereçados a mim — ver src/lib/screenShareSignals.js.
 * `alsoAddress`: também escuta esse pseudo-endereço (ex.: 'HOST:screen', 'HOST:camera' — um por
 * canal de transmissão, quem estiver transmitindo aquele canal agora escuta por ele).
 */
export async function GET(req) {
  const url = new URL(req.url);
  const myDevice = url.searchParams.get("deviceId");
  const alsoAddress = url.searchParams.get("alsoAddress") || null;
  const since = url.searchParams.get("since") || null;
  if (!myDevice) return jsonResponse({ ok: false, error: "deviceId é obrigatório" }, 400);

  try {
    const signals = await listScreenShareSignals({ myDevice, alsoAddress, since });
    return jsonResponse({ ok: true, signals, now: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
