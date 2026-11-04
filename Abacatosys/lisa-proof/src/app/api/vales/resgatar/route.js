import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { resgatarVale } from "@/lib/vales.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/vales/resgatar   body: { vale } — credita as moedas do vale no Reino, uma vez só. */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await resgatarVale(usuario.id, corpo?.vale)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
