import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { replanejarTrilha } from "@/lib/trilhas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/trilhas/:id/replanejar   body: { usarIa?, diasDeEstudo? } */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await req.json().catch(() => ({}));
    const r = await replanejarTrilha({
      usuarioId: usuario.id,
      trilhaId: id,
      usarIa: corpo?.usarIa === true,
      diasDeEstudo: corpo?.diasDeEstudo,
    });
    return json({ ok: true, ...r });
  } catch (e) {
    return respostaDeErro(e);
  }
}
