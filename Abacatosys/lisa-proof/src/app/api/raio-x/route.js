import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { perfilDe, buscarTodas } from "@/lib/estudo.js";
import { avancoDasTrilhas } from "@/lib/avanco.js";
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
      supabase.from("proof_trilhas").select("id, tema, status, inicio_em, dias_de_estudo").eq("usuario_id", usuario.id).order("criada_em"),
    ]);
    if (trilhasR.error) throw new ErroDeAcesso(500, trilhasR.error.message);
    const trilhas = trilhasR.data || [];

    // o progresso de cada trilha: o assunto concluído é a teoria E o quiz dele (src/dominio/avanco.js)
    const avancos = await avancoDasTrilhas(trilhas, hoje);
    const comEtapas = trilhas.map((t) => ({
      ...t,
      etapas: (avancos.get(t.id)?.etapas || []).map((e) => ({ concluido: e.concluido })),
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
