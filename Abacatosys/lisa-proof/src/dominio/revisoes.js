// A REVISÃO DA TURMA (pedido de 31/10/2026, o que tinha ficado para depois na proposta dos cursos que
// não são de programação). A IA não julga bem tudo: o sabor do prato, a postura ao vivo, uma foto que
// não mostrou o detalhe. Depois da avaliação da Lisa, quem entregou um desafio aberto ou um projeto
// por evidências pode CONTESTAR os critérios que ela deu como não cumpridos, explicando por quê. O
// pedido vai, sem o nome de ninguém, para a fila da turma; uma pessoa revisa, critério a critério.
//
//   - O que a turma confirma passa a valer como cumprido: a nota e os pontos sobem (nunca descem).
//   - Quem revisa ganha pontos (que viram moedas no Reino, como os do bibliotecário do acervo), com
//     um teto por dia — revisar com pressa para farmar não compensa.
//   - Ninguém revisa o próprio pedido, nem o mesmo colega duas vezes na mesma semana.
//   - A turma vê o que já fica guardado do desafio: o texto, o link do vídeo e as miniaturas das
//     fotos. O áudio não é guardado (LGPD), então critério que só o áudio mostra não dá para revisar.
//
// Puro: sem banco, sem rede.

import { NOTA_DE_APROVACAO, ehProjeto, tabelaDePontos, pontosDoProjeto, juntarCumpridos, pontosDaNota, comFatorDaRodada } from "./pratica.js";
import { MULTIPLICADOR_DE_RECOMPENSAS } from "./pontos.js";

export const VEREDITOS = {
  cumpriu: "Cumpriu",
  nao_cumpriu: "Não cumpriu",
  nao_da: "Não dá para julgar",
};
export const PONTOS_DA_REVISAO = 5 * MULTIPLICADOR_DE_RECOMPENSAS;
export const REVISOES_PAGAS_POR_DIA = 5;
export const DIAS_NA_FILA = 14;
export const LIMITES_DA_REVISAO_DA_TURMA = { justificativa: 400, comentario: 600, minimoJustificativa: 10, minimoComentario: 15 };

const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Os critérios do desafio (o desafio aberto tem `criterios`; o projeto, `requisitos`). */
export function criteriosDoDesafio(d) {
  if (ehProjeto(d?.tipo)) return (d?.conteudo?.requisitos || []).map(String);
  return (d?.conteudo?.criterios || []).map(String);
}

/** O que a IA deu como cumprido, por posição do critério. */
export function atendidosPelaIA(d) {
  const n = criteriosDoDesafio(d).length;
  if (ehProjeto(d?.tipo) && d?.resposta?.cumpridos) return [...new Set(d.resposta.cumpridos.requisitos || [])].filter((i) => i < n);
  const ok = new Set();
  (d?.avaliacao?.requisitos || []).forEach((r, i) => {
    if (!r?.atendido) return;
    const k = Number.isInteger(r.numero) && r.numero >= 1 ? r.numero - 1 : i;
    if (k < n) ok.add(k);
  });
  return [...ok].sort((a, b) => a - b);
}

/**
 * Pode pedir a revisão da turma? Só desafio aberto ou projeto por evidências, já avaliado, com
 * algum critério não cumprido — e um pedido por desafio.
 */
export function podePedirRevisao(d, { jaPediu = false } = {}) {
  const porEvidencia = ehProjeto(d?.tipo) ? Array.isArray(d?.conteudo?.evidencias) : d?.tipo === "exercicio" && d?.conteudo?.motor === "aberto";
  if (!porEvidencia) return { ok: false, motivo: "só o desafio aberto e os projetos entregues por texto, fotos, áudio ou vídeo vão para a turma" };
  if (!(d.tentativas > 0) || !d.avaliacao) return { ok: false, motivo: "mande a sua entrega para a Lisa avaliar primeiro" };
  if (jaPediu) return { ok: false, motivo: "este desafio já foi para a revisão da turma" };
  const criterios = criteriosDoDesafio(d);
  if (atendidosPelaIA(d).length >= criterios.length) return { ok: false, motivo: "a Lisa já deu todos os critérios como cumpridos" };
  return { ok: true };
}

/**
 * O pedido conferido: os critérios contestados (só os que a IA deu como não cumpridos), cada um com
 * a justificativa. `contestados`: [{ indice, justificativa }].
 */
export function validarPedido(d, contestados, consentiu) {
  if (!consentiu) throw new Error("confirme que a sua entrega pode aparecer, sem o seu nome, para um colega revisar");
  const criterios = criteriosDoDesafio(d);
  const ok = new Set(atendidosPelaIA(d));
  const vistos = new Set();
  const lista = [];
  for (const c of Array.isArray(contestados) ? contestados : []) {
    const indice = Number(c?.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= criterios.length || ok.has(indice) || vistos.has(indice)) continue;
    const justificativa = texto(c?.justificativa, LIMITES_DA_REVISAO_DA_TURMA.justificativa);
    if (justificativa.length < LIMITES_DA_REVISAO_DA_TURMA.minimoJustificativa) throw new Error(`explique por que você cumpriu "${criterios[indice].slice(0, 60)}"`);
    vistos.add(indice);
    lista.push({ indice, justificativa });
  }
  if (!lista.length) throw new Error("escolha pelo menos um critério que a Lisa deu como não cumprido");
  return lista.sort((a, b) => a.indice - b.indice);
}

/**
 * O veredito de quem revisa, conferido: um por critério contestado, e um comentário para o colega.
 * `vereditos`: [{ indice, veredito, observacao }].
 */
export function validarVeredito(contestados, vereditos, comentario) {
  const porIndice = new Map((Array.isArray(vereditos) ? vereditos : []).map((v) => [Number(v?.indice), v]));
  const lista = contestados.map((c) => {
    const v = porIndice.get(c.indice);
    if (!v || !VEREDITOS[v.veredito]) throw new Error("dê um veredito para cada critério contestado");
    return { indice: c.indice, veredito: v.veredito, observacao: texto(v.observacao, 300) };
  });
  const c = texto(comentario, LIMITES_DA_REVISAO_DA_TURMA.comentario);
  if (c.length < LIMITES_DA_REVISAO_DA_TURMA.minimoComentario) throw new Error("deixe um comentário para o colega (o que está bom, o que melhorar)");
  return { vereditos: lista, comentario: c };
}

/**
 * Quem pode revisar este pedido? Não o autor; não quem já revisou este mesmo colega nos últimos 7
 * dias (`revisadosNaSemana`: os autores que eu revisei na semana); não um pedido fechado ou vencido.
 */
export function podeRevisar({ usuarioId, pedido, revisadosNaSemana = [], agora = Date.now() }) {
  if (pedido.autor_id === usuarioId) return { ok: false, motivo: "este pedido é seu — outra pessoa da turma revisa" };
  if (pedido.status !== "aberta") return { ok: false, motivo: "este pedido já foi revisado" };
  if (agora - new Date(pedido.criado_em).getTime() > DIAS_NA_FILA * 86_400_000) return { ok: false, motivo: "este pedido venceu" };
  if (revisadosNaSemana.includes(pedido.autor_id)) return { ok: false, motivo: "você já revisou este colega nesta semana — deixe para outra pessoa" };
  return { ok: true };
}

/**
 * O desafio depois da revisão da turma: os critérios confirmados passam a valer. A nota e os pontos
 * só sobem. Devolve { avaliacao, nota, pontos, resposta, concluido, confirmados }.
 *   - desafio aberto: a nota vira a maior entre a da Lisa e a fração dos critérios cumpridos;
 *   - projeto: os requisitos confirmados entram nos cumpridos e os pontos somam a parte deles.
 */
export function aplicarRevisao(d, vereditos) {
  const confirmados = vereditos.filter((v) => v.veredito === "cumpriu").map((v) => v.indice);
  const criterios = criteriosDoDesafio(d);
  const avaliacao = {
    ...d.avaliacao,
    requisitos: criterios.map((rotulo, i) => {
      const antes = (d.avaliacao?.requisitos || []).find((r, k) => (Number.isInteger(r?.numero) ? r.numero - 1 : k) === i) || { numero: i + 1, requisito: rotulo, atendido: false, observacao: "" };
      const v = vereditos.find((x) => x.indice === i);
      if (!v || v.veredito !== "cumpriu" || antes.atendido) return antes;
      return { ...antes, numero: i + 1, atendido: true, observacao: `Confirmado pela turma${v.observacao ? `: ${v.observacao}` : "."}`, turma: true };
    }),
  };
  const atendidos = new Set([...atendidosPelaIA(d), ...confirmados]);

  if (ehProjeto(d.tipo)) {
    const tabela = tabelaDePontos(d.tipo, d.conteudo);
    const antes = d.resposta?.cumpridos || { requisitos: atendidosPelaIA(d), extras: [] };
    const cumpridos = juntarCumpridos(antes, { requisitos: confirmados, extras: [] });
    const pontos = Math.max(d.pontos || 0, pontosDoProjeto(tabela, cumpridos));
    const nota = Math.max(d.nota ?? 0, Math.round((cumpridos.requisitos.length / Math.max(1, tabela.requisitos.length)) * 100));
    const concluido = d.status === "concluido" || cumpridos.requisitos.length >= tabela.requisitos.length;
    return { avaliacao: { ...avaliacao, nota, aprovado: nota >= NOTA_DE_APROVACAO }, nota, pontos, resposta: { ...d.resposta, cumpridos }, concluido, confirmados };
  }
  const nota = Math.max(d.nota ?? 0, Math.round((atendidos.size / Math.max(1, criterios.length)) * 100));
  const pontos = Math.max(d.pontos || 0, comFatorDaRodada(pontosDaNota(d.tipo, nota), d.rodada));
  const concluido = d.status === "concluido" || nota >= NOTA_DE_APROVACAO;
  return { avaliacao: { ...avaliacao, nota, aprovado: nota >= NOTA_DE_APROVACAO }, nota, pontos, resposta: d.resposta, concluido, confirmados };
}

/** O pedido como a fila mostra a quem revisa: sem ninguém identificado. */
export function pedidoParaRevisor(p) {
  return {
    id: p.id, perfil: p.perfil, tema: p.tema, titulo: p.titulo, enunciado: p.enunciado, tipo: p.tipo,
    criterios: p.criterios, contestados: p.contestados, entrega: p.entrega, criadoEm: p.criado_em,
  };
}
