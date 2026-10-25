import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { listarCadernos, criarCaderno } from "@/lib/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cadernos — os cadernos da pessoa. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, cadernos: await listarCadernos(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/cadernos { titulo, descricao?, cor?, icone? } — caderno novo, com uma página para começar. */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await criarCaderno(usuario.id, await corpoDe(req))) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
