import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { buscarTodas } from "@/lib/estudo.js";
import { nomesPublicos } from "@/lib/reino.js";
import { PERIODOS_DO_RANKING, posicionar, nomePublico } from "@/dominio/ranking.js";
import { nivelPorPontos } from "@/dominio/pontos.js";
import { niveisDe } from "@/dominio/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ranking?periodo=total|semana|reino — o ranking mundial.
 *   total   pontos de todos os tempos       semana   pontos dos últimos 7 dias
 *   reino   troféus do Reino do Neuro
 * Devolve o top 50 e a minha posição (mesmo fora do top). Nome completo nunca sai daqui: só o
 * nome público (apelido, "Primeiro I." ou anônimo), e o meu, para eu me reconhecer.
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const periodo = new URL(req.url).searchParams.get("periodo") || "total";
    if (!PERIODOS_DO_RANKING.includes(periodo)) throw new ErroDeAcesso(400, "período inválido");

    let linhas;
    if (periodo === "reino") {
      const reinos = await buscarTodas(() => supabase.from("proof_reinos")
        .select("usuario_id, nome, trofeus, neuro_nivel, construcoes").order("usuario_id"));
      linhas = reinos.map((r) => ({
        usuarioId: r.usuario_id, valor: r.trofeus,
        extra: { reino: r.nome, torre: niveisDe(r).castelo, neuro: r.neuro_nivel },
      }));
    } else {
      const visao = periodo === "semana" ? "proof_ranking_semana" : "proof_ranking_total";
      const somas = await buscarTodas(() => supabase.from(visao).select("usuario_id, pontos, dias").order("usuario_id"));
      linhas = somas.map((s) => ({
        usuarioId: s.usuario_id, valor: s.pontos || 0,
        extra: { dias: s.dias, nivel: periodo === "total" ? nivelPorPontos(s.pontos || 0).nivel : null },
      }));
    }

    // quem ainda não pontuou (ou não abriu o reino) não tem linha nas somas, mas se vê no placar
    if (!linhas.some((l) => l.usuarioId === usuario.id)) {
      linhas.push({ usuarioId: usuario.id, valor: 0, extra: periodo === "reino" ? {} : { dias: 0, nivel: periodo === "total" ? 1 : null } });
    }
    const { topo, eu, total } = posicionar(linhas, usuario.id, 50);
    const nomes = await nomesPublicos([...topo.map((l) => l.usuarioId), usuario.id]);

    const { data: perfil } = await supabase.from("proof_perfis")
      .select("apelido, no_ranking").eq("usuario_id", usuario.id).maybeSingle();
    const meuPerfil = { apelido: perfil?.apelido || "", noRanking: perfil?.no_ranking !== false };
    const comoApareco = nomePublico({ nome: usuario.nome, ...meuPerfil });

    const limpar = (l) => ({
      posicao: l.posicao, valor: l.valor, souEu: l.souEu, ...l.extra,
      nome: l.souEu ? comoApareco : nomes.get(l.usuarioId) || "Estudante anônimo",
    });
    return json({
      ok: true, periodo, total,
      topo: topo.map(limpar),
      eu: eu ? limpar(eu) : null,
      perfil: { ...meuPerfil, comoApareco },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
