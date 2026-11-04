import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { montarDominio } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dominio/:id/montar { andares } — a Lisa monta os andares escolhidos. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { andares } = await corpoDe(req);
    return json({ ok: true, torre: await montarDominio(usuario.id, id, andares) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
