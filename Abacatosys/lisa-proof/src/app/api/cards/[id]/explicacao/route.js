import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { cardDeEstudo } from "@/lib/estudo.js";
import { explicarAssunto, temModelo } from "@/lib/ia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cards/:id/explicacao — a explicação já guardada, se houver. Não gasta IA. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await cardDeEstudo(id, usuario.id);
    const { data } = await supabase
      .from("proof_explicacoes").select("texto, criada_em").eq("usuario_id", usuario.id).eq("card_id", id).maybeSingle();
    return json({ ok: true, texto: data?.texto || null, criadaEm: data?.criada_em || null });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/cards/:id/explicacao — a Lisa explica o assunto (e guarda, para não pedir de novo). */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { card, quadro } = await cardDeEstudo(id, usuario.id);
    if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");

    const texto = await explicarAssunto({ tema: quadro.tema, card });
    const { error } = await supabase.from("proof_explicacoes").upsert(
      { usuario_id: usuario.id, card_id: card.id, texto, criada_em: new Date().toISOString() },
      { onConflict: "usuario_id,card_id" }
    );
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, texto });
  } catch (e) {
    return respostaDeErro(e);
  }
}
