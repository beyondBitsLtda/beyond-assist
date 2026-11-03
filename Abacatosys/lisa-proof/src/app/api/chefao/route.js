import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { chefaoDe } from "@/lib/chefoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chefao — o Chefão da Procrastinação de agora: o vivo (com o dano dos estudos), o que acabou de
 * cair (e pagou), um novo que nasceu do atraso, ou nenhum.
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await chefaoDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
