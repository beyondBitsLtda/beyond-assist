import { json } from "@/lib/http.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { conferirComentario, podeApagarComentario, podeEditarComentario } from "@/dominio/comentarios.js";
import { editarComentario, apagarComentario } from "@/lib/comentariosNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/comentarios/:id  body: { texto } — só quem escreveu muda o texto. */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    // "ver", e não "comentar": a regra que vale aqui é a de autoria, conferida logo abaixo.
    // Quem deixou de ser comentarista ainda pode corrigir o que já tinha escrito.
    const { usuario, autorId } = await exigir(req, "comentario", id, "ver");
    if (!podeEditarComentario({ autorId, usuarioId: usuario.id })) {
      throw new ErroDeAcesso(403, "só quem escreveu pode editar o comentário");
    }

    const { texto } = await req.json().catch(() => ({}));
    const conferido = conferirComentario({ texto });
    if (!conferido.ok) throw new ErroDeAcesso(400, conferido.erro);

    await editarComentario(id, conferido.texto);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/comentarios/:id — quem escreveu, ou dono e editor do quadro. Apaga as imagens. */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { usuario, poderes, autorId } = await exigir(req, "comentario", id, "ver");
    if (!podeApagarComentario({ autorId, usuarioId: usuario.id, poderes })) {
      throw new ErroDeAcesso(403, "só quem escreveu (ou quem edita o quadro) pode apagar o comentário");
    }
    await apagarComentario(id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
