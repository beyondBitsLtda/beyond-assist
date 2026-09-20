import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cards/:id/links   body: { url, titulo? } */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "card", id, "editar");
    const { url, titulo } = await req.json().catch(() => ({}));

    // Só http e https. Um `javascript:` guardado aqui e clicado depois roda no contexto do
    // Abacato, com a sessão de quem clicou — e quem cola o link não precisa ser quem clica.
    let endereco;
    try {
      endereco = new URL(String(url || "").trim());
    } catch {
      throw new ErroDeAcesso(400, "endereço inválido");
    }
    if (!["http:", "https:"].includes(endereco.protocol)) {
      throw new ErroDeAcesso(400, "só links http ou https");
    }

    const { data, error } = await supabase.from("abacato_links")
      .insert({ card_id: id, url: endereco.href, titulo: (titulo || "").trim() || null })
      .select("id, url, titulo").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, link: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
