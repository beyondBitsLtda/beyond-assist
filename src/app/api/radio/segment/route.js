import { generateRadioTalkSegment, announceRadioSong, commentRadioSong } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { loadAllTrelloCards } from "@/lib/liveTrello.js";
import { getDelpTasksForContext } from "@/lib/delpTasks.js";
import { listTickets, summarizeTickets } from "@/lib/sentinel.js";
import { listThoughts } from "@/lib/notes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Busca dados REAIS e recentes de uma categoria — texto compacto pronto pro prompt da Lisa
 * (Modo Rádio nunca inventa números/tarefas, só narra o que existe de verdade). Nunca lança —
 * uma fonte fora do ar vira "(nada registrado)" pro bloco de rádio, não um erro 500. */
async function buildCategoryData(category) {
  try {
    if (category === "trello") {
      const cards = await loadAllTrelloCards();
      const withDue = cards.filter((c) => c.due).sort((a, b) => new Date(a.due) - new Date(b.due));
      const sample = (withDue.length ? withDue : cards).slice(0, 6);
      return sample.map((c) => `- [${c.board}${c.list ? ` / ${c.list}` : ""}] ${c.title}${c.due ? ` (prazo: ${c.due})` : ""}`).join("\n");
    }
    if (category === "delp") return await getDelpTasksForContext();
    if (category === "sentinel") {
      const tickets = await listTickets();
      const s = summarizeTickets(tickets);
      return `Chamados por status: ${JSON.stringify(s.byStatus)}\nPor prioridade: ${JSON.stringify(s.byPriority)}\nSLA de resposta estourado: ${s.sla.responseBreached}\nSLA de resolução estourado: ${s.sla.resolutionBreached}`;
    }
    if (category === "thoughts") {
      const { thoughts } = await listThoughts({ limit: 8 });
      return thoughts.map((t) => `- ${t.subject}${t.body ? `: ${t.body.slice(0, 140)}` : ""}`).join("\n");
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * POST /api/radio/segment   body: { kind: "talk"|"announce"|"comment", category?, songTitle? }
 * Modo Rádio — gera UM bloco de fala por vez (a Lisa incorporando uma apresentadora de rádio).
 */
export async function POST(req) {
  try {
    const { kind, category, songTitle } = await req.json();
    let text;
    if (kind === "talk") {
      const data = await buildCategoryData(category);
      text = await generateRadioTalkSegment({ category, data });
    } else if (kind === "announce") {
      if (!songTitle) return jsonResponse({ ok: false, error: "songTitle é obrigatório" }, 400);
      text = await announceRadioSong(songTitle);
    } else if (kind === "comment") {
      if (!songTitle) return jsonResponse({ ok: false, error: "songTitle é obrigatório" }, 400);
      text = await commentRadioSong(songTitle);
    } else {
      return jsonResponse({ ok: false, error: "kind inválido — use talk, announce ou comment" }, 400);
    }
    return jsonResponse({ ok: true, text });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
