import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces — os workspaces de quem pede, em ordem.
 *
 * Só os DELE: workspace é organização pessoal (ver db/010-workspaces.sql), e o de outra pessoa
 * não diz nada a quem não é o dono.
 */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
    const { data, error } = await supabase.from("abacato_workspaces")
      .select("id, nome, posicao").eq("dono_id", usuario.id).order("posicao");
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, workspaces: data || [] });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/workspaces   body: { nome } — entra no fim da lista. */
export async function POST(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
    const { nome } = await req.json().catch(() => ({}));
    const limpo = String(nome || "").trim().slice(0, 80);
    if (!limpo) throw new ErroDeAcesso(400, "o workspace precisa de um nome");

    const { data: ultimo } = await supabase.from("abacato_workspaces")
      .select("posicao").eq("dono_id", usuario.id)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { data, error } = await supabase.from("abacato_workspaces")
      .insert({ dono_id: usuario.id, nome: limpo, posicao: posicaoEntre(ultimo?.posicao ?? null, null) })
      .select("id, nome, posicao").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, workspace: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
