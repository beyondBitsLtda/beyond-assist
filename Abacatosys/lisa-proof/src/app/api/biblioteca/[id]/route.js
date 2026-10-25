import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { lerLivro, editarLivro, apagarLivro } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/biblioteca/:id — o livro e o endereço assinado do PDF (vida curta). */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await lerLivro(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** PATCH /api/biblioteca/:id { titulo?, autor?, ultimaPagina? } */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, livro: await editarLivro(usuario.id, id, await corpoDe(req)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/biblioteca/:id — o arquivo, o texto e as marcações. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarLivro(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
