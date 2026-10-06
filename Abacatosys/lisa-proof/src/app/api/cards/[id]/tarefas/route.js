import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { cardDeEstudo, gravarChecklistDeTeoria } from "@/lib/estudo.js";
import { tarefasDeTeoria, temModelo } from "@/lib/ia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cards/:id/tarefas — a Lisa monta a checklist de teoria do assunto e grava no card
 * do Abacato. Uma vez por card (ver gravarChecklistDeTeoria).
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { card, quadro } = await cardDeEstudo(id, usuario.id);
    if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");

    const itens = await tarefasDeTeoria({ tema: quadro.tema, card });
    const checklistId = await gravarChecklistDeTeoria(card, itens);
    return json({ ok: true, checklistId, itens }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
