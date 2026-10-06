import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { obterOuCriarDesafio, desafioParaTela } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios   body: { trilhaId, tipo, periodo? }
 *
 * Devolve o desafio do período — o que já existe, ou um novo gerado pela IA. Pedir de novo não
 * gera outro: é seguro chamar sempre que a tela abrir.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    if (!corpo?.trilhaId || !corpo?.tipo) throw new ErroDeAcesso(400, "informe a trilha e o tipo");
    const { desafio, tema, novo } = await obterOuCriarDesafio({
      usuarioId: usuario.id,
      trilhaId: String(corpo.trilhaId),
      tipo: String(corpo.tipo),
      periodo: corpo.periodo ? String(corpo.periodo) : undefined,
    });
    return json({ ok: true, novo, desafio: desafioParaTela(desafio, tema) }, novo ? 201 : 200);
  } catch (e) {
    return respostaDeErro(e);
  }
}
