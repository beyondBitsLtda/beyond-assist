// Map of Deploy: lê o quadro do Trello, bate nas aplicações e guarda o resultado.
//
// SERVER-ONLY (usa a service_role do Supabase e as credenciais do Trello). A leitura do quadro
// e a matemática de disponibilidade ficam em src/lib/mapOfDeploy.js, que é pura e testada em
// node (npm run deploy-map) — aqui fica só o que precisa de rede e de banco.
import { supabase } from "./supabase.js";
import { loadBoardRaw } from "./ingest/trello.js";
import { agruparPorServidor, normalizarApps, resumo, resumoGeral } from "./mapOfDeploy.js";

/** O quadro. Configurável, com o link que o board já tem como padrão. */
export const BOARD = (process.env.TRELLO_DEPLOY_BOARD_ID || "jrz8oesi").trim();

/**
 * Quanto tempo esperar por uma resposta. Oito segundos é generoso pra hospedagem estática e
 * curto o bastante pra não estourar o limite da função quando uma aplicação trava sem responder.
 */
const TIMEOUT_MS = 8000;

/** Quantas checagens ao mesmo tempo. Em série, vinte aplicações lentas estouram o tempo da função. */
const PARALELAS = 6;

/** Janela padrão do histórico: uma semana já mostra padrão de instabilidade sem pesar a consulta. */
export const JANELA_PADRAO_H = 24 * 7;

/**
 * Uma checagem. Devolve SEMPRE um resultado — uma aplicação fora do ar não é uma exceção do
 * nosso lado, é o dado que o painel existe pra mostrar.
 *
 * Vai de GET, e não de HEAD: HEAD é mais barato, mas hospedagem estática e CDN respondem 405 a
 * ele com frequência, e aí um site no ar apareceria como quebrado. O corpo é descartado assim
 * que os cabeçalhos chegam.
 */
export async function checar(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // sem User-Agent de navegador, parte das hospedagens devolve 403 e o painel mentiria
        "user-agent": "Mozilla/5.0 (compatible; BeyondBits-MapOfDeploy/1.0)",
        accept: "text/html,*/*",
      },
    });
    try { await res.body?.cancel(); } catch {}
    return { status: res.status, ms: Date.now() - t0, erro: null };
  } catch (err) {
    const msg = String(err?.name === "TimeoutError" ? `sem resposta em ${TIMEOUT_MS / 1000}s` : err?.message || err);
    return { status: null, ms: Date.now() - t0, erro: msg.slice(0, 200) };
  }
}

/** Roda em lotes pra não abrir vinte conexões de uma vez nem esperar uma por uma. */
async function emLotes(itens, n, fn) {
  const out = [];
  for (let i = 0; i < itens.length; i += n) out.push(...await Promise.all(itens.slice(i, i + n).map(fn)));
  return out;
}

/** As aplicações do quadro, já normalizadas, mais a ordem das colunas. */
export async function carregarApps() {
  const board = await loadBoardRaw(BOARD);
  return { board, apps: normalizarApps(board.cards), listas: board.listas };
}

/**
 * Checa todas as aplicações com link e grava o resultado.
 *
 * Grava mesmo quando tudo está no ar: é a série de sucessos que dá sentido ao uptime. Sem os
 * acertos gravados, "3 falhas" não responde se foram 3 em 10 checagens ou 3 em 10 mil.
 */
export async function checarTodas() {
  const { apps } = await carregarApps();
  const comLink = apps.filter((a) => a.url);
  if (!comLink.length) return { ok: true, checadas: 0, aviso: "nenhum card com link na descrição" };

  const linhas = await emLotes(comLink, PARALELAS, async (a) => {
    const r = await checar(a.url);
    return {
      app_id: a.id,
      nome: a.nome,
      servidor: a.servidor,
      conta: a.conta,
      url: a.url,
      ok: r.status != null && r.status >= 200 && r.status < 400,
      status: r.status,
      ms: r.ms,
      erro: r.erro,
    };
  });

  const { error } = await supabase.from("deploy_checks").insert(linhas);
  if (error) throw new Error(`falha ao gravar checagens: ${error.message}`);
  return {
    ok: true,
    checadas: linhas.length,
    fora: linhas.filter((l) => !l.ok).length,
    em: new Date().toISOString(),
  };
}

/** Histórico das últimas `horas`, do mais antigo pro mais novo, por aplicação. */
async function historico(horas) {
  const desde = new Date(Date.now() - horas * 3600000).toISOString();
  const { data, error } = await supabase
    .from("deploy_checks")
    .select("app_id,url,ok,status,ms,erro,checked_at")
    .gte("checked_at", desde)
    .order("checked_at", { ascending: true })
    .limit(20000);
  if (error) throw new Error(`falha ao ler checagens: ${error.message}`);
  const por = new Map();
  for (const c of data || []) {
    if (!por.has(c.app_id)) por.set(c.app_id, []);
    por.get(c.app_id).push(c);
  }
  return por;
}

/**
 * O painel inteiro: o quadro do Trello com o estado de cada aplicação por cima.
 *
 * Se a tabela de checagens ainda não existir no banco, o quadro continua aparecendo e cada
 * aplicação fica "desconhecida" — é melhor ver o mapa sem o monitoramento do que uma tela de
 * erro escondendo as duas coisas.
 */
export async function montarPainel({ horas = JANELA_PADRAO_H } = {}) {
  const { board, apps, listas } = await carregarApps();

  let por = new Map();
  let aviso = null;
  try {
    por = await historico(horas);
  } catch (err) {
    aviso = `sem histórico de checagens: ${err.message}`;
  }

  const comEstado = apps.map((a) => {
    const checks = por.get(a.id) || [];
    return { ...a, resumo: resumo(checks), historico: checks.slice(-60).map((c) => ({ ok: c.ok, status: c.status, ms: c.ms, at: c.checked_at })) };
  });

  return {
    ok: true,
    board: { nome: board.nome, url: board.url },
    janelaHoras: horas,
    geral: resumoGeral(comEstado),
    servidores: agruparPorServidor(comEstado, listas).map((g) => ({
      ...g,
      noAr: g.apps.filter((a) => a.resumo.estado === "no ar").length,
      total: g.apps.length,
    })),
    aviso,
  };
}
