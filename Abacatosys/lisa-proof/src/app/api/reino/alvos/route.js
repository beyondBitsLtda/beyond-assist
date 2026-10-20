import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { alvosDe } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino/alvos — os reinos que dá para invadir, os de troféus parecidos primeiro. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await alvosDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
