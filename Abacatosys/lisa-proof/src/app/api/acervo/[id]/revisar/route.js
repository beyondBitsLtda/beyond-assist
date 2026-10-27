import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { revisarMaterial } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/acervo/:id/revisar { decisao: "aprovar" | "recusar" | "retirar", motivo? } — só o bibliotecário. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await revisarMaterial(usuario.id, id, await corpoDe(req))) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
