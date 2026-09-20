import { json } from "@/lib/http.js";
import { exigir, respostaDeErro } from "@/lib/acesso.js";
import { listarMembros, porMembro, tirarMembro } from "@/lib/membros.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/quadros/:id/membros — quem participa deste quadro. Qualquer participante vê a
 *  lista: saber com quem se divide um quadro faz parte de trabalhar nele. */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { poderes, papel } = await exigir(req, "quadro", id, "ver");
    return json({ ok: true, membros: await listarMembros("quadro", id), poderes, papel });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/quadros/:id/membros   body: { usuarioId, papel } — convida ou muda o papel. */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { usuarioId, papel } = await req.json().catch(() => ({}));
    await porMembro(req, "quadro", id, usuarioId, papel);
    return json({ ok: true, membros: await listarMembros("quadro", id) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/quadros/:id/membros?usuario=<id> — tira alguém do quadro. */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const usuarioId = new URL(req.url).searchParams.get("usuario");
    await tirarMembro(req, "quadro", id, usuarioId);
    return json({ ok: true, membros: await listarMembros("quadro", id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
