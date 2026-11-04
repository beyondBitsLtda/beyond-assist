import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { gravarTexto } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/biblioteca/:id/texto { paginas: [{ numero, texto }], fim? } — um lote do texto das páginas. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await gravarTexto(usuario.id, id, { paginas: corpo?.paginas, fim: corpo?.fim === true })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
