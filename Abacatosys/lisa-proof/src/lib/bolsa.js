// A Bolsa do Reino no banco: abrir o pregão do dia (a Lisa decide; sem ela, o sorteio do dia),
// comprar e vender. As regras moram em src/dominio/bolsa.js.
//
// O PREGÃO abre no primeiro acesso depois da meia-noite (não depende de relógio nenhum). Quem
// chega primeiro grava o pregão do dia com status "gerando" — a chave do dia não deixa dois
// abrirem juntos —, pede o pregão à Lisa e aplica. Enquanto isso, ninguém compra nem vende: os
// preços estão mudando. Um pregão que travou no meio (a função caiu) é retomado depois de
// MINUTOS_PARA_RETOMAR; aplicar de novo não dobra nada, porque o preço de cada ação no dia tem
// chave própria (acao, dia).
//
// HORA A HORA (23/10/2026): o pregão grava, para cada ação, a ABERTURA (o fechamento de ontem) e o
// FECHAMENTO que a Lisa decidiu; o preço de cada hora sai do caminho entre os dois (caminhoDoDia,
// em src/dominio/bolsa.js), calculado na hora em que alguém olha — o mesmo para todo mundo. Quem
// sai da bolsa (falência, fechamento de capital) sai na abertura, pelo fechamento de ontem.
//
// Dinheiro: comprar segue a ordem do reino (lança, grava o reino com a versão, desfaz se perder a
// corrida); vender tira as ações primeiro (só se a posição ainda for a que eu li) e depois paga.
//
// HORÁRIO (23/10/2026): negociar só das 07:00 às 17:00 (ABRE_AS/FECHA_AS em src/dominio/bolsa.js).
//
// DOIS MUNDOS (23/10/2026): o mercado (as ações, os preços e o pregão da Lisa) é um só; a carteira,
// as ordens e o dinheiro são de cada mundo (src/lib/mundo.js). No Reino de Teste a bolsa negocia a
// qualquer hora, e na hora simulada. O pregão sempre abre no mundo de verdade, e a empresa que sai
// da bolsa paga (ou vira pó) nos dois mundos.

import { db, noMundo, emTeste, modoDeTesteLigado } from "./mundo.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas } from "./estudo.js";
import { gerarJson, temModelo, PERSONA } from "./ia.js";
import { obterReino, saldoDoUsuario } from "./reino.js";
import { diaDe, somarDias } from "@/dominio/datas.js";
import { horaEmSaoPaulo } from "@/dominio/raioX.js";
import { centavos } from "@/dominio/moedas.js";
import {
  SETORES, VARIACAO_MAXIMA, PRECO_MINIMO, PRECO_INICIAL, TAXA_DA_CORRETAGEM, NOVAS_POR_DIA, ACOES_DO_PRIMEIRO_DIA,
  MAXIMO_POR_ORDEM, MAXIMO_DE_ACOES, precoDepois, variacaoReal, podeComprarAcao, podeVenderAcao, posicaoDepois,
  validarPregao, pregaoDeReserva, saidasDaBolsa, caminhoDoDia, velaDe, sementeDaAcao, valorDaVenda,
  ABRE_AS, FECHA_AS, pregaoAberto, passosAte, precoNaHora, horaDoPasso, proximaVirada,
} from "@/dominio/bolsa.js";
import { relatorioDaMesa } from "@/dominio/projecoes.js";

const MINUTOS_PARA_RETOMAR = 3;
const DIAS_DE_HISTORICO = 14;
const CAMPOS_DA_ACAO = "id, nome, setor, emoji, descricao, preco, preco_inicial, status, criada_em, saiu_em";

/** O caminho de uma ação num dia (linha de proof_bolsa_precos): da abertura ao fechamento. */
const caminhoDa = (linha) => caminhoDoDia({ abertura: linha.abertura ?? linha.preco, fechamento: linha.preco, semente: sementeDaAcao(linha.acao_id, linha.dia) });
/** A hora do pregão agora: 0 a 23, em São Paulo. */
const horaAgora = () => horaEmSaoPaulo(new Date());
const horaValida = (h) => Number.isInteger(h) && h >= 0 && h <= 23;
const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const FECHADO = `o pregão está fechado — a bolsa negocia das ${hh(ABRE_AS)} às ${hh(FECHA_AS)} (horário de Brasília)`;

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

// ---------------------------------------------------------------- a Lisa decide o pregão

const ESQUEMA_DO_PREGAO = {
  type: "OBJECT",
  properties: {
    manchete: { type: "STRING" },
    movimentos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { ticker: { type: "STRING" }, variacao: { type: "INTEGER" }, noticia: { type: "STRING" } },
        required: ["ticker", "variacao", "noticia"],
      },
    },
    novas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          ticker: { type: "STRING" }, nome: { type: "STRING" }, setor: { type: "STRING", enum: SETORES },
          emoji: { type: "STRING" }, descricao: { type: "STRING" }, preco: { type: "INTEGER" },
        },
        required: ["ticker", "nome", "setor", "emoji", "descricao", "preco"],
      },
    },
  },
  required: ["manchete", "movimentos", "novas"],
  propertyOrdering: ["manchete", "movimentos", "novas"],
};

/** O que aconteceu no jogo ontem, para as notícias da Lisa terem a ver com o reino. */
async function acontecimentosDe(dia) {
  const ontem = somarDias(dia, -1);
  const [exp, inv, paz] = await Promise.all([
    db.from("proof_expedicoes").select("veiculo, expedicao, estrelas").eq("dia", ontem).limit(2000),
    db.from("proof_invasoes").select("id", { count: "exact", head: true }).eq("dia", ontem),
    db.from("proof_pazes").select("id").eq("status", "aprovada").gt("fim", new Date().toISOString()).limit(1),
  ]);
  const porVeiculo = {};
  for (const x of exp.data || []) porVeiculo[x.veiculo || "barco"] = (porVeiculo[x.veiculo || "barco"] || 0) + 1;
  return {
    expedicoesOntem: (exp.data || []).length, expedicoesPorVeiculo: porVeiculo,
    planetoidesOntem: (exp.data || []).filter((x) => x.expedicao === "planetoide").length,
    invasoesOntem: inv.count || 0, emPaz: Boolean((paz.data || []).length),
  };
}

async function pedirPregaoALisa({ dia, ativas, historico, novas, acontecimentos }) {
  const linhas = ativas.map((a) => {
    const ultimas = (historico.get(a.id) || []).slice(-4).map((h) => `${h.variacao > 0 ? "+" : ""}${h.variacao}%`).join(" ");
    return `${a.id} · ${a.nome} (${a.setor}) · ${a.preco} moedas · últimos pregões: ${ultimas || "estreou agora"}`;
  });
  const sistema = `${PERSONA} Hoje você também é a apresentadora da Bolsa do Reino, a bolsa de valores de mentira do jogo Reino do Neuro, ` +
    "onde os estudantes investem as moedas que ganham estudando. As empresas são fictícias e divertidas, do mundo do jogo " +
    "(reinos, minas de ouro, expedições contra monstros, submarinos, dirigíveis, tanques de magma, naves e planetoides alienígenas).";
  const pedido = [
    `Abra o pregão de ${dia}.`,
    ativas.length
      ? `Para CADA empresa abaixo, decida quanto a ação sobe ou cai hoje (inteiro de -${VARIACAO_MAXIMA} a ${VARIACAO_MAXIMA}) e escreva uma notícia curta (até 120 caracteres) que explique o movimento. Faça um dia variado: algumas sobem, outras caem, algumas quase não mexem; quedas e altas grandes são raras. Não repita o mesmo sinal para todas.`
      : "A bolsa ainda não tem empresas: não há movimentos (devolva a lista vazia).",
    ...linhas,
    `O que aconteceu no jogo ontem: ${acontecimentos.expedicoesOntem} expedições (por veículo: ${JSON.stringify(acontecimentos.expedicoesPorVeiculo)}; ${acontecimentos.planetoidesOntem} a planetoides), ${acontecimentos.invasoesOntem} invasões entre reinos, ${acontecimentos.emPaz ? "o mundo está em PAZ" : "o mundo está em guerra"}. Use isso nas notícias quando fizer sentido (paz derruba armas, muitas expedições ao mar animam o setor de tesouros do mar...).`,
    `Lance ${novas} empresa(s) nova(s): ticker de 3 a 5 letras maiúsculas que ainda não exista, nome criativo (até 40 caracteres), setor da lista, um emoji, descrição de uma frase e preço de lançamento de ${PRECO_INICIAL[0]} a ${PRECO_INICIAL[1]} moedas.`,
    "Escreva também a manchete do dia (até 120 caracteres), no tom de um telejornal animado.",
  ].join("\n");
  return gerarJson({ sistema, pedido, esquema: ESQUEMA_DO_PREGAO, maxTokens: 3000, pensarPouco: true, temperatura: 0.9 });
}

// ---------------------------------------------------------------- abrir e aplicar o pregão

async function acoesAtivas() {
  const { data, error } = await db.from("proof_bolsa_acoes").select(CAMPOS_DA_ACAO).eq("status", "ativa").order("criada_em").order("id");
  falhou(error, "ações");
  return data || [];
}

async function historicoDe(ids, desde) {
  if (!ids.length) return new Map();
  const linhas = await buscarTodas(() => db.from("proof_bolsa_precos").select("acao_id, dia, abertura, preco, variacao, noticia").in("acao_id", ids).gte("dia", desde).order("dia").order("acao_id"));
  const m = new Map();
  for (const l of linhas) { if (!m.has(l.acao_id)) m.set(l.acao_id, []); m.get(l.acao_id).push({ ...l, variacao: Number(l.variacao) }); }
  return m;
}

/**
 * Tira uma ação da bolsa: falência (as ações viram pó) ou fechamento de capital (paga o preço do
 * dia). A empresa é a mesma nos dois mundos: quem tem ações dela no de verdade e no Reino de Teste
 * sai junto, cada um com o seu dinheiro.
 */
async function retirarDaBolsa(acao, motivo, dia) {
  for (const mundo of ["real", "teste"]) await noMundo(mundo, () => devolverPosicoes(acao, motivo));
  await db.from("proof_bolsa_acoes").update({ status: motivo, saiu_em: dia }).eq("id", acao.id).eq("status", "ativa");
}

async function devolverPosicoes(acao, motivo) {
  const posicoes = await buscarTodas(() => db.from("proof_bolsa_posicoes").select("usuario_id, quantidade, custo").eq("acao_id", acao.id).gt("quantidade", 0).order("usuario_id"));
  for (const p of posicoes) {
    // zera primeiro (só se ninguém mexeu); depois paga — nunca paga duas vezes
    const { data: zerou } = await db.from("proof_bolsa_posicoes").update({ quantidade: 0, custo: 0 })
      .eq("usuario_id", p.usuario_id).eq("acao_id", acao.id).eq("quantidade", p.quantidade).select("usuario_id");
    if (!(zerou || []).length) continue;
    const total = motivo === "fechada" ? p.quantidade * acao.preco : 0;
    if (total > 0) await db.from("proof_reino_movimentos").insert({ usuario_id: p.usuario_id, tipo: "bolsa_resgate", valor: total, detalhe: { acao: acao.id, quantidade: p.quantidade, preco: acao.preco } });
    await db.from("proof_bolsa_ordens").insert({ usuario_id: p.usuario_id, acao_id: acao.id, tipo: motivo === "fechada" ? "resgate" : "falencia", quantidade: p.quantidade, preco: acao.preco, taxa: 0, total });
  }
}

async function aplicarPregao(dia, pregao, ativas) {
  // 1) quem sai da bolsa sai na abertura, pelo fechamento de ONTEM (o de hoje ainda vai andar o dia todo)
  const { faliram, fecham } = saidasDaBolsa(ativas, pregao.novas.length);
  for (const a of ativas) {
    if (faliram.includes(a.id)) await retirarDaBolsa(a, "falida", dia);
    else if (fecham.includes(a.id)) await retirarDaBolsa(a, "fechada", dia);
  }
  const ficam = ativas.filter((a) => !faliram.includes(a.id) && !fecham.includes(a.id));
  // 2) o dia de cada ação: abre no fechamento de ontem e fecha onde a Lisa decidiu — a chave
  //    (acao, dia) não deixa aplicar duas vezes
  const linhas = pregao.movimentos.filter((m) => ficam.some((a) => a.id === m.acao)).map((m) => {
    const a = ficam.find((x) => x.id === m.acao);
    const preco = precoDepois(a.preco, m.variacao);
    return { acao_id: a.id, dia, abertura: a.preco, preco, variacao: variacaoReal(a.preco, preco), noticia: m.noticia };
  });
  if (linhas.length) {
    const { error } = await db.from("proof_bolsa_precos").upsert(linhas, { onConflict: "acao_id,dia", ignoreDuplicates: true });
    falhou(error, "preços do dia");
  }
  // 3) o preço guardado da ação = o fechamento do dia (é a abertura de amanhã; o da hora sai do caminho)
  const { data: doDia, error } = await db.from("proof_bolsa_precos").select("acao_id, preco").eq("dia", dia);
  falhou(error, "preços do dia");
  const precoDoDia = new Map((doDia || []).map((l) => [l.acao_id, l.preco]));
  for (const a of ficam) {
    const p = precoDoDia.get(a.id);
    if (p != null && p !== a.preco) await db.from("proof_bolsa_acoes").update({ preco: p }).eq("id", a.id);
  }
  // 4) as empresas novas estreiam: o dia delas balança em volta do preço de lançamento
  if (pregao.novas.length) {
    const { error: e1 } = await db.from("proof_bolsa_acoes").upsert(pregao.novas.map((n) => ({
      id: n.id, nome: n.nome, setor: n.setor, emoji: n.emoji, descricao: n.descricao, preco: n.preco, preco_inicial: n.preco, status: "ativa", criada_em: dia,
    })), { onConflict: "id", ignoreDuplicates: true });
    falhou(e1, "ações novas");
    await db.from("proof_bolsa_precos").upsert(pregao.novas.map((n) => ({ acao_id: n.id, dia, abertura: n.preco, preco: n.preco, variacao: 0, noticia: `Estreia na bolsa: ${n.descricao}`.slice(0, 160) })),
      { onConflict: "acao_id,dia", ignoreDuplicates: true });
  }
}

/**
 * O pregão de hoje: pronto (devolve), sendo aberto por outra pessoa (devolve `abrindo`) ou ainda
 * não aberto (abre agora — a Lisa decide; sem ela, o sorteio do dia). Sempre no mundo de verdade,
 * mesmo quando quem chega primeiro está no Reino de Teste.
 */
export const pregaoDeHoje = () => noMundo("real", abrirPregaoDeHoje);

async function abrirPregaoDeHoje() {
  const dia = diaDe();
  const { data: atual, error } = await db.from("proof_bolsa_pregoes").select("dia, status, manchete, gerado_por, criado_em").eq("dia", dia).maybeSingle();
  falhou(error, "pregão");
  if (atual?.status === "pronto") return { ...atual, abrindo: false };

  let souEu = false;
  if (!atual) {
    const ins = await db.from("proof_bolsa_pregoes").insert({ dia, status: "gerando" }).select("dia").maybeSingle();
    souEu = !ins.error && Boolean(ins.data);
  } else {
    // travado no meio por tempo demais: retoma (só um consegue, pela condição no criado_em)
    const limite = new Date(Date.now() - MINUTOS_PARA_RETOMAR * 60_000).toISOString();
    const { data } = await db.from("proof_bolsa_pregoes").update({ criado_em: new Date().toISOString() })
      .eq("dia", dia).eq("status", "gerando").lt("criado_em", limite).select("dia");
    souEu = Boolean((data || []).length);
  }
  if (!souEu) return { dia, status: "gerando", manchete: "", gerado_por: "lisa", abrindo: true };

  const ativas = await acoesAtivas();
  const { data: todas } = await db.from("proof_bolsa_acoes").select("id");
  const existentes = (todas || []).map((a) => a.id);
  const novas = ativas.length ? NOVAS_POR_DIA : ACOES_DO_PRIMEIRO_DIA;
  let pregao, geradoPor = "lisa";
  try {
    if (!temModelo()) throw new Error("sem IA configurada");
    const historico = await historicoDe(ativas.map((a) => a.id), somarDias(dia, -6));
    const resposta = await pedirPregaoALisa({ dia, ativas, historico, novas, acontecimentos: await acontecimentosDe(dia) });
    pregao = validarPregao(resposta, ativas, { novas, existentes });
    if (!pregao.novas.length && novas) pregao.novas = pregaoDeReserva(dia, ativas, { novas, existentes }).novas; // a IA não lançou nenhuma
  } catch {
    pregao = pregaoDeReserva(dia, ativas, { novas, existentes });
    geradoPor = "reserva";
  }
  await aplicarPregao(dia, pregao, ativas);
  const { error: e2 } = await db.from("proof_bolsa_pregoes").update({ status: "pronto", manchete: pregao.manchete, gerado_por: geradoPor, pronto_em: new Date().toISOString() }).eq("dia", dia);
  falhou(e2, "pregão");
  return { dia, status: "pronto", manchete: pregao.manchete, gerado_por: geradoPor, abrindo: false };
}

// ---------------------------------------------------------------- a tela

/**
 * A bolsa como a tela mostra: o pregão, o Índice do Reino, cada ação com o preço desta hora, a
 * curva do dia (hora a hora), as velas dos últimos dias e o volume negociado hoje, e a minha
 * carteira ao preço desta hora.
 */
export async function estadoDaBolsa(usuarioId, { hora: horaPedida } = {}) {
  const pregao = await pregaoDeHoje();
  const dia = diaDe();
  const horaDeVerdade = horaAgora();
  // Reino de Teste: ver (e negociar) o pregão de hoje numa hora qualquer
  const simulada = emTeste() && horaValida(horaPedida);
  const hora = simulada ? horaPedida : horaDeVerdade;
  const passos = passosAte(hora); // quantas horas de pregão já andaram (nenhuma antes das 07:00)
  const inicioDoDia = `${dia}T00:00:00-03:00`;
  const [ativas, posicoesR, ordensR, saidasR, saldo, volumeR] = await Promise.all([
    acoesAtivas(),
    db.from("proof_bolsa_posicoes").select("acao_id, quantidade, custo").eq("usuario_id", usuarioId).gt("quantidade", 0),
    db.from("proof_bolsa_ordens").select("acao_id, tipo, quantidade, preco, taxa, total, criado_em").eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(10),
    db.from("proof_bolsa_acoes").select(CAMPOS_DA_ACAO).neq("status", "ativa").gte("saiu_em", somarDias(dia, -3)).order("saiu_em", { ascending: false }),
    saldoDoUsuario(usuarioId),
    db.from("proof_bolsa_ordens").select("acao_id, quantidade").in("tipo", ["compra", "venda"]).gte("criado_em", inicioDoDia).limit(5000),
  ]);
  falhou(posicoesR.error, "carteira");
  const historico = await historicoDe(ativas.map((a) => a.id), somarDias(dia, -(DIAS_DE_HISTORICO - 1)));
  const volume = new Map();
  for (const o of volumeR.data || []) volume.set(o.acao_id, (volume.get(o.acao_id) || 0) + o.quantidade);
  const minha = new Map((posicoesR.data || []).map((p) => [p.acao_id, { ...p, custo: Number(p.custo) || 0 }]));
  const nomeDe = new Map([...ativas, ...(saidasR.data || [])].map((a) => [a.id, a.nome]));
  const pct = (de, para) => (de > 0 ? Math.round(((para - de) / de) * 1000) / 10 : 0);

  const acoes = ativas.map((a) => {
    const h = historico.get(a.id) || [];
    const linhaDeHoje = h.find((x) => x.dia === dia);
    const caminho = linhaDeHoje ? caminhoDa(linhaDeHoje) : null;
    // sem pregão hoje ainda, o preço é o fechamento de ontem, parado
    const doDia = caminho ? caminho.slice(0, passos + 1) : [a.preco];
    const agora = doDia[doDia.length - 1];
    const abertura = doDia[0];
    const p = minha.get(a.id);
    const valor = p ? valorDaVenda(agora, p.quantidade) : 0;
    return {
      id: a.id, nome: a.nome, setor: a.setor, emoji: a.emoji, descricao: a.descricao, precoInicial: a.preco_inicial,
      preco: agora, abertura, maxima: Math.max(...doDia), minima: Math.min(...doDia),
      variacao: pct(abertura, agora), estreia: a.criada_em === dia, noticia: linhaDeHoje?.noticia || "",
      volume: volume.get(a.id) || 0,
      horas: doDia.map((preco, i) => ({ hora: horaDoPasso(i), preco })),
      velas: h.map((l) => ({ dia: l.dia, ...(l.dia === dia ? velaDe(caminhoDa(l), passos) : velaDe(caminhoDa(l))) })),
      minha: p ? { quantidade: p.quantidade, custo: p.custo, valor, lucro: centavos(valor - p.custo), precoMedio: centavos(p.custo / p.quantidade) } : null,
    };
  });
  // o Índice do Reino: a soma dos preços de todas as ações, hora a hora (como um índice de bolsa)
  const serie = Array.from({ length: passos + 1 }, (_, i) => ({ hora: horaDoPasso(i), valor: Math.round(acoes.reduce((s, x) => s + (x.horas[i]?.preco ?? x.preco), 0) * 100) / 100 }));
  const indice = { valor: serie[serie.length - 1]?.valor || 0, abertura: serie[0]?.valor || 0, serie };
  indice.variacao = pct(indice.abertura, indice.valor);
  const carteiraValor = centavos(acoes.reduce((s, x) => s + (x.minha?.valor || 0), 0));
  const carteiraCusto = centavos(acoes.reduce((s, x) => s + (x.minha?.custo || 0), 0));
  return {
    pregao: {
      dia: pregao.dia, manchete: pregao.manchete, geradoPor: pregao.gerado_por, abrindo: pregao.abrindo, hora, horaDeVerdade, simulada,
      aberto: pregaoAberto(horaDeVerdade), podeNegociar: emTeste() || pregaoAberto(horaDeVerdade),
      abreAs: ABRE_AS, fechaAs: FECHA_AS, proximaAtualizacao: proximaVirada(dia, horaDeVerdade),
    },
    mundo: emTeste() ? "teste" : "real",
    modoDeTeste: modoDeTesteLigado(),
    regras: { taxa: TAXA_DA_CORRETAGEM, variacaoMaxima: VARIACAO_MAXIMA, precoMinimo: PRECO_MINIMO, maximoDeAcoes: MAXIMO_DE_ACOES, maximoPorOrdem: MAXIMO_POR_ORDEM, novasPorDia: NOVAS_POR_DIA },
    saldo, indice, acoes,
    carteira: { valor: carteiraValor, custo: carteiraCusto, lucro: centavos(carteiraValor - carteiraCusto) },
    saidas: (saidasR.data || []).map((a) => ({ id: a.id, nome: a.nome, emoji: a.emoji, status: a.status, preco: a.preco, dia: a.saiu_em })),
    ordens: (ordensR.data || []).map((o) => ({ ...o, preco: Number(o.preco), taxa: Number(o.taxa), total: Number(o.total), nome: nomeDe.get(o.acao_id) || o.acao_id })),
  };
}

// ---------------------------------------------------------------- a mesa dos consultores

/** Quantos dias para trás procurar os pregões do placar (o pregão só abre nos dias em que alguém entra). */
const DIAS_DO_PLACAR = 21;

/**
 * A Mesa dos Consultores (26/10/2026): a projeção de cada consultor para o fechamento de hoje e o
 * placar dos últimos pregões. O fechamento de hoje é o segredo do dia: só a conta das projeções
 * (src/dominio/projecoes.js) o vê, e o resultado só aparece depois que o pregão fecha (no Reino
 * de Teste, na hora simulada). Nada é gravado: as projeções saem dos preços, com semente.
 */
export async function mesaDosConsultores({ hora: horaPedida } = {}) {
  const pregao = await pregaoDeHoje();
  const dia = diaDe();
  const hora = emTeste() && horaValida(horaPedida) ? horaPedida : horaAgora();
  const [acoesR, linhas] = await Promise.all([
    db.from("proof_bolsa_acoes").select("id, nome, setor, emoji, criada_em"),
    buscarTodas(() => db.from("proof_bolsa_precos").select("acao_id, dia, abertura, preco").gte("dia", somarDias(dia, -DIAS_DO_PLACAR)).lte("dia", dia).order("dia").order("acao_id")),
  ]);
  falhou(acoesR.error, "ações");
  const empresas = new Map((acoesR.data || []).map((a) => [a.id, a]));
  const porDia = new Map();
  for (const l of linhas) {
    const a = empresas.get(l.acao_id);
    // a estreia não tem o que projetar: a empresa abre e fecha no preço de lançamento
    if (!a || a.criada_em === l.dia || l.abertura == null) continue;
    if (!porDia.has(l.dia)) porDia.set(l.dia, []);
    porDia.get(l.dia).push({ id: a.id, nome: a.nome, setor: a.setor, emoji: a.emoji, abertura: Number(l.abertura), fechamento: Number(l.preco) });
  }
  const relatorio = relatorioDaMesa({ hoje: dia, revelado: hora >= FECHA_AS, dias: [...porDia].map(([d, acoes]) => ({ dia: d, acoes })) });
  return { ...relatorio, hora, abrindo: Boolean(pregao.abrindo), fechaAs: FECHA_AS };
}

// ---------------------------------------------------------------- comprar e vender

async function acaoParaNegociar(id, horaPedida) {
  // no mundo de verdade, só no horário do pregão; no Reino de Teste, a qualquer hora (e na simulada)
  const hora = emTeste() && horaValida(horaPedida) ? horaPedida : horaAgora();
  if (!emTeste() && !pregaoAberto(hora)) throw new ErroDeAcesso(400, FECHADO);
  const pregao = await pregaoDeHoje();
  if (pregao.abrindo) throw new ErroDeAcesso(409, "a Lisa está abrindo o pregão de hoje — tente de novo em alguns segundos");
  const { data, error } = await db.from("proof_bolsa_acoes").select(CAMPOS_DA_ACAO).eq("id", String(id || "").toUpperCase()).maybeSingle();
  falhou(error, "ação");
  if (!data) return null;
  // o preço desta hora (com centavos); sem pregão hoje para ela, o fechamento guardado
  const { data: hoje } = await db.from("proof_bolsa_precos").select("acao_id, dia, abertura, preco").eq("acao_id", data.id).eq("dia", diaDe()).maybeSingle();
  return { ...data, preco: hoje ? precoNaHora(caminhoDa(hoje), hora) : data.preco };
}

async function posicaoDe(usuarioId, acaoId) {
  const { data, error } = await db.from("proof_bolsa_posicoes").select("quantidade, custo").eq("usuario_id", usuarioId).eq("acao_id", acaoId).maybeSingle();
  falhou(error, "carteira");
  return data ? { quantidade: data.quantidade, custo: Number(data.custo) || 0 } : null;
}

/** Grava a posição só se ela ainda for a que eu li (ou cria, se eu não tinha). Devolve se gravou. */
async function gravarPosicao(usuarioId, acaoId, antes, depois) {
  if (!antes) {
    const { error } = await db.from("proof_bolsa_posicoes").insert({ usuario_id: usuarioId, acao_id: acaoId, ...depois });
    if (error?.code === "23505") return false;
    falhou(error, "carteira");
    return true;
  }
  const { data, error } = await db.from("proof_bolsa_posicoes").update(depois)
    .eq("usuario_id", usuarioId).eq("acao_id", acaoId).eq("quantidade", antes.quantidade).eq("custo", antes.custo).select("usuario_id");
  falhou(error, "carteira");
  return (data || []).length === 1;
}

const corrida = () => new ErroDeAcesso(409, "a carteira mudou enquanto você negociava — tente de novo");

export async function comprarAcao(usuarioId, id, quantidade, { hora } = {}) {
  const acao = await acaoParaNegociar(id, hora);
  const reino = await obterReino(usuarioId);
  const [saldo, antes] = await Promise.all([saldoDoUsuario(usuarioId), acao ? posicaoDe(usuarioId, acao.id) : null]);
  const pode = podeComprarAcao({ acao, quantidade: Number(quantidade), saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  // paga (a versão do reino trava o saldo, como em toda compra do reino)
  const { data: lanc, error } = await db.from("proof_reino_movimentos")
    .insert({ usuario_id: usuarioId, tipo: "bolsa_compra", valor: -pode.total, detalhe: { acao: acao.id, quantidade: pode.quantidade, preco: acao.preco, taxa: pode.taxa } }).select("id").single();
  falhou(error, "livro-caixa");
  const desfazer = () => db.from("proof_reino_movimentos").delete().eq("id", lanc.id);
  const { data: gravou } = await db.from("proof_reinos").update({ versao: reino.versao + 1, atualizado_em: new Date().toISOString() })
    .eq("usuario_id", usuarioId).eq("versao", reino.versao).select("usuario_id");
  if (!(gravou || []).length) { await desfazer(); throw new ErroDeAcesso(409, "o reino mudou enquanto você mexia — tente de novo"); }
  const depois = posicaoDepois(antes, { tipo: "compra", quantidade: pode.quantidade, total: pode.total });
  if (!(await gravarPosicao(usuarioId, acao.id, antes, depois))) { await desfazer(); throw corrida(); }
  await db.from("proof_bolsa_ordens").insert({ usuario_id: usuarioId, acao_id: acao.id, tipo: "compra", quantidade: pode.quantidade, preco: acao.preco, taxa: pode.taxa, total: pode.total });
  return { acao: acao.id, nome: acao.nome, quantidade: pode.quantidade, preco: acao.preco, taxa: pode.taxa, total: pode.total };
}

export async function venderAcao(usuarioId, id, quantidade, { hora } = {}) {
  const acao = await acaoParaNegociar(id, hora);
  const antes = acao ? await posicaoDe(usuarioId, acao.id) : null;
  const pode = podeVenderAcao({ acao, posicao: antes, quantidade: Number(quantidade) });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  // tira as ações primeiro (só se a posição ainda for a que eu li); depois paga
  const depois = posicaoDepois(antes, { tipo: "venda", quantidade: pode.quantidade });
  if (!(await gravarPosicao(usuarioId, acao.id, antes, depois))) throw corrida();
  const { error } = await db.from("proof_reino_movimentos")
    .insert({ usuario_id: usuarioId, tipo: "bolsa_venda", valor: pode.total, detalhe: { acao: acao.id, quantidade: pode.quantidade, preco: acao.preco, taxa: pode.taxa } });
  if (error) {
    await gravarPosicao(usuarioId, acao.id, depois, antes); // devolve as ações
    falhou(error, "livro-caixa");
  }
  await db.from("proof_bolsa_ordens").insert({ usuario_id: usuarioId, acao_id: acao.id, tipo: "venda", quantidade: pode.quantidade, preco: acao.preco, taxa: pode.taxa, total: pode.total });
  const lucro = centavos(pode.total - (antes.custo - depois.custo));
  return { acao: acao.id, nome: acao.nome, quantidade: pode.quantidade, preco: acao.preco, taxa: pode.taxa, total: pode.total, lucro };
}

/**
 * Reino de Teste: pede à Lisa o pregão de AMANHÃ com as ações de agora e devolve SEM aplicar (nada
 * muda para ninguém) — para ver as notícias, as variações e as empresas novas que ela inventaria.
 */
export async function previaDoPregao() {
  if (!emTeste()) throw new ErroDeAcesso(403, "a prévia do pregão é uma ferramenta do Reino de Teste");
  return noMundo("real", montarPrevia); // o mercado e o que aconteceu ontem são do mundo de verdade
}

async function montarPrevia() {
  const dia = somarDias(diaDe(), 1);
  const ativas = await acoesAtivas();
  const { data: todas } = await db.from("proof_bolsa_acoes").select("id");
  const existentes = (todas || []).map((a) => a.id);
  const novas = ativas.length ? NOVAS_POR_DIA : ACOES_DO_PRIMEIRO_DIA;
  let pregao, geradoPor = "lisa";
  try {
    if (!temModelo()) throw new Error("sem IA configurada");
    const historico = await historicoDe(ativas.map((a) => a.id), somarDias(dia, -6));
    pregao = validarPregao(await pedirPregaoALisa({ dia, ativas, historico, novas, acontecimentos: await acontecimentosDe(dia) }), ativas, { novas, existentes });
  } catch {
    pregao = pregaoDeReserva(dia, ativas, { novas, existentes });
    geradoPor = "reserva";
  }
  return {
    dia, geradoPor, manchete: pregao.manchete,
    movimentos: pregao.movimentos.map((m) => { const a = ativas.find((x) => x.id === m.acao); return { ...m, nome: a?.nome, de: a?.preco, para: a ? precoDepois(a.preco, m.variacao) : null }; }),
    novas: pregao.novas,
  };
}
