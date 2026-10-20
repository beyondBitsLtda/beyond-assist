import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { perfilDe, buscarTodas } from "@/lib/estudo.js";
import { diaDe } from "@/dominio/datas.js";
import { montarRaioX } from "@/dominio/raioX.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/raio-x — o raio-x de quem está logado: pontos por origem, ritmo, quiz, exercícios,
 * projetos, cada trilha e todas as pontuações. Só os dados da própria pessoa (a sessão diz quem).
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const hoje = diaDe();

    const [perfil, eventos, desafios, trilhasR] = await Promise.all([
      perfilDe(usuario.id),
      buscarTodas(() => supabase.from("proof_eventos")
        .select("tipo, pontos, dia, detalhe, criado_em, trilha_id").eq("usuario_id", usuario.id).order("criado_em")),
      buscarTodas(() => supabase.from("proof_desafios")
        .select("id, tipo, periodo, status, nota, pontos, tentativas, titulo, trilha_id, conteudo, resposta").eq("usuario_id", usuario.id).order("periodo")),
      supabase.from("proof_trilhas").select("id, tema, status, inicio_em").eq("usuario_id", usuario.id).order("criada_em"),
    ]);
    if (trilhasR.error) throw new ErroDeAcesso(500, trilhasR.error.message);
    const trilhas = trilhasR.data || [];

    // o progresso de cada trilha: as etapas e se o card de cada uma está concluído no Abacato
    let etapas = [];
    if (trilhas.length) {
      etapas = await buscarTodas(() => supabase.from("proof_etapas").select("trilha_id, card_id").in("trilha_id", trilhas.map((t) => t.id)));
    }
    const concluidos = new Set();
    const ids = [...new Set(etapas.map((e) => e.card_id))];
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await supabase.from("abacato_cards").select("id, concluido").in("id", ids.slice(i, i + 300));
      for (const c of data || []) if (c.concluido) concluidos.add(c.id);
    }
    const comEtapas = trilhas.map((t) => ({
      ...t,
      etapas: etapas.filter((e) => e.trilha_id === t.id).map((e) => ({ concluido: concluidos.has(e.card_id) })),
    }));

    return json({
      ok: true,
      hoje,
      usuario: { nome: usuario.nome || "", email: usuario.email || "" },
      ...montarRaioX({ eventos, desafios, trilhas: comEtapas, metaDiaria: perfil.metaDiaria, hoje }),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
