// A revisão da turma no banco (31/10/2026): pedir (quem entregou contesta critérios), a fila (sem o
// nome de ninguém), revisar (um colega dá o veredito) e o que muda no desafio de quem pediu. As regras
// moram em src/dominio/revisoes.js; a migração é db/023-cartoes-turma-e-torres-de-tema.sql.
//
// O dinheiro segue a ordem de sempre: o pedido muda primeiro ("aberta" → "revisada": só uma revisão
// pega o pedido), os pontos entram depois. Quem pediu recebe pela regra do "só sobe"
// (registrarOuMelhorar); quem revisou, pela chave do pedido (uma vez só), até o teto do dia.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { registrarEvento, registrarOuMelhorar, estudouHoje, depoisDePontuar, resultadoDaPontuacao, trilhaDoUsuario } from "./estudo.js";
import { desafioDoUsuario } from "./pratica.js";
import { diaDe } from "@/dominio/datas.js";
import { perfilValido } from "@/dominio/perfis.js";
import {
  podePedirRevisao, validarPedido, validarVeredito, podeRevisar, aplicarRevisao, criteriosDoDesafio, atendidosPelaIA, pedidoParaRevisor,
  PONTOS_DA_REVISAO, REVISOES_PAGAS_POR_DIA, DIAS_NA_FILA,
} from "@/dominio/revisoes.js";

const CAMPOS = "id, desafio_id, autor_id, revisor_id, perfil, tema, tipo, titulo, enunciado, criterios, contestados, entrega, status, vereditos, comentario, confirmados, criado_em, revisado_em";
const DESAFIO = "id, usuario_id, trilha_id, tipo, periodo, rodada, titulo, conteudo, status, resposta, avaliacao, nota, pontos, tentativas";
const SEMANA_MS = 7 * 86_400_000;

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}
const ehId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
const inicioDeHoje = () => new Date(`${diaDe()}T00:00:00-03:00`).toISOString();
const venceuEm = () => new Date(Date.now() - DIAS_NA_FILA * 86_400_000).toISOString();

/** O pedido como quem pediu vê: o que contestou e, revisado, o veredito (sem o nome de quem revisou). */
function pedidoParaAutor(p) {
  const vencido = p.status === "aberta" && new Date(p.criado_em).getTime() < Date.now() - DIAS_NA_FILA * 86_400_000;
  return {
    id: p.id, desafioId: p.desafio_id, titulo: p.titulo, tema: p.tema, tipo: p.tipo, status: vencido ? "vencida" : p.status,
    criterios: p.criterios, contestados: p.contestados, vereditos: p.vereditos, comentario: p.comentario,
    confirmados: p.confirmados, criadoEm: p.criado_em, revisadoEm: p.revisado_em,
  };
}

/** O pedido de revisão de um desafio meu (ou null), e se dá para pedir. */
export async function revisaoDoDesafio(usuarioId, desafioId) {
  const d = await desafioDoUsuario(desafioId, usuarioId);
  const { data, error } = await supabase.from("proof_revisoes").select(CAMPOS).eq("desafio_id", d.id).maybeSingle();
  falhou(error, "revisão");
  const pode = podePedirRevisao(d, { jaPediu: Boolean(data) });
  return {
    pedido: data ? pedidoParaAutor(data) : null,
    pode: pode.ok, motivo: pode.motivo || "",
    criterios: criteriosDoDesafio(d),
    atendidos: atendidosPelaIA(d),
    observacoes: criteriosDoDesafio(d).map((_, i) => (d.avaliacao?.requisitos || []).find((r, k) => (Number.isInteger(r?.numero) ? r.numero - 1 : k) === i)?.observacao || ""),
  };
}

/** Pedir a revisão da turma: os critérios contestados, cada um com a justificativa. */
export async function pedirRevisao(usuarioId, desafioId, { contestados, consentiu }) {
  const d = await desafioDoUsuario(desafioId, usuarioId);
  const { data: existe } = await supabase.from("proof_revisoes").select("id").eq("desafio_id", d.id).maybeSingle();
  const pode = podePedirRevisao(d, { jaPediu: Boolean(existe) });
  if (!pode.ok) throw new ErroDeAcesso(409, pode.motivo);
  let lista;
  try { lista = validarPedido(d, contestados, consentiu); } catch (e) { throw new ErroDeAcesso(400, e.message); }
  const trilha = await trilhaDoUsuario(d.trilha_id, usuarioId);
  const atendidos = new Set(atendidosPelaIA(d));
  const avaliados = d.avaliacao?.requisitos || [];
  const criterios = criteriosDoDesafio(d).map((texto, i) => ({
    texto, atendido: atendidos.has(i),
    observacao: avaliados.find((r, k) => (Number.isInteger(r?.numero) ? r.numero - 1 : k) === i)?.observacao || "",
  }));
  const r = d.resposta || {};
  const { data, error } = await supabase.from("proof_revisoes").insert({
    desafio_id: d.id, autor_id: usuarioId, perfil: perfilValido(trilha.perfil), tema: trilha.tema, tipo: d.tipo,
    titulo: String(d.titulo || "").slice(0, 200),
    enunciado: String(d.conteudo?.enunciado || d.conteudo?.contexto || "").slice(0, 1500),
    criterios, contestados: lista,
    // só o que já fica guardado no desafio: nenhuma foto inteira, nenhum áudio
    entrega: { texto: r.texto || "", video: r.video || null, miniaturas: r.miniaturas || [], audio: r.audio || null, pdf: r.pdf || null },
  }).select(CAMPOS).single();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "este desafio já foi para a revisão da turma");
  falhou(error, "revisão");
  return pedidoParaAutor(data);
}

/** A fila: os pedidos abertos dos outros (os mais antigos primeiro), e os meus pedidos. */
export async function filaDaTurma(usuarioId) {
  const [abertos, meus, minhas] = await Promise.all([
    supabase.from("proof_revisoes").select(CAMPOS).eq("status", "aberta").neq("autor_id", usuarioId)
      .gte("criado_em", venceuEm()).order("criado_em").limit(30),
    supabase.from("proof_revisoes").select(CAMPOS).eq("autor_id", usuarioId).order("criado_em", { ascending: false }).limit(20),
    supabase.from("proof_revisoes").select("autor_id, revisado_em").eq("revisor_id", usuarioId)
      .gte("revisado_em", new Date(Date.now() - SEMANA_MS).toISOString()),
  ]);
  falhou(abertos.error, "fila");
  falhou(meus.error, "pedidos");
  falhou(minhas.error, "revisões");
  const naSemana = new Set((minhas.data || []).map((x) => x.autor_id));
  const hoje = inicioDeHoje();
  const pagasHoje = (minhas.data || []).filter((x) => x.revisado_em >= hoje).length;
  return {
    fila: (abertos.data || []).filter((p) => !naSemana.has(p.autor_id)).map(pedidoParaRevisor),
    meus: (meus.data || []).map(pedidoParaAutor),
    revisadasHoje: pagasHoje,
    pagasPorDia: REVISOES_PAGAS_POR_DIA,
    pontosPorRevisao: PONTOS_DA_REVISAO,
  };
}

/**
 * Revisar um pedido: o veredito de cada critério contestado e um comentário. O pedido fecha primeiro
 * (a trava: só quem o encontra "aberta" grava); depois o desafio de quem pediu sobe o que a turma
 * confirmou, e quem revisou ganha os pontos (até o teto do dia).
 */
export async function revisarPedido(usuarioId, id, { vereditos, comentario }) {
  if (!ehId(id)) throw new ErroDeAcesso(404, "pedido não encontrado");
  const { data: p, error } = await supabase.from("proof_revisoes").select(CAMPOS).eq("id", id).maybeSingle();
  falhou(error, "pedido");
  if (!p) throw new ErroDeAcesso(404, "pedido não encontrado");
  const { data: minhas, error: e1 } = await supabase.from("proof_revisoes").select("autor_id, revisado_em").eq("revisor_id", usuarioId)
    .gte("revisado_em", new Date(Date.now() - SEMANA_MS).toISOString());
  falhou(e1, "revisões");
  const pode = podeRevisar({ usuarioId, pedido: p, revisadosNaSemana: (minhas || []).map((x) => x.autor_id) });
  if (!pode.ok) throw new ErroDeAcesso(409, pode.motivo);
  let veredito;
  try { veredito = validarVeredito(p.contestados, vereditos, comentario); } catch (e) { throw new ErroDeAcesso(400, e.message); }
  const confirmados = veredito.vereditos.filter((v) => v.veredito === "cumpriu").length;

  const agora = new Date().toISOString();
  const { data: fechou, error: e2 } = await supabase.from("proof_revisoes").update({
    status: "revisada", revisor_id: usuarioId, vereditos: veredito.vereditos, comentario: veredito.comentario, confirmados, revisado_em: agora,
  }).eq("id", id).eq("status", "aberta").select("id");
  falhou(e2, "revisão");
  if (!fechou?.length) throw new ErroDeAcesso(409, "outra pessoa revisou este pedido agora mesmo");

  // o desafio de quem pediu: o que a turma confirmou passa a valer (a nota e os pontos só sobem)
  if (confirmados > 0) await aplicarNoDesafio(p, veredito.vereditos);

  // quem revisou: pontos (= moedas) até o teto do dia
  const pagasHoje = (minhas || []).filter((x) => x.revisado_em >= inicioDeHoje()).length;
  let resultado = { pontos: 0 };
  if (pagasHoje < REVISOES_PAGAS_POR_DIA) {
    const estudavaAntes = await estudouHoje(usuarioId);
    const ganhou = await registrarEvento({
      usuarioId, trilhaId: null, tipo: "revisao", chave: `revisao:${id}`, pontos: PONTOS_DA_REVISAO,
      detalhe: { titulo: `Revisão da turma: ${p.titulo}`.slice(0, 200) },
    });
    if (ganhou > 0) resultado = resultadoDaPontuacao(ganhou, await depoisDePontuar({ usuarioId, trilhaId: null, estudavaAntes, ganhou }));
  }
  return { confirmados, contestados: p.contestados.length, pagou: resultado.pontos > 0, ...resultado };
}

/** Grava no desafio de quem pediu o que a turma confirmou, e sobe os pontos dele. */
async function aplicarNoDesafio(p, vereditos) {
  const { data: d, error } = await supabase.from("proof_desafios").select(DESAFIO).eq("id", p.desafio_id).maybeSingle();
  falhou(error, "desafio");
  if (!d) return; // o desafio foi apagado (a trilha saiu): nada a subir
  const depois = aplicarRevisao(d, vereditos);
  const { error: e2 } = await supabase.from("proof_desafios").update({
    avaliacao: depois.avaliacao, nota: depois.nota, pontos: depois.pontos, resposta: depois.resposta,
    status: depois.concluido ? "concluido" : d.status, atualizado_em: new Date().toISOString(),
  }).eq("id", d.id);
  falhou(e2, "desafio");
  await registrarOuMelhorar({
    usuarioId: d.usuario_id, trilhaId: d.trilha_id, tipo: d.tipo, chave: `pratica:${d.id}`, pontos: depois.pontos,
    detalhe: { titulo: d.titulo, nota: depois.nota, turma: true },
  });
}
