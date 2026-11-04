import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { configurarEntrega } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dominio/:id/entrega { repo, branch } — onde a pessoa trabalha (a branch do desafio). */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { repo, branch } = await corpoDe(req);
    return json({ ok: true, torre: await configurarEntrega(usuario.id, id, { repo, branch }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
