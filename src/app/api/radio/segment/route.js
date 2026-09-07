import { generateRadioTalkSegment, announceRadioSong, commentRadioSong, introduceSteve, commentAfterSteve } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { getCategoryData } from "@/lib/pendingWork.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/radio/segment   body: { kind, category?, songTitle?, sourceText? }
 * kind: "talk" | "announce" | "comment" | "introduce-steve" | "comment-steve"
 * Modo Rádio — gera UM bloco de fala por vez (a Lisa incorporando uma apresentadora de rádio).
 */
export async function POST(req) {
  try {
    const { kind, category, songTitle, sourceText } = await req.json();
    let text;
    if (kind === "talk") {
      const data = await getCategoryData(category);
      text = await generateRadioTalkSegment({ category, data });
    } else if (kind === "announce") {
      if (!songTitle) return jsonResponse({ ok: false, error: "songTitle é obrigatório" }, 400);
      text = await announceRadioSong(songTitle);
    } else if (kind === "comment") {
      if (!songTitle) return jsonResponse({ ok: false, error: "songTitle é obrigatório" }, 400);
      text = await commentRadioSong(songTitle);
    } else if (kind === "introduce-steve") {
      text = await introduceSteve();
    } else if (kind === "comment-steve") {
      if (!sourceText) return jsonResponse({ ok: false, error: "sourceText é obrigatório" }, 400);
      text = await commentAfterSteve(sourceText);
    } else {
      return jsonResponse({ ok: false, error: "kind inválido — use talk, announce, comment, introduce-steve ou comment-steve" }, 400);
    }
    return jsonResponse({ ok: true, text });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
