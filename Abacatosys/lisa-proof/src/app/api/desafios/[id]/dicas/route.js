import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { guiaDoProjeto } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios/:id/dicas
 *
 * As "Dicas da Lisa" de um projeto da semana ou do mês: passo a passo básico, dicas e o que
 * revisar. A primeira chamada gera (alguns segundos); as seguintes devolvem o que já foi gerado.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, guia: await guiaDoProjeto({ usuarioId: usuario.id, id }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
