import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { torreParaTela, apagarDominio } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dominio/:id — a torre inteira (andares, o andar de agora, o Neuro, os prêmios). */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, torre: await torreParaTela(usuario.id, id, usuario) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/dominio/:id — desistir de uma torre ainda não conquistada. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarDominio(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
