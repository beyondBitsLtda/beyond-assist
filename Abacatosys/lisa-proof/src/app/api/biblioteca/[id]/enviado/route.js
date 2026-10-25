import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { confirmarEnvio } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/biblioteca/:id/enviado — o navegador terminou de enviar o PDF; o servidor confere que ele chegou. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, livro: await confirmarEnvio(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
