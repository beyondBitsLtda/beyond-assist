import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O workspace, se for de quem pede. De outra pessoa responde 404, e não 403: dizer "existe,
 *  mas não é seu" já é contar algo que a pessoa não precisa saber. */
async function doDono(req, id) {
  const usuario = await quemEh(req);
  if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
  const { data } = await supabase.from("abacato_workspaces")
    .select("id, nome, posicao").eq("id", id).eq("dono_id", usuario.id).maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "workspace não encontrado");
  return data;
}

/** PATCH /api/workspaces/:id   body: { nome?, posicao? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await doDono(req, id);
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim().slice(0, 80);
    if (Number.isFinite(corpo.posicao)) mudancas.posicao = corpo.posicao;
    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_workspaces")
      .update(mudancas).eq("id", id).select("id, nome, posicao").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, workspace: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * DELETE /api/workspaces/:id — apaga SÓ a pasta.
 *
 * Os quadros e os projetos de documentação de dentro não vão junto: voltam para "Sem
 * workspace", inteiros. É o `on delete cascade` das tabelas de ligação (db/010 e db/011) que
 * desfaz o vínculo — o quadro e o projeto em si nunca são tocados, porque um workspace não é
 * dono de nada.
 */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await doDono(req, id);
    const { error } = await supabase.from("abacato_workspaces").delete().eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
