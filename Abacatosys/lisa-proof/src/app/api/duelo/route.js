import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { duelosDe, comecarDuelo, responderDuelo } from "@/lib/duelo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/duelo — o duelo aberto, os de hoje, o placar contra a Lisa e as apostas possíveis. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await duelosDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/duelo
 *   { acao: "comecar", aposta }               cobra a aposta e devolve as perguntas (sem o gabarito)
 *   { acao: "responder", id, respostas: [] }  corrige, encerra e paga quem ganhou
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    if (corpo.acao === "comecar") return json({ ok: true, ...(await comecarDuelo(usuario.id, Number(corpo.aposta))) });
    if (corpo.acao === "responder") return json({ ok: true, ...(await responderDuelo(usuario.id, String(corpo.id || ""), corpo.respostas)) });
    throw new ErroDeAcesso(400, "ação desconhecida");
  } catch (e) {
    return respostaDeErro(e);
  }
}
