import { json } from "@/lib/http.js";
import { exigir, respostaDeErro } from "@/lib/acesso.js";
import { listarMembros, porMembro, tirarMembro } from "@/lib/membros.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projetos/:id/membros — quem participa deste projeto de documentação. */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { poderes, papel } = await exigir(req, "projeto", id, "ver");
    return json({ ok: true, membros: await listarMembros("projeto", id), poderes, papel });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/projetos/:id/membros   body: { usuarioId, papel } */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { usuarioId, papel } = await req.json().catch(() => ({}));
    await porMembro(req, "projeto", id, usuarioId, papel);
    return json({ ok: true, membros: await listarMembros("projeto", id) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/projetos/:id/membros?usuario=<id> */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const usuarioId = new URL(req.url).searchParams.get("usuario");
    await tirarMembro(req, "projeto", id, usuarioId);
    return json({ ok: true, membros: await listarMembros("projeto", id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
