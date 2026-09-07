import { generateRadioTalkSegment, announceRadioSong, commentRadioSong, introduceSteve, commentAfterSteve } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { loadAllTrelloCards } from "@/lib/liveTrello.js";
import { listDelpTasks } from "@/lib/delpTasks.js";
import { listTickets, summarizeTickets, STATUS_ORDER } from "@/lib/sentinel.js";
import { listThoughts } from "@/lib/notes.js";
import { getWeatherForecast } from "@/lib/weather.js";
import { getTechNews } from "@/lib/techNews.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "concluído"/"feito"/"pronto"/"done"/etc — usado pra filtrar FORA o que já foi feito, tanto do
// Trello (nome da lista) quanto das Tarefas Delp (status). Sem isso, a Lisa falava de tarefas e
// chamados já resolvidos como se ainda precisassem de ação — bug real reportado pelo usuário.
const DONE_PATTERN = /conclu|feito|pronto|finaliz|done|entregue/i;
// status de chamado do Sentinela que contam como "encerrado" (mesma ordem de STATUS_ORDER, ver
// src/lib/sentinel.js) — os 2 últimos do fluxo.
const SENTINEL_DONE_STATUSES = new Set(STATUS_ORDER.slice(-2));

/** Embaralha uma cópia do array (Fisher-Yates). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Busca dados REAIS e recentes de uma categoria — texto compacto pronto pro prompt da Lisa
 * (Modo Rádio nunca inventa números/tarefas, só narra o que existe de verdade). Só inclui
 * itens PENDENTES/em aberto — o que já foi concluído/resolvido nunca aparece aqui, pra não vir
 * narrado como se ainda precisasse de ação. Nunca lança — uma fonte fora do ar vira "(nada
 * registrado)" pro bloco de rádio, não um erro 500.
 *
 * Sempre SORTEIA a amostra final de um pool mais largo (em vez de pegar sempre o mesmo top-N
 * fixo) — sem isso, toda vez que a mesma categoria caía de novo no Modo Rádio os dados eram
 * IDÊNTICOS, e a Lisa/Steve acabavam falando quase a mesma coisa de novo (bug real reportado
 * pelo usuário: "os assuntos se repetem demais"). */
async function buildCategoryData(category) {
  try {
    if (category === "trello") {
      const cards = await loadAllTrelloCards();
      const pending = cards.filter((c) => !DONE_PATTERN.test(c.list || ""));
      const withDue = pending.filter((c) => c.due).sort((a, b) => new Date(a.due) - new Date(b.due));
      const pool = (withDue.length ? withDue : pending).slice(0, 15); // ainda prioriza os mais urgentes, mas não trava sempre nos 6 primeiros
      const sample = shuffle(pool).slice(0, 6);
      return sample.map((c) => `- [${c.board}${c.list ? ` / ${c.list}` : ""}] ${c.title}${c.due ? ` (prazo: ${c.due})` : ""}`).join("\n");
    }
    if (category === "delp") {
      const tasks = await listDelpTasks();
      const pending = tasks.filter((t) => !DONE_PATTERN.test(t.status || ""));
      const sample = shuffle(pending.slice(0, 20)).slice(0, 8);
      return sample
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
      const { thoughts } = await listThoughts({ limit: 20 });
      const sample = shuffle(thoughts).slice(0, 6);
      return sample.map((t) => `- ${t.subject}${t.body ? `: ${t.body.slice(0, 140)}` : ""}`).join("\n");
    }
    if (category === "weather") {
      const cities = await getWeatherForecast();
      return cities
        .map((c) => `${c.city}: ${c.days.slice(0, 2).map((d, i) => `${i === 0 ? "hoje" : "amanhã"} ${d.description}, máx ${Math.round(d.max)}°C mín ${Math.round(d.min)}°C, ${d.rainChance}% de chance de chuva`).join("; ")}`)
        .join("\n");
    }
    if (category === "news") {
      const items = await getTechNews({ limit: 20 });
      const sample = shuffle(items).slice(0, 6);
      return sample.map((n) => `- [${n.source}] ${n.title}`).join("\n");
    }
    return "";
  } catch {
    return "";
  }
}

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
      const data = await buildCategoryData(category);
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
