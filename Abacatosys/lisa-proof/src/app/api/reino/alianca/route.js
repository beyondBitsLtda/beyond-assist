import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { convidarParaAlianca, responderConvite, cancelarConvite, estadoDoReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reino/alianca
 *   { acao: "convidar", alvo, dias }   — convida um reino (3, 7, 14 ou 30 dias de paz)
 *   { acao: "aceitar" | "recusar", id } — responde a um convite recebido
 *   { acao: "cancelar", id }           — desiste de um convite enviado
 * Devolve o reino atualizado (com a aliança e os convites).
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    let resultado;
    if (corpo?.acao === "convidar") resultado = await convidarParaAlianca(usuario.id, corpo.alvo, corpo.dias);
    else if (corpo?.acao === "aceitar" || corpo?.acao === "recusar") resultado = await responderConvite(usuario.id, corpo.id, corpo.acao === "aceitar");
    else if (corpo?.acao === "cancelar") resultado = await cancelarConvite(usuario.id, corpo.id);
    else throw new ErroDeAcesso(400, "ação de aliança desconhecida");
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
