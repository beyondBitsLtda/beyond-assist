import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { criarPagina } from "@/lib/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cadernos/:id/paginas { tipo: "pagina"|"modulo", titulo, linguagem?, moduloId?, conteudo? } */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, pagina: await criarPagina(usuario.id, id, await corpoDe(req)) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
