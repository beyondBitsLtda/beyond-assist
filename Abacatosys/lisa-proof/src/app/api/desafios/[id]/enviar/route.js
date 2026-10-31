import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { enviarExercicio, enviarProjeto, responderExercicio, entregarEvidencia, encerrarConversa, entregarDiagrama } from "@/lib/pratica.js";
import { lerEntrega } from "@/lib/entregas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios/:id/enviar
 *   exercício de código:  { codigo }
 *   projeto de programação: { repo }  — link de um repositório PÚBLICO do GitHub
 *   lista de cálculo, ditado, treino de ouvido:  { respostas: [...] }  — corrigidos no servidor, sem IA
 *   desafio aberto e projeto dos outros perfis: formulário (multipart) com texto, video, imagem,
 *     miniatura, audio, segundos e pdf (src/lib/entregas.js)
 *   conversa com a Lisa: { encerrar: true } — a Lisa avalia as falas (cada fala vai por /conversa)
 *   desenho de diagrama: { diagrama } — o documento do quadro (o JSON do ProcessMap, formato 4)
 *
 * A Lisa avalia na hora e devolve nota, comentário e pontos. Pode demorar alguns segundos.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) {
      return json({ ok: true, ...(await entregarEvidencia({ usuarioId: usuario.id, id, entrega: await lerEntrega(req) })) });
    }
    const corpo = await corpoDe(req);
    if (corpo?.encerrar === true) {
      return json({ ok: true, ...(await encerrarConversa({ usuarioId: usuario.id, id })) });
    }
    if (corpo?.diagrama && typeof corpo.diagrama === "object") {
      return json({ ok: true, ...(await entregarDiagrama({ usuarioId: usuario.id, id, diagrama: corpo.diagrama })) });
    }
    if (Array.isArray(corpo?.respostas)) {
      return json({ ok: true, ...(await responderExercicio({ usuarioId: usuario.id, id, respostas: corpo.respostas })) });
    }
    if (typeof corpo?.codigo === "string") {
      return json({ ok: true, ...(await enviarExercicio({ usuarioId: usuario.id, id, codigo: corpo.codigo })) });
    }
    if (typeof corpo?.repo === "string") {
      return json({ ok: true, ...(await enviarProjeto({ usuarioId: usuario.id, id, repo: corpo.repo })) });
    }
    throw new ErroDeAcesso(400, "envie a sua resposta: o código, as respostas, o diagrama, a entrega ou o link do repositório");
  } catch (e) {
    return respostaDeErro(e);
  }
}
