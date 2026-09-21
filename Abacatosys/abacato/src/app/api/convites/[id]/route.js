import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirAdmin } from "@/lib/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/convites/:id   body: { ativo }  — liga ou desliga o link.
 *
 * DESLIGA, não apaga. Apagar levaria junto a resposta à pergunta "de onde veio esta conta?",
 * que é justamente a que se faz quando um cadastro estranho aparece na fila — a coluna
 * `convite_id` de cada pessoa aponta para cá.
 */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigirAdmin(req);
    const { ativo } = await req.json().catch(() => ({}));
    if (typeof ativo !== "boolean") throw new ErroDeAcesso(400, "diga se o link fica ligado ou desligado");

    const { data, error } = await supabase.from("abacato_convites")
      .update({ ativo }).eq("id", id)
      .select("id, token, rotulo, tipo, expira_em, max_usos, usos, ativo, criado_em").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, convite: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}
