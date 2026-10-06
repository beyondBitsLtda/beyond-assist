// Cria o quadro STUDY no Abacato a partir da proposta aprovada, e já monta a trilha dele.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { validarCurso, assuntosEmOrdem } from "@/dominio/curso.js";
import { montarEtapas, normalizarDiasDeEstudo } from "@/dominio/plano.js";
import { diaDe, diaValido } from "@/dominio/datas.js";
import { temaDo } from "@/dominio/estudo.js";

/**
 * O limite de quadros do Abacato, espelhado.
 *
 * ESPELHO de abacato/src/dominio/planos.js (PLANOS.cliente.quadros e RECADOS.quadros): criar
 * quadro pela Lisa_Proof não pode virar um atalho para passar do limite que o Abacato impõe.
 * Se o número mudar lá, mude aqui. Conta "interno" não tem teto; qualquer outro tipo cai no
 * mais restrito, como lá.
 */
const QUADROS_DO_CLIENTE = 10;

async function exigirPodeCriarQuadro(usuarioId) {
  const { data: conta } = await supabase
    .from("abacato_usuarios").select("tipo, ativo, aprovado").eq("id", usuarioId).maybeSingle();
  if (!conta || !conta.ativo || conta.aprovado === false) throw new ErroDeAcesso(403, "conta sem permissão para criar quadros");
  if (conta.tipo === "interno") return;
  const { count } = await supabase
    .from("abacato_quadros").select("id", { count: "exact", head: true }).eq("dono_id", usuarioId).eq("arquivado", false);
  if ((count || 0) >= QUADROS_DO_CLIENTE) {
    throw new ErroDeAcesso(403,
      `Você chegou ao limite de ${QUADROS_DO_CLIENTE} quadros da sua conta. Arquive um que não usa mais, ou peça mais espaço a quem administra.`);
  }
}

function falhou(error, onde) {
  if (error) throw new Error(`${onde}: ${error.message}`);
}

/**
 * Quadro + colunas (um módulo por coluna) + cards + checklists de teoria + trilha, em poucas idas
 * ao banco (cada nível vai num insert só). Se qualquer passo falhar, o quadro é apagado — o
 * `on delete cascade` leva tudo junto — e a pessoa pode tentar de novo sem achar meio quadro
 * esquecido no Abacato.
 */
export async function criarCurso({ usuarioId, proposta, diasDeEstudo, inicio }) {
  const conferida = validarCurso(proposta);
  if (!conferida.ok) throw new ErroDeAcesso(400, conferida.erros.join("; "));
  const p = conferida.proposta;
  await exigirPodeCriarQuadro(usuarioId);

  const { data: quadro, error } = await supabase
    .from("abacato_quadros")
    .insert({ nome: p.nome, descricao: [p.descricao, "Criado pela Lisa_Proof."].filter(Boolean).join(" "), dono_id: usuarioId })
    .select("id, nome")
    .single();
  if (error) throw new ErroDeAcesso(500, error.message);

  try {
    const { data: colunas, error: e1 } = await supabase.from("abacato_colunas")
      .insert(p.modulos.map((m, i) => ({ quadro_id: quadro.id, nome: m.nome, posicao: (i + 1) * 1024 })))
      .select("id");
    falhou(e1, "colunas");

    const assuntos = assuntosEmOrdem(p);
    const porColuna = new Map();
    const linhas = assuntos.map((a) => {
      const colunaId = colunas[a.indiceDoModulo].id;
      const n = (porColuna.get(colunaId) || 0) + 1;
      porColuna.set(colunaId, n);
      return { coluna_id: colunaId, titulo: a.titulo, descricao: [a.descricao, a.objetivo && `Objetivo: ${a.objetivo}`].filter(Boolean).join("\n\n") || null, posicao: n * 1024 };
    });
    // O PostgREST devolve as linhas na ordem em que foram inseridas — é o que liga cada card
    // ao seu assunto (o gerador de quadros do Abacato conta com o mesmo comportamento).
    const { data: cards, error: e2 } = await supabase.from("abacato_cards").insert(linhas).select("id");
    falhou(e2, "cards");

    const comTarefas = assuntos.map((a, i) => ({ cardId: cards[i].id, tarefas: a.tarefas })).filter((x) => x.tarefas.length);
    if (comTarefas.length) {
      const { data: listas, error: e3 } = await supabase.from("abacato_checklists")
        .insert(comTarefas.map((x) => ({ card_id: x.cardId, titulo: "Teoria", posicao: 1024, origem: "proof", origem_id: `teoria:${x.cardId}` })))
        .select("id, card_id");
      falhou(e3, "checklists");
      const listaDoCard = new Map(listas.map((l) => [l.card_id, l.id]));
      const itens = comTarefas.flatMap((x) => x.tarefas.map((texto, n) => ({
        checklist_id: listaDoCard.get(x.cardId), texto, feito: false, posicao: (n + 1) * 1024,
        origem: "proof", origem_id: `teoria:${x.cardId}:${n + 1}`,
      })));
      const { error: e4 } = await supabase.from("abacato_checklist_itens").insert(itens);
      falhou(e4, "tarefas");
    }

    // A trilha já nasce com a ordem do curso — a Lisa acabou de pensar nela, e pedir outra
    // ordenação ao modelo seria pagar duas vezes pela mesma decisão.
    const dias = normalizarDiasDeEstudo(diasDeEstudo);
    const inicioEm = diaValido(inicio) ? inicio : diaDe();
    const { data: trilha, error: e5 } = await supabase.from("proof_trilhas").insert({
      usuario_id: usuarioId, quadro_id: quadro.id, tema: temaDo(quadro.nome), inicio_em: inicioEm,
      dias_de_estudo: dias, resumo: p.resumo || null, gerada_por: "ia",
    }).select("id").single();
    falhou(e5, "trilha");

    const etapas = montarEtapas({
      plano: assuntos.map((a, i) => ({ cardId: cards[i].id, dias: a.dias, nivel: a.nivel, objetivo: a.objetivo || null })),
      concluidos: new Set(),
      aPartirDe: inicioEm,
      diasDeEstudo: dias,
      base: inicioEm,
    });
    const { error: e6 } = await supabase.from("proof_etapas").insert(etapas.map((e) => ({
      trilha_id: trilha.id, card_id: e.cardId, ordem: e.ordem, semana: e.semana, inicio: e.inicio, fim: e.fim,
      dias: e.dias, nivel: e.nivel, objetivo: e.objetivo,
    })));
    falhou(e6, "etapas");

    return { quadroId: quadro.id, trilhaId: trilha.id, nome: quadro.nome, assuntos: assuntos.length };
  } catch (e) {
    await supabase.from("abacato_quadros").delete().eq("id", quadro.id); // a trilha vai junto (cascade)
    throw new ErroDeAcesso(500, `não consegui criar o curso: ${e.message}`);
  }
}
