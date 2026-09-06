import { generateRadioTalkSegment, announceRadioSong, commentRadioSong } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { loadAllTrelloCards } from "@/lib/liveTrello.js";
import { listDelpTasks } from "@/lib/delpTasks.js";
import { listTickets, summarizeTickets, STATUS_ORDER } from "@/lib/sentinel.js";
import { listThoughts } from "@/lib/notes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "concluído"/"feito"/"pronto"/"done"/etc — usado pra filtrar FORA o que já foi feito, tanto do
// Trello (nome da lista) quanto das Tarefas Delp (status). Sem isso, a Lisa falava de tarefas e
// chamados já resolvidos como se ainda precisassem de ação — bug real reportado pelo usuário.
const DONE_PATTERN = /conclu|feito|pronto|finaliz|done|entregue/i;
// status de chamado do Sentinela que contam como "encerrado" (mesma ordem de STATUS_ORDER, ver
// src/lib/sentinel.js) — os 2 últimos do fluxo.
const SENTINEL_DONE_STATUSES = new Set(STATUS_ORDER.slice(-2));

/** Busca dados REAIS e recentes de uma categoria — texto compacto pronto pro prompt da Lisa
 * (Modo Rádio nunca inventa números/tarefas, só narra o que existe de verdade). Só inclui
 * itens PENDENTES/em aberto — o que já foi concluído/resolvido nunca aparece aqui, pra não vir
 * narrado como se ainda precisasse de ação. Nunca lança — uma fonte fora do ar vira "(nada
 * registrado)" pro bloco de rádio, não um erro 500. */
async function buildCategoryData(category) {
  try {
    if (category === "trello") {
      const cards = await loadAllTrelloCards();
      const pending = cards.filter((c) => !DONE_PATTERN.test(c.list || ""));
      const withDue = pending.filter((c) => c.due).sort((a, b) => new Date(a.due) - new Date(b.due));
      const sample = (withDue.length ? withDue : pending).slice(0, 6);
      return sample.map((c) => `- [${c.board}${c.list ? ` / ${c.list}` : ""}] ${c.title}${c.due ? ` (prazo: ${c.due})` : ""}`).join("\n");
    }
    if (category === "delp") {
      const tasks = await listDelpTasks();
      const pending = tasks.filter((t) => !DONE_PATTERN.test(t.status || ""));
      return pending
        .slice(0, 10)
        .map((t) => `- [${t.status}] ${t.titulo} (responsável: ${t.atribuido_a || "—"}${t.data_limite ? `, prazo: ${t.data_limite}` : ""})`)
        .join("\n");
    }
    if (category === "sentinel") {
      const tickets = await listTickets();
      const pending = tickets.filter((t) => !SENTINEL_DONE_STATUSES.has(t.status));
      const s = summarizeTickets(pending);
      return `Chamados EM ABERTO por status: ${JSON.stringify(s.byStatus)}\nPor prioridade: ${JSON.stringify(s.byPriority)}\nSLA de resposta estourado: ${s.sla.responseBreached}\nSLA de resolução estourado: ${s.sla.resolutionBreached}`;
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
