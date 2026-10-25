import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { lerPagina, editarPagina, apagarPagina } from "@/lib/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/paginas/:id — a página com o conteúdo. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, pagina: await lerPagina(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * PATCH /api/paginas/:id { titulo?, linguagem?, conteudo?, moduloId?, versao? }
 * Com `versao`, 409 se a página foi gravada em outro lugar depois que a tela abriu.
 */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, pagina: await editarPagina(usuario.id, id, await corpoDe(req)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/paginas/:id — num módulo, as páginas dele vão junto. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarPagina(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
