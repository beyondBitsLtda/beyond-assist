// Testa o Worker de cron (workers/lisa-cron) sem rede e sem subir nada.
//
// Por que este arquivo existe: a primeira versão daquele Worker tinha dois defeitos que
// NENHUM build acusa, porque são acordos entre dois lados — ele mandava o segredo errado para
// a rota de sync (que devolveria 401 calado), e chamava o sync uma vez por hora sem nunca
// reiniciar nem avançar o ciclo, o que o deixaria parado para sempre. Os dois só apareceriam
// como "a Lisa parou de aprender", dias depois, sem erro visível em lugar nenhum.
//
// O Worker é importado de verdade — é o mesmo arquivo que sobe pra Cloudflare. O que é
// substituído é só o `fetch` global, que aqui anota a chamada em vez de sair pela rede.

import worker from "../workers/lisa-cron/src/index.js";

const AMBIENTE = {
  LISA_URL: "https://lisa.exemplo",
  CRON_SECRET: "segredo-de-cron",
  INGEST_SECRET: "segredo-de-ingest",
  VAPID_SUBJECT: "mailto:x@y.z",
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
};

let falhas = 0;
function conferir(oque, condicao, detalhe = "") {
  if (condicao) console.log(`  ok   ${oque}`);
  else {
    falhas++;
    console.log(`  FALHA ${oque}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/**
 * Dispara um horário do Worker com o `fetch` substituído.
 * @param {string} cron    o padrão agendado
 * @param {(url:string, n:number)=>object} responder  o que a Lisa "responderia"
 */
async function disparar(cron, responder) {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opcoes = {}) => {
    const headers = opcoes.headers || {};
    chamadas.push({ url: String(url), headers });
    const corpo = responder(String(url), chamadas.length) ?? { ok: true };
    return new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const res = await worker.fetch(new Request(`https://cron/?cron=${encodeURIComponent(cron)}`), AMBIENTE);
    return { chamadas, corpo: await res.json(), status: res.status };
  } finally {
    globalThis.fetch = original;
  }
}

console.log("\n1) o segredo certo para cada rota");
{
  const { chamadas } = await disparar("*/5 * * * *", () => ({ ok: true, note: "sem ciclo em andamento", pendentes: [] }));
  const notify = chamadas.find((c) => c.url.includes("/api/cron/notify"));
  const sync = chamadas.find((c) => c.url.includes("/api/cron/sync"));

  conferir("notify recebe Bearer com o CRON_SECRET", notify?.headers.authorization === `Bearer ${AMBIENTE.CRON_SECRET}`, JSON.stringify(notify?.headers));
  conferir("notify NÃO manda x-ingest-secret", !notify?.headers["x-ingest-secret"]);
  conferir("sync recebe x-ingest-secret com o INGEST_SECRET", sync?.headers["x-ingest-secret"] === AMBIENTE.INGEST_SECRET, JSON.stringify(sync?.headers));
  conferir("sync NÃO manda Bearer", !sync?.headers.authorization);
}

console.log("\n2) o ciclo de sync tem reinício E avanço");
{
  const { chamadas: naHora } = await disparar("0 * * * *", () => ({ ok: true, note: "ciclo reiniciado" }));
  conferir("de hora em hora chama o sync com ?reset=1", naHora.some((c) => c.url.endsWith("/api/cron/sync?reset=1")), naHora.map((c) => c.url).join(" | "));

  const { chamadas: aCada5 } = await disparar("*/5 * * * *", () => ({ ok: true, note: "sem ciclo em andamento", pendentes: [] }));
  const avancos = aCada5.filter((c) => c.url.endsWith("/api/cron/sync"));
  conferir("o horário frequente avança o ciclo (sem reset)", avancos.length >= 1, `avanços: ${avancos.length}`);
  conferir("nenhum avanço carrega ?reset=1", !avancos.some((c) => c.url.includes("reset")));
}

console.log("\n3) o avanço insiste enquanto há trabalho e para quando não há");
{
  const { chamadas: comTrabalho } = await disparar("*/5 * * * *", (url) =>
    url.includes("/api/cron/sync") ? { ok: true, note: 'passo "Trello: Delp" em andamento' } : { ok: true, pendentes: [] }
  );
  const fatias = comTrabalho.filter((c) => c.url.endsWith("/api/cron/sync")).length;
  // Propositalmente "mais de uma", e não um número exato: quantas fatias cabem num disparo é
  // uma calibragem que vai mudar (ver FATIAS_POR_DISPARO). O que não pode mudar é insistir
  // enquanto há trabalho — um disparo que avança uma fatia só nunca fecha um ciclo.
  conferir("havendo trabalho, avança mais de uma fatia por disparo", fatias > 1, `fatias: ${fatias}`);

  const { chamadas: semTrabalho } = await disparar("*/5 * * * *", (url) =>
    url.includes("/api/cron/sync") ? { ok: true, note: "ciclo concluído" } : { ok: true, pendentes: [] }
  );
  const desperdicio = semTrabalho.filter((c) => c.url.endsWith("/api/cron/sync")).length;
  conferir("ciclo concluído para na primeira fatia", desperdicio === 1, `fatias: ${desperdicio}`);
}

console.log("\n4) cada horário faz o seu trabalho");
{
  const { chamadas } = await disparar("*/15 * * * *", () => ({ ok: true }));
  conferir("o de 15 min chama só o deploy-check", chamadas.length === 1 && chamadas[0].url.endsWith("/api/cron/deploy-check"), chamadas.map((c) => c.url).join(" | "));

  const res = await worker.fetch(new Request("https://cron/?cron=nao-existe"), AMBIENTE);
  conferir("horário desconhecido devolve 400 com a lista", res.status === 400);
}

console.log("\n5) uma tarefa que falha não derruba as outras");
{
  const { corpo } = await disparar("*/5 * * * *", (url, n) => {
    if (url.includes("/api/cron/notify")) throw new Error("rede caiu");
    return { ok: true, note: "sem ciclo em andamento" };
  }).catch((err) => ({ corpo: { estourou: err.message } }));

  conferir("o disparo inteiro não estoura por causa de uma tarefa", !corpo.estourou, corpo.estourou);
  conferir("o avanço do sync acontece mesmo com o notify quebrado", Array.isArray(corpo?.resultado?.["sync-avanca"]), JSON.stringify(corpo?.resultado));
  conferir("a falha fica registrada na resposta", Boolean(corpo?.resultado?.notify?.erro));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
