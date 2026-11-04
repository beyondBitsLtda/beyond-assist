import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { agradecer } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/acervo/:id/agradecer { moedas } — a gorjeta para quem trouxe o material. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await agradecer(usuario.id, id, corpo?.moedas)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
