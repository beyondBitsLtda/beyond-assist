import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { carregarQuadrosParaPainel } from "@/lib/painelNoBanco.js";
import { painelDoQuadro, painelGeral } from "@/dominio/painel.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/paineis — os números de todos os quadros que esta pessoa pode ver.
 *
 * Carrega os quadros e conta AQUI, em vez de somar no banco com um SQL esperto. "Atrasado" é
 * uma regra do domínio: ela considera as checklists completas e o `concluido` marcado à mão.
 * Reescrevê-la em SQL criaria uma SEGUNDA definição de atrasado, e no dia em que as duas
 * discordassem o painel e o quadro mostrariam números diferentes sem ninguém saber qual está
 * certo.
 *
 * O carregamento é EM BLOCO (ver painelNoBanco.js): uma consulta por tabela, para todos os
 * quadros de uma vez. A primeira versão chamava `carregarQuadro` num laço e levava vinte e
 * nove segundos com seis quadros — quarenta e oito idas ao banco de casa, em fila.
 */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const [meus, convidados] = await Promise.all([
      supabase.from("abacato_quadros").select("id").eq("dono_id", usuario.id).eq("arquivado", false),
      supabase.from("abacato_membros").select("quadro_id, abacato_quadros ( id, arquivado )").eq("usuario_id", usuario.id),
    ]);

    const ids = new Set((meus.data || []).map((q) => q.id));
    for (const linha of convidados.data || []) {
      if (linha.abacato_quadros && !linha.abacato_quadros.arquivado) ids.add(linha.abacato_quadros.id);
    }
    if (!ids.size) return json({ ok: true, geral: painelGeral([]), quadros: [] });

    const agora = new Date();
    // O fuso de QUEM ESTÁ OLHANDO, mandado pela tela. Este servidor roda em UTC: sem isto,
    // entre 21h e a meia-noite no Brasil toda contagem de dias sai errada por um, sem erro
    // nenhum aparecer. Zero (UTC) é o padrão de quem não informou.
    const fuso = Number(new URL(req.url).searchParams.get("fuso"));
    const quadros = await carregarQuadrosParaPainel([...ids]);
    const paineis = quadros.map((q) => painelDoQuadro(q, agora, Number.isFinite(fuso) ? fuso : 0));

    paineis.sort((a, b) => b.porEstado.atrasado - a.porEstado.atrasado || b.abertos - a.abertos);
    return json({ ok: true, geral: painelGeral(paineis), quadros: paineis });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/paineis   body: { quadroId, titulo?, comTitulos?, dias? } — cria o link do cliente. */
export async function POST(req) {
  try {
    const { quadroId, titulo, comTitulos = true, dias } = await req.json().catch(() => ({}));
    if (!quadroId) throw new ErroDeAcesso(400, "faltou o quadro");
    const { usuario, papel } = await exigir(req, "quadro", quadroId, "convidar");
    if (papel !== "dono") throw new ErroDeAcesso(403, "só o dono cria o link público");

    // 32 bytes sorteados. O endereço é a única coisa que protege este painel, então ele precisa
    // ser grande o bastante para ninguém chegar nele por tentativa — e pequeno o bastante para
    // caber numa mensagem sem quebrar em duas linhas.
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = [...bytes].map((b) => "abcdefghijkmnopqrstuvwxyz23456789"[b % 33]).join("");

    const expira = Number(dias) > 0 ? new Date(Date.now() + Number(dias) * 86400000).toISOString() : null;

    const { data, error } = await supabase.from("abacato_paineis_publicos").insert({
      quadro_id: quadroId,
      token,
      titulo: titulo?.trim() || null,
      com_titulos: Boolean(comTitulos),
      expira_em: expira,
      criado_por: usuario.id,
    }).select("id, token, titulo, com_titulos, expira_em, criado_em").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, painel: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
