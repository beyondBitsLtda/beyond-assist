import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { presentesDe } from "@/lib/presentes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/presentes — os presentes da pessoa: { presentes, fechados }. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await presentesDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
