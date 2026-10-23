// O avanço das trilhas no banco (23/10/2026): junta as etapas, os cards (a teoria), os quizzes e os
// projetos de cada trilha e entrega o avanço de src/dominio/avanco.js — a fonte única de "o assunto
// está concluído?", "a semana está aberta?" e "qual é o assunto de agora?" para o app inteiro (a
// tela de hoje, a prática, o mapa, a agenda, a conquista da trilha).
//
// Não importa nada de ./estudo.js de propósito: o estudo pergunta ao avanço se o assunto está
// trancado, e um import de volta faria um laço entre os dois.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { avancoDaTrilha } from "@/dominio/avanco.js";
import { diaDe } from "@/dominio/datas.js";

const CAMPOS_DA_TRILHA = "id, usuario_id, quadro_id, tema, inicio_em, dias_de_estudo, status, resumo, gerada_por";

/** Busca por uma lista de ids em lotes de 80, e cada lote paginado (o PostgREST devolve até 1000). */
async function emLotes(tabela, campos, coluna, ids, ajustar = (q) => q) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const linhas = [];
  for (let i = 0; i < unicos.length; i += 80) {
    for (let de = 0; ; de += 1000) {
      const { data, error } = await ajustar(supabase.from(tabela).select(campos).in(coluna, unicos.slice(i, i + 80))).order("id").range(de, de + 999);
      if (error) throw new ErroDeAcesso(500, `${tabela}: ${error.message}`);
      linhas.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  return linhas;
}

/**
 * O avanço de cada trilha: `Map<trilhaId, avanço>`. Cada etapa vem com o card (título, descrição,
 * recorrente) e com a teoria (o card concluído no Abacato) — o `concluido` do avanço já pede o quiz.
 *
 * @param trilhas  `{ id, inicio_em, dias_de_estudo }`
 */
export async function avancoDasTrilhas(trilhas, hoje = diaDe()) {
  const ids = trilhas.map((t) => t.id);
  if (!ids.length) return new Map();
  const etapas = await emLotes("proof_etapas", "id, trilha_id, card_id, ordem, semana, inicio, fim, dias, nivel, objetivo, dispensa_quiz", "trilha_id", ids);
  const [cards, desafios] = await Promise.all([
    emLotes("abacato_cards", "id, titulo, descricao, concluido, arquivado, recorrencia_regra", "id", etapas.map((e) => e.card_id)),
    emLotes("proof_desafios", "id, trilha_id, tipo, periodo, rodada, status, nota, titulo, card_ids, criado_em", "trilha_id", ids,
      (q) => q.in("tipo", ["quiz", "projeto_semanal", "projeto_final"])),
  ]);
  const cardPorId = new Map(cards.map((c) => [c.id, c]));
  const avancos = new Map();
  for (const t of trilhas) {
    const lista = etapas
      .filter((e) => e.trilha_id === t.id)
      .map((e) => {
        const c = cardPorId.get(e.card_id);
        if (!c || c.arquivado) return null; // saiu do quadro; some no próximo replanejamento
        return {
          id: e.id, cardId: e.card_id, ordem: e.ordem, semana: e.semana, inicio: e.inicio, fim: e.fim, dias: e.dias,
          nivel: e.nivel, objetivo: e.objetivo, dispensa: Boolean(e.dispensa_quiz), teoria: Boolean(c.concluido),
          titulo: c.titulo, descricao: String(c.descricao || "").slice(0, 600), recorrente: Boolean(c.recorrencia_regra),
        };
      })
      .filter(Boolean);
    const daTrilha = desafios.filter((d) => d.trilha_id === t.id);
    avancos.set(t.id, avancoDaTrilha({
      etapas: lista, diasDeEstudo: t.dias_de_estudo, base: t.inicio_em, hoje,
      quizzes: daTrilha.filter((d) => d.tipo === "quiz"),
      projetos: daTrilha.filter((d) => d.tipo !== "quiz"),
    }));
  }
  return avancos;
}

/** A trilha (do dono) e o avanço dela. */
export async function avancoDaTrilhaDoUsuario(trilhaId, usuarioId, hoje = diaDe()) {
  const { data: trilha, error } = await supabase.from("proof_trilhas").select(CAMPOS_DA_TRILHA).eq("id", trilhaId).eq("usuario_id", usuarioId).maybeSingle();
  if (error) throw new ErroDeAcesso(500, `trilha: ${error.message}`);
  if (!trilha) throw new ErroDeAcesso(404, "trilha não encontrada");
  return { trilha, avanco: (await avancoDasTrilhas([trilha], hoje)).get(trilha.id) };
}

/** O avanço da trilha de um quadro (ou null, se o quadro não tem trilha desta pessoa). */
export async function avancoDoQuadro(quadroId, usuarioId, hoje = diaDe()) {
  const { data: trilha } = await supabase.from("proof_trilhas").select(CAMPOS_DA_TRILHA).eq("quadro_id", quadroId).eq("usuario_id", usuarioId).maybeSingle();
  if (!trilha) return null;
  return { trilha, avanco: (await avancoDasTrilhas([trilha], hoje)).get(trilha.id) };
}
