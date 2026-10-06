import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { perfilDe, buscarTodas, buscarEmLotes, checklistsDosCards, linkDoAbacato } from "@/lib/estudo.js";
import { resumoDaPratica } from "@/lib/pratica.js";
import { diaDe } from "@/dominio/datas.js";
import { calcularOfensiva } from "@/dominio/ofensiva.js";
import { resumoDasMetas, tarefasDoDia } from "@/dominio/metas.js";
import { nivelPorPontos } from "@/dominio/pontos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hoje — tudo que a tela inicial mostra, numa ida só: ofensiva, pontos, metas e os
 * assuntos do dia já com as checklists.
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const hoje = diaDe();

    const [perfil, trilhasR, eventos] = await Promise.all([
      perfilDe(usuario.id),
      supabase.from("proof_trilhas").select("id, quadro_id, tema").eq("usuario_id", usuario.id).eq("status", "ativa"),
      buscarTodas(() =>
        supabase.from("proof_eventos").select("dia, pontos, tipo, chave").eq("usuario_id", usuario.id).order("criado_em")
      ),
    ]);
    if (trilhasR.error) throw new ErroDeAcesso(500, trilhasR.error.message);
    const trilhas = trilhasR.data || [];
    const trilhaPorId = new Map(trilhas.map((t) => [t.id, t]));

    const ofensiva = calcularOfensiva(eventos.map((e) => e.dia), hoje);
    const total = eventos.reduce((s, e) => s + e.pontos, 0);
    const pontosHoje = eventos.filter((e) => e.dia === hoje).reduce((s, e) => s + e.pontos, 0);
    const concluidosHoje = new Set(
      eventos.filter((e) => e.dia === hoje && e.tipo === "card").map((e) => e.chave.replace(/^card:/, ""))
    );

    const etapas = await buscarEmLotes(
      "proof_etapas", "id, trilha_id, card_id, ordem, inicio, fim, nivel, objetivo", "trilha_id", trilhas.map((t) => t.id)
    );
    const cards = await buscarEmLotes(
      "abacato_cards", "id, titulo, descricao, concluido, arquivado, recorrencia_regra", "id", etapas.map((e) => e.card_id)
    );
    const cardPorId = new Map(cards.map((c) => [c.id, c]));

    const vivas = etapas
      .filter((e) => cardPorId.get(e.card_id) && !cardPorId.get(e.card_id).arquivado)
      .map((e) => ({
        id: e.id,
        trilhaId: e.trilha_id,
        cardId: e.card_id,
        ordem: e.ordem,
        inicio: e.inicio,
        fim: e.fim,
        nivel: e.nivel,
        objetivo: e.objetivo,
        concluido: Boolean(cardPorId.get(e.card_id).concluido),
        concluidoHoje: concluidosHoje.has(e.card_id),
      }));

    const tarefas = tarefasDoDia(vivas, hoje);
    const ids = tarefas.map((t) => t.cardId);
    const [checklists, explicadas] = await Promise.all([
      checklistsDosCards(ids),
      ids.length
        ? supabase.from("proof_explicacoes").select("card_id").eq("usuario_id", usuario.id).in("card_id", ids)
        : { data: [] },
    ]);
    const comExplicacao = new Set((explicadas.data || []).map((e) => e.card_id));
    const pratica = await resumoDaPratica(usuario.id, trilhas, hoje);

    return json({
      ok: true,
      hoje,
      usuario: { nome: usuario.nome },
      resumo: {
        ofensiva,
        pontosHoje,
        metaDiaria: perfil.metaDiaria,
        total,
        nivel: nivelPorPontos(total),
      },
      metas: resumoDasMetas(vivas, hoje),
      trilhas: trilhas.length,
      pratica,
      tarefas: tarefas.map((t) => {
        const card = cardPorId.get(t.cardId);
        const trilha = trilhaPorId.get(t.trilhaId);
        return {
          ...t,
          tema: trilha?.tema || "",
          titulo: card.titulo,
          descricao: String(card.descricao || "").slice(0, 600),
          recorrente: Boolean(card.recorrencia_regra),
          checklists: checklists.get(t.cardId) || [],
          temExplicacao: comExplicacao.has(t.cardId),
          link: linkDoAbacato(trilha?.quadro_id, t.cardId),
        };
      }),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
