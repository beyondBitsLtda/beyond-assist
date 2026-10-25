import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { alvosDisponiveis } from "@/lib/vinculos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/vinculos/alvos — trilhas (com assuntos), torres (com andares) e livros, para escolher o vínculo. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await alvosDisponiveis(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
