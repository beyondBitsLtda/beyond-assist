import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { falarNaConversa } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/desafios/:id/conversa { mensagem } — uma fala na conversa; a Lisa responde no papel e corrige. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { mensagem } = await corpoDe(req);
    return json({ ok: true, ...(await falarNaConversa({ usuarioId: usuario.id, id, mensagem })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
