import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { detalheDaTrilha, apagarTrilha } from "@/lib/trilhas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/trilhas/:id — a trilha inteira, na ordem de estudo. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await detalheDaTrilha({ usuarioId: usuario.id, trilhaId: id })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/trilhas/:id — apaga a trilha. O quadro do Abacato e os pontos ganhos ficam. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarTrilha({ usuarioId: usuario.id, trilhaId: id });
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
