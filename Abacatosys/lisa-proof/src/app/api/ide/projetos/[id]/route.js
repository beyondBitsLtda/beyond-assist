import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { projetoDe, salvarProjeto, apagarProjeto } from "@/lib/ide.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ide/projetos/:id — o projeto com os arquivos. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, projeto: await projetoDe(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** PUT /api/ide/projetos/:id  { nome, arquivos, pastas, principal, versao } — grava o projeto (409 se outra aba gravou antes). */
export async function PUT(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await salvarProjeto(usuario.id, id, await corpoDe(req))) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/ide/projetos/:id — apaga o projeto. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await apagarProjeto(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
