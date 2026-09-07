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

/** Busca dados REAIS e recentes de uma categoria — texto compacto pronto pro prompt da Lisa
 * (nunca inventa números/tarefas, só narra o que existe de verdade). Só inclui itens
 * PENDENTES/em aberto — o que já foi concluído/resolvido nunca aparece aqui. Nunca lança — uma
 * fonte fora do ar vira "" (texto vazio), não um erro 500.
 *
 * Sempre SORTEIA a amostra final de um pool mais largo (em vez de pegar sempre o mesmo top-N
 * fixo) — sem isso, toda vez que a mesma categoria era consultada de novo os dados eram
 * IDÊNTICOS e a Lisa acabava falando quase a mesma coisa de novo (bug real visto no rádio). */
export async function getCategoryData(category) {
  try {
    if (category === "trello") {
      const cards = await loadAllTrelloCards();
      const pending = cards.filter((c) => !DONE_PATTERN.test(c.list || ""));
      const withDue = pending.filter((c) => c.due).sort((a, b) => new Date(a.due) - new Date(b.due));
      const pool = (withDue.length ? withDue : pending).slice(0, 15);
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
