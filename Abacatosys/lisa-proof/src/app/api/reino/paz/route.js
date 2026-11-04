import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { proporPaz, votarNaPaz, cancelarPaz, estadoDoReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reino/paz
 *   { acao: "propor", dias }        — propõe a paz (3, 7, 14 ou 30 dias); o voto de quem propõe é sim
 *   { acao: "votar", id, voto }     — vota sim (true) ou não (false) numa proposta aberta
 *   { acao: "cancelar", id }        — quem propôs desiste da proposta
 * Devolve o reino atualizado (com a paz ou a votação).
 */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    let resultado;
    if (corpo?.acao === "propor") resultado = await proporPaz(usuario.id, corpo.dias);
    else if (corpo?.acao === "votar") resultado = await votarNaPaz(usuario.id, corpo.id, corpo.voto === true);
    else if (corpo?.acao === "cancelar") resultado = await cancelarPaz(usuario.id, corpo.id);
    else throw new ErroDeAcesso(400, "ação de paz desconhecida");
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
