import { json } from "@/lib/http.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { conferirComentario } from "@/dominio/comentarios.js";
import { listarComentarios, criarComentario } from "@/lib/comentariosNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cards/:id/comentarios — a conversa do card, do mais novo para o mais antigo.
 *  Fica fora do carregamento do quadro de propósito: só o card ABERTO precisa dela, e somar
 *  comentários e imagens assinadas a cada abertura do quadro inteiro o deixaria mais lento. */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { usuario, poderes } = await exigir(req, "card", id, "ver");
    const comentarios = await listarComentarios(id, { usuarioId: usuario.id, poderes });
    return json({ ok: true, comentarios, podeComentar: Boolean(poderes.comentar) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/cards/:id/comentarios — multipart: `texto` e zero ou mais `imagem`.
 *
 * As imagens passam pelo servidor pelo mesmo motivo do papel de parede (ver a rota da parede):
 * mandar direto do navegador ao Storage dependeria de CORS num serviço que não é nosso.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { usuario, poderes, quadroId } = await exigir(req, "card", id, "comentar");

    const form = await req.formData().catch(() => null);
    if (!form) throw new ErroDeAcesso(400, "envio inválido");
    const arquivos = form.getAll("imagem").filter((a) => a && typeof a !== "string");

    // Tudo conferido ANTES do primeiro envio ao Storage: uma imagem recusada no meio da lista
    // deixaria as anteriores guardadas sem comentário nenhum.
    const conferido = conferirComentario({
      texto: form.get("texto"),
      imagens: arquivos.map((a) => ({ tipo: a.type, tamanho: a.size, nome: a.name })),
    });
    if (!conferido.ok) throw new ErroDeAcesso(400, conferido.erro);

    await criarComentario({ cardId: id, quadroId, usuarioId: usuario.id, texto: conferido.texto, arquivos });
    await tocarQuadro(quadroId);

    const comentarios = await listarComentarios(id, { usuarioId: usuario.id, poderes });
    return json({ ok: true, comentarios }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
