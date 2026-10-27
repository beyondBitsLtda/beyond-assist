import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { verMaterial, apagarEnvio } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/acervo/:id — o material e, se tiver PDF, um endereço assinado (vida curta) para espiar. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await verMaterial(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/acervo/:id — quem enviou desiste (na fila, recusado ou o envio que não terminou). */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarEnvio(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
