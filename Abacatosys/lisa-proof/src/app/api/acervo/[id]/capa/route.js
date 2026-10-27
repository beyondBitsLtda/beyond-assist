import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { capaDoMaterial } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/acervo/:id/capa — a capa como imagem (guardada no banco como data URL pequena). */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const capa = await capaDoMaterial(usuario.id, id);
    if (!capa) return new Response(null, { status: 404, headers: { "cache-control": "private, max-age=300" } });
    return new Response(capa.bytes, { headers: { "content-type": capa.tipo, "cache-control": "private, max-age=86400" } });
  } catch (e) {
    return respostaDeErro(e);
  }
}
