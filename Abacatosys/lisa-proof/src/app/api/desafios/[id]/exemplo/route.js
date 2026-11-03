import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { exemploDaLisa } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios/:id/exemplo
 *
 * O "Exemplo da Lisa" (BEYOND-0022): uma aplicação de exemplo, num cenário parecido, com todos os conceitos
 * do exercício ou do projeto. A primeira chamada gera (alguns segundos); as seguintes devolvem o guardado.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, exemplo: await exemploDaLisa({ usuarioId: usuario.id, id }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
