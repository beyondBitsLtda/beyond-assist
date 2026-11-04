import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { moverPagina } from "@/lib/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/paginas/:id/mover { direcao: "cima"|"baixo" } */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { direcao } = await corpoDe(req);
    return json({ ok: true, ordens: await moverPagina(usuario.id, id, direcao === "cima" ? "cima" : "baixo") });
  } catch (e) {
    return respostaDeErro(e);
  }
}
