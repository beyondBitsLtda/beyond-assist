import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { abrirDesafio } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dominio/:id/desafio — a Lisa escreve o desafio do andar de agora (uma vez). */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, torre: await abrirDesafio(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
