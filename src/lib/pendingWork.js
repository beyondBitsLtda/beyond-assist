// Dados REAIS e pendentes/em aberto de cada fonte do Beyond Bits — usado tanto pelo Modo Rádio
// (src/app/api/radio/segment/route.js) quanto pela Lisa Code (extensão do VS Code, ver
// src/app/api/lisa-code/*). Extraído pra cá quando a segunda consumidora apareceu, pra não
// duplicar o filtro de "o que já foi concluído não deve aparecer como pendente" (bug real já
// visto e corrigido no rádio) em dois lugares.
import { loadAllTrelloCards } from "./liveTrello.js";
import { listDelpTasks } from "./delpTasks.js";
import { listTickets, summarizeTickets, STATUS_ORDER } from "./sentinel.js";
import { listThoughts } from "./notes.js";
import { getWeatherForecast } from "./weather.js";
import { getTechNews } from "./techNews.js";

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

/** "(prazo: 2026-08-30 — ATRASADA há 7 dias)" / "vence em 4 dias" / "vence HOJE" — calculado
 * aqui, nunca deixado pro modelo "adivinhar" a partir só da data crua. Sem isso a Lisa/Steve
 * confundiam prazo JÁ VENCIDO com prazo A VENCER (bug real reportado pelo usuário: ela narrava
 * uma tarefa atrasada como se fosse "vencer" — LLM não é confiável fazendo essa conta sozinho,
 * principalmente sem saber a data de hoje). */
function daysLabel(dueIso) {
  if (!dueIso) return "";
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return "";
  const diffDays = Math.round((due.getTime() - Date.now()) / 86_400_000);
  if (diffDays < 0) return ` — ATRASADA há ${Math.abs(diffDays)} dia${Math.abs(diffDays) === 1 ? "" : "s"}`;
  if (diffDays === 0) return " — vence HOJE";
  return ` — vence em ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
}

/** Sorteia `n` itens de `pool`, priorizando os que NÃO estão em `excludeKeys` (itens já
 * mencionados em locuções recentes desta mesma sessão de rádio/conversa) — só volta a repetir
 * um item já usado quando não sobra nenhum inédito pra completar a cota. Devolve também as
 * chaves realmente usadas, pra quem chamou acumular e mandar de novo na próxima vez (ver
 * `excludeKeys` em getCategoryData). Isso é o que garante variedade de verdade entre chamadas —
 * embaralhar sozinho não bastava quando o pool real é pequeno (o mesmo item aleatório podia sair
 * nas mesmas 2-3 vezes seguidas por azar). */
function pickVaried(pool, keyFn, excludeKeys, n) {
  const excludeSet = new Set(excludeKeys);
  const unseen = shuffle(pool.filter((x) => !excludeSet.has(keyFn(x))));
  const seen = shuffle(pool.filter((x) => excludeSet.has(keyFn(x))));
  const sample = [...unseen, ...seen].slice(0, n);
  return { sample, usedKeys: sample.map(keyFn) };
}

/** Busca dados REAIS e recentes de uma categoria — texto compacto pronto pro prompt da Lisa
 * (nunca inventa números/tarefas, só narra o que existe de verdade) + as chaves dos itens
 * realmente usados desta vez (`usedKeys`, vazio pra categorias sem itens individuais como
 * weather). Só inclui itens PENDENTES/em aberto — o que já foi concluído/resolvido nunca aparece
 * aqui. `excludeKeys` (opcional) evita repetir itens já mencionados recentemente — ver
 * pickVaried. Nunca lança — uma fonte fora do ar vira texto vazio, não um erro 500. */
export async function getCategoryData(category, excludeKeys = []) {
  try {
    if (category === "trello") {
      const cards = await loadAllTrelloCards();
      const pending = cards.filter((c) => !DONE_PATTERN.test(c.list || ""));
      const withDue = pending.filter((c) => c.due).sort((a, b) => new Date(a.due) - new Date(b.due));
      const pool = (withDue.length ? withDue : pending).slice(0, 25);
      const { sample, usedKeys } = pickVaried(pool, (c) => c.id, excludeKeys, 6);
      const text = sample.map((c) => `- [${c.board}${c.list ? ` / ${c.list}` : ""}] ${c.title}${c.due ? ` (prazo: ${c.due}${daysLabel(c.due)})` : ""}`).join("\n");
      return { text, usedKeys };
    }
    if (category === "delp") {
      const tasks = await listDelpTasks();
      const pending = tasks.filter((t) => !DONE_PATTERN.test(t.status || ""));
      const { sample, usedKeys } = pickVaried(pending, (t) => t.id, excludeKeys, 8);
      const text = sample
        .map((t) => `- [${t.status}] ${t.titulo} (responsável: ${t.atribuido_a || "—"}${t.data_limite ? `, prazo: ${t.data_limite}${daysLabel(t.data_limite)}` : ""})`)
        .join("\n");
      return { text, usedKeys };
    }
    if (category === "sentinel") {
      const tickets = await listTickets();
      const pending = tickets.filter((t) => !SENTINEL_DONE_STATUSES.has(t.status));
      const s = summarizeTickets(pending);
      // além do agregado (que não muda de uma hora pra outra), sorteia chamados CONCRETOS reais
      // pra citar por nome — sem isso, toda vez que a categoria caía a Lisa só repetia os
      // mesmos números de novo (bug real reportado pelo usuário).
      const { sample, usedKeys } = pickVaried(pending, (t) => t.id, excludeKeys, 3);
      const tickets_text = sample
        .map((t) => `- #${t.display_id || t.id} [${t.priority}/${t.status}] ${t.title}${t.response_breached ? " (SLA de resposta estourado)" : ""}${t.resolution_breached ? " (SLA de resolução estourado)" : ""}`)
        .join("\n");
      const text = `Chamados EM ABERTO por status: ${JSON.stringify(s.byStatus)}\nPor prioridade: ${JSON.stringify(s.byPriority)}\nSLA de resposta estourado: ${s.sla.responseBreached}\nSLA de resolução estourado: ${s.sla.resolutionBreached}${tickets_text ? `\n\nAlguns chamados específicos (cite só se fizer sentido, não precisa listar todos):\n${tickets_text}` : ""}`;
      return { text, usedKeys };
    }
    if (category === "thoughts") {
      const { thoughts } = await listThoughts({ limit: 30 });
      const { sample, usedKeys } = pickVaried(thoughts, (t) => t.id, excludeKeys, 6);
      const text = sample.map((t) => `- ${t.subject}${t.body ? `: ${t.body.slice(0, 140)}` : ""}`).join("\n");
      return { text, usedKeys };
    }
    if (category === "weather") {
      const cities = await getWeatherForecast();
      const text = cities
        .map((c) => `${c.city}: ${c.days.slice(0, 2).map((d, i) => `${i === 0 ? "hoje" : "amanhã"} ${d.description}, máx ${Math.round(d.max)}°C mín ${Math.round(d.min)}°C, ${d.rainChance}% de chance de chuva`).join("; ")}`)
        .join("\n");
      return { text, usedKeys: [] };
    }
    if (category === "news") {
      const items = await getTechNews({ limit: 30 });
      const { sample, usedKeys } = pickVaried(items, (n) => n.link, excludeKeys, 6);
      const text = sample.map((n) => `- [${n.source}] ${n.title}`).join("\n");
      return { text, usedKeys };
    }
    return { text: "", usedKeys: [] };
  } catch {
    return { text: "", usedKeys: [] };
  }
}
