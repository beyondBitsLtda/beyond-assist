import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { METAS_DIARIAS } from "@/dominio/pontos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/perfil   body: { metaDiaria } — uma das metas oferecidas na tela. */
export async function PATCH(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const meta = Number(corpo?.metaDiaria);
    if (!METAS_DIARIAS.includes(meta)) throw new ErroDeAcesso(400, `meta diária deve ser uma de: ${METAS_DIARIAS.join(", ")}`);

    const { error } = await supabase.from("proof_perfis").upsert(
      { usuario_id: usuario.id, meta_diaria: meta, atualizado_em: new Date().toISOString() },
      { onConflict: "usuario_id" }
    );
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, metaDiaria: meta });
  } catch (e) {
    return respostaDeErro(e);
  }
}
