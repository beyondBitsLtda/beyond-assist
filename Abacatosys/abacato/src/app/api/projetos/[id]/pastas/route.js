import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/projetos/:id/pastas   body: { nome, paiId? } */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "projeto", id, "criar");
    const { nome, paiId } = await req.json().catch(() => ({}));
    if (!nome?.trim()) throw new ErroDeAcesso(400, "a pasta precisa de um nome");

    if (paiId) {
      // A pasta pai tem de ser DESTE projeto. Sem esta checagem, um id de outro projeto faria
      // a pasta nascer numa árvore que ninguém deste projeto consegue ver, com os documentos
      // dentro.
      const { data: pai } = await supabase
        .from("abacato_pastas").select("id, projeto_id").eq("id", paiId).maybeSingle();
      if (!pai) throw new ErroDeAcesso(404, "pasta pai não existe");
      if (pai.projeto_id !== id) throw new ErroDeAcesso(403, "essa pasta é de outro projeto");
    }

    const { data: ultima } = await supabase
      .from("abacato_pastas").select("posicao").eq("projeto_id", id)
      .is("pai_id", paiId || null).eq("arquivada", false)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { data, error } = await supabase.from("abacato_pastas").insert({
      projeto_id: id,
      pai_id: paiId || null,
      nome: nome.trim(),
      posicao: (ultima?.posicao || 0) + 1024,
    }).select("id, pai_id, nome, posicao").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, pasta: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
