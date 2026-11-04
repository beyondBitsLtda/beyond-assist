import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { entregarAndar, entregarAndarDoTema } from "@/lib/dominio.js";
import { lerEntrega } from "@/lib/entregas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dominio/:id/entregar — a Lisa avalia o commit novo da branch e o Neuro luta.
 * Torre de tema: formulário (multipart) com texto, video, imagem, miniatura, audio e segundos.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) {
      return json({ ok: true, resultado: await entregarAndarDoTema(usuario.id, id, await lerEntrega(req)) });
    }
    return json({ ok: true, resultado: await entregarAndar(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
