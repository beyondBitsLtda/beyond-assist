import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { METAS_DIARIAS } from "@/dominio/pontos.js";
import { apelidoValido } from "@/dominio/ranking.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/perfil   body: qualquer um destes, sozinho ou junto
 *   { metaDiaria }   uma das metas oferecidas na tela
 *   { apelido }      o nome que aparece no ranking ("" volta para "Primeiro I.")
 *   { noRanking }    false = aparecer como "Estudante anônimo"
 */
export async function PATCH(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = (await corpoDe(req)) || {};
    const linha = { usuario_id: usuario.id, atualizado_em: new Date().toISOString() };
    const resposta = {};

    if ("metaDiaria" in corpo) {
      const meta = Number(corpo.metaDiaria);
      if (!METAS_DIARIAS.includes(meta)) throw new ErroDeAcesso(400, `meta diária deve ser uma de: ${METAS_DIARIAS.join(", ")}`);
      linha.meta_diaria = resposta.metaDiaria = meta;
    }
    if ("apelido" in corpo) {
      const r = apelidoValido(corpo.apelido);
      if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
      linha.apelido = r.apelido || null;
      resposta.apelido = r.apelido;
    }
    if ("noRanking" in corpo) linha.no_ranking = resposta.noRanking = corpo.noRanking !== false;
    if (Object.keys(resposta).length === 0) throw new ErroDeAcesso(400, "nada para mudar");

    const { error } = await supabase.from("proof_perfis").upsert(linha, { onConflict: "usuario_id" });
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, ...resposta });
  } catch (e) {
    return respostaDeErro(e);
  }
}
