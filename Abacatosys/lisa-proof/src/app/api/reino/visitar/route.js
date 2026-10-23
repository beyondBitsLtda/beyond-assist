import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { visitarReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino/visitar?id=... — a visão completa de um reino vizinho (só durante a paz). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const id = new URL(req.url).searchParams.get("id");
    return json({ ok: true, reino: await visitarReino(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
