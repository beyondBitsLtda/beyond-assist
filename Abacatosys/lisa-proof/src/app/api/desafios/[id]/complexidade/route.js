import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { mudarComplexidade } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios/:id/complexidade  { nivel: "simples" | "padrao" | "desafiador" }
 *
 * Reescreve o projeto na complexidade pedida (só antes da primeira entrega, até 3 trocas).
 * Mais simples vale os mesmos pontos; desafiador vale 1,5×. Devolve o desafio atualizado.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, desafio: await mudarComplexidade({ usuarioId: usuario.id, id, nivel: String(corpo?.nivel || "") }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
