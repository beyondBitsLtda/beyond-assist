import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { perfilDe, buscarTodas, checklistsDosCards, linkDoAbacato } from "@/lib/estudo.js";
import { resumoDaPratica } from "@/lib/pratica.js";
import { avancoDasTrilhas } from "@/lib/avanco.js";
import { diaDe } from "@/dominio/datas.js";
import { calcularOfensiva } from "@/dominio/ofensiva.js";
import { resumoDasMetas, tarefasDoDia } from "@/dominio/metas.js";
import { nivelPorPontos, pontosDoDiaParaMeta } from "@/dominio/pontos.js";

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
      supabase.from("proof_trilhas").select("id, quadro_id, tema, inicio_em, dias_de_estudo").eq("usuario_id", usuario.id).eq("status", "ativa"),
      buscarTodas(() =>
        supabase.from("proof_eventos").select("dia, pontos, tipo, chave").eq("usuario_id", usuario.id).order("criado_em")
      ),
    ]);
    if (trilhasR.error) throw new ErroDeAcesso(500, trilhasR.error.message);
    const trilhas = trilhasR.data || [];
    const trilhaPorId = new Map(trilhas.map((t) => [t.id, t]));

    const ofensiva = calcularOfensiva(eventos.map((e) => e.dia), hoje);
    const total = eventos.reduce((s, e) => s + e.pontos, 0);
    // A mesma conta que o servidor usa para dar o bônus — senão a tela diria "meta batida" com
    // pontos de conquista, e o bônus não viria.
    const pontosHoje = pontosDoDiaParaMeta(eventos.filter((e) => e.dia === hoje));
    // concluído hoje: a teoria (o card) ou o quiz que faltava, hoje — e o assunto concluído de vez
    const mexidosHoje = new Set(
      eventos.filter((e) => e.dia === hoje && (e.tipo === "card" || e.tipo === "quiz")).map((e) => e.chave)
    );
    const { data: quizzesDeHoje } = await supabase.from("proof_desafios").select("id, card_ids")
      .eq("usuario_id", usuario.id).eq("tipo", "quiz").eq("periodo", hoje).eq("status", "concluido");
    const comQuizHoje = new Set((quizzesDeHoje || []).filter((q) => mexidosHoje.has(`pratica:${q.id}`)).flatMap((q) => q.card_ids || []).map(String));

    // o avanço de cada trilha: assunto concluído = teoria + quiz; a semana trancada (projeto da
    // semana anterior sem aprovação) não entra no dia
    const avancos = await avancoDasTrilhas(trilhas, hoje);
    const vivas = trilhas.flatMap((t) => (avancos.get(t.id)?.etapas || []).map((e) => ({
      ...e,
      trilhaId: t.id,
      concluidoHoje: e.concluido && (mexidosHoje.has(`card:${e.cardId}`) || comQuizHoje.has(String(e.cardId))),
    })));
    const cardPorId = new Map(vivas.map((e) => [e.cardId, e]));

    const tarefas = tarefasDoDia(vivas, hoje);
    const ids = tarefas.map((t) => t.cardId);
    const [checklists, explicadas] = await Promise.all([
      checklistsDosCards(ids),
      ids.length
        ? supabase.from("proof_explicacoes").select("card_id").eq("usuario_id", usuario.id).in("card_id", ids)
        : { data: [] },
    ]);
    const comExplicacao = new Set((explicadas.data || []).map((e) => e.card_id));
    const pratica = await resumoDaPratica(usuario.id, trilhas, hoje, avancos);

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
          recorrente: Boolean(card.recorrente),
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
