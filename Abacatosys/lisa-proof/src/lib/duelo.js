// O Duelo de Lógica no banco (03/11/2026). As regras moram em src/dominio/duelo.js; a tabela é proof_duelos
// (db/029). Começar: confere, cobra a aposta e grava as perguntas (com o gabarito e as respostas da Lisa, que só
// o servidor vê). Responder: corrige, encerra (uma vez só: status 'aberto' → 'encerrado') e paga quem ganhou.
// Duelo aberto que passou do prazo encerra sozinho como derrota (sem respostas), na próxima leitura.

import { supabase } from "./supabase.js";
import { ErroDeAcesso, contaParaEspiar } from "./sessao.js";
import { creditarMoedas, gastarMoedas, saldoDoUsuario } from "./reino.js";
import { noMundo } from "./mundo.js";
import { diaDe } from "@/dominio/datas.js";
import { sorteio } from "@/dominio/bolsa.js";
import { sementeDe } from "@/dominio/modoDominio.js";
import {
  DUELO, montarDuelo, respostasDaLisa, perguntaParaTela, corrigir, resultadoDoDuelo, movimentosDoDuelo, podeDuelar, segundosDoDuelo, perguntaPorId,
} from "@/dominio/duelo.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const CAMPOS = "id, adversario_id, dia, aposta, perguntas, respostas, acertos, acertos_da_lisa, resultado, status, criado_em, expira_em, encerrado_em";
const saldoReal = (id) => noMundo("real", () => saldoDoUsuario(id));

async function lisa() {
  const conta = await contaParaEspiar();
  if (!conta) throw new ErroDeAcesso(404, "a Lisa ainda não está jogando");
  return conta;
}

function paraTela(d, comGabarito = false) {
  const ids = d.perguntas?.ids || [];
  const base = {
    id: d.id, dia: d.dia, aposta: d.aposta, status: d.status, criadoEm: d.criado_em, expiraEm: d.expira_em,
    perguntas: ids.map(perguntaParaTela),
  };
  if (!comGabarito) return base;
  const correcao = corrigir(ids, d.respostas || []);
  return {
    ...base, resultado: d.resultado, acertos: d.acertos, acertosDaLisa: d.acertos_da_lisa,
    movimento: d.resultado ? movimentosDoDuelo(d.resultado, d.aposta).jogador - d.aposta : 0,
    correcao: correcao.detalhe.map((x, i) => ({ ...x, lisa: d.perguntas.lisa?.[i] ?? null, opcoes: perguntaPorId(x.id).opcoes })),
  };
}

/**
 * Encerra o duelo (uma vez só) com as respostas dadas e paga: a pessoa recebe o que o resultado manda, e o
 * reino da Lisa paga ou recebe a aposta. Se outra aba encerrou antes, devolve o que ficou gravado.
 */
async function encerrar(usuarioId, d, respostas) {
  const ids = d.perguntas.ids;
  const { acertos } = corrigir(ids, respostas);
  const resultado = resultadoDoDuelo(acertos, d.acertos_da_lisa);
  const { data: fechado, error } = await supabase.from("proof_duelos")
    .update({ status: "encerrado", respostas, acertos, resultado, encerrado_em: new Date().toISOString() })
    .eq("id", d.id).eq("status", "aberto").select(CAMPOS);
  falhou(error, "duelo");
  if (!fechado?.length) {
    const { data } = await supabase.from("proof_duelos").select(CAMPOS).eq("id", d.id).single();
    return data;
  }
  const mov = movimentosDoDuelo(resultado, d.aposta);
  if (mov.jogador > 0) await creditarMoedas(usuarioId, "duelo", mov.jogador, { duelo: d.id, resultado });
  if (mov.lisa && d.adversario_id) await creditarMoedas(d.adversario_id, "duelo", mov.lisa, { duelo: d.id, resultado, contra: usuarioId });
  return fechado[0];
}

/** Os duelos da pessoa: o aberto (se houver), os de hoje e o placar geral contra a Lisa. */
export async function duelosDe(usuarioId) {
  const conta = await lisa();
  const hoje = diaDe();
  const { data, error } = await supabase.from("proof_duelos").select(CAMPOS).eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(60);
  falhou(error, "duelos");
  const lista = data || [];
  // o que passou do prazo encerra agora, como derrota (sem respostas)
  for (const [i, d] of lista.entries()) {
    if (d.status === "aberto" && new Date(d.expira_em).getTime() < Date.now()) lista[i] = await encerrar(usuarioId, d, []);
  }
  const aberto = lista.find((d) => d.status === "aberto") || null;
  const deHoje = lista.filter((d) => d.dia === hoje);
  const [saldo, saldoDaLisa] = await Promise.all([saldoReal(usuarioId), saldoReal(conta.id)]);
  const placar = { venceu: 0, perdeu: 0, empate: 0 };
  for (const d of lista) if (d.resultado) placar[d.resultado]++;
  return {
    regras: { perguntas: DUELO.perguntas, segundosPorPergunta: DUELO.segundosPorPergunta, apostas: DUELO.apostas, porDia: DUELO.porDia },
    souALisa: conta.id === usuarioId,
    saldo, saldoDaLisa,
    feitosHoje: deHoje.length,
    aberto: aberto ? paraTela(aberto) : null,
    placar,
    recentes: lista.filter((d) => d.status === "encerrado").slice(0, 8).map((d) => paraTela(d, true)),
    apostas: DUELO.apostas.map((aposta) => {
      const pode = conta.id === usuarioId
        ? { ok: false, motivo: "a Lisa não duela com ela mesma" }
        : podeDuelar({ aposta, saldo, saldoDaLisa, feitosHoje: deHoje.length, temAberto: Boolean(aberto) });
      return { aposta, pode: pode.ok, motivo: pode.ok ? "" : pode.motivo };
    }),
  };
}

/** Começa um duelo: cobra a aposta e sorteia as perguntas e as respostas da Lisa. */
export async function comecarDuelo(usuarioId, aposta) {
  const conta = await lisa();
  if (conta.id === usuarioId) throw new ErroDeAcesso(400, "a Lisa não duela com ela mesma");
  const estado = await duelosDe(usuarioId);
  const pode = podeDuelar({ aposta: Number(aposta), saldo: estado.saldo, saldoDaLisa: estado.saldoDaLisa, feitosHoje: estado.feitosHoje, temAberto: Boolean(estado.aberto) });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const s = sorteio(sementeDe(`duelo:${usuarioId}:${Date.now()}:${Math.random()}`));
  const ids = montarDuelo(s);
  const daLisa = respostasDaLisa(ids, s);
  const { acertos: acertosDaLisa } = corrigir(ids, daLisa);
  const agora = new Date();
  // grava antes de cobrar: o índice só deixa um duelo aberto (dois cliques não cobram duas vezes)
  const { data: novo, error } = await supabase.from("proof_duelos").insert({
    usuario_id: usuarioId, adversario_id: conta.id, dia: diaDe(), aposta: Number(aposta),
    perguntas: { ids, lisa: daLisa }, acertos_da_lisa: acertosDaLisa,
    expira_em: new Date(agora.getTime() + segundosDoDuelo() * 1000).toISOString(),
  }).select(CAMPOS).single();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "termine o duelo que já está aberto");
  falhou(error, "duelo");
  try {
    await gastarMoedas(usuarioId, "duelo", Number(aposta), { duelo: novo.id, aposta: true });
  } catch (e) {
    await supabase.from("proof_duelos").delete().eq("id", novo.id);
    throw e;
  }
  return { duelo: paraTela(novo) };
}

/** Entrega as respostas (uma por pergunta, o índice da opção; null = sem resposta) e encerra o duelo. */
export async function responderDuelo(usuarioId, id, respostas) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ErroDeAcesso(404, "duelo não encontrado");
  const { data: d, error } = await supabase.from("proof_duelos").select(CAMPOS).eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "duelo");
  if (!d) throw new ErroDeAcesso(404, "duelo não encontrado");
  if (d.status !== "aberto") return { duelo: paraTela(d, true) };
  // passou do prazo (com a folga da rede): vale como se não tivesse respondido
  const noPrazo = new Date(d.expira_em).getTime() >= Date.now();
  const lista = Array.isArray(respostas) ? respostas.slice(0, d.perguntas.ids.length).map((r) => (Number.isInteger(r) ? r : null)) : [];
  const fechado = await encerrar(usuarioId, d, noPrazo ? lista : []);
  return { duelo: paraTela(fechado, true), foraDoPrazo: !noPrazo };
}
