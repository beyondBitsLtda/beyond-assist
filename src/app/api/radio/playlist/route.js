import { getRadioPlaylist } from "@/lib/radioPlaylist.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/radio/playlist — lê radio/playlist.txt (ver src/lib/radioPlaylist.js). */
export async function GET() {
  try {
    const playlist = await getRadioPlaylist();
    return jsonResponse({ ok: true, playlist });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
