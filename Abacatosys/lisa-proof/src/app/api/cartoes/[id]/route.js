import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { revisarUmCartao, apagarCartao } from "@/lib/cartoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cartoes/:id { resposta: "esqueci" | "dificil" | "lembrei" | "facil" } — revisar o cartão. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { resposta } = await corpoDe(req);
    return json({ ok: true, ...(await revisarUmCartao(usuario.id, id, resposta)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/cartoes/:id — apagar o cartão. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarCartao(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
