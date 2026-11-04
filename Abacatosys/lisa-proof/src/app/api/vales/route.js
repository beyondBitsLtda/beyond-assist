import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { valesPendentes } from "@/lib/vales.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/vales — os vales que a pessoa ainda pode resgatar. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, vales: await valesPendentes(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
