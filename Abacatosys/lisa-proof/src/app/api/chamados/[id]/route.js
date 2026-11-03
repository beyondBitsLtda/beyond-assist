import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { atualizarChamado } from "@/lib/chamados.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/chamados/:id — o técnico muda o status (`colunaId`), a previsão (`previsao`, "AAAA-MM-DD" ou "") ou responde (`resposta`). */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json(await atualizarChamado(usuario, id, corpo));
  } catch (e) {
    return respostaDeErro(e);
  }
}
