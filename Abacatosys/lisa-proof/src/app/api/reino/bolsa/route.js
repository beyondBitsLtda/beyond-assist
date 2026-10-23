import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { estadoDaBolsa, comprarAcao, venderAcao } from "@/lib/bolsa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino/bolsa — a Bolsa do Reino (abre o pregão do dia, se ninguém abriu ainda). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const hora = new URL(req.url).searchParams.get("hora");
    return json({ ok: true, ...(await estadoDaBolsa(usuario.id, { hora: hora == null || hora === "" ? undefined : Number(hora) })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/reino/bolsa
 *   { acao: "comprar", id, quantidade }   compra ações (preço do dia + corretagem)
 *   { acao: "vender", id, quantidade }    vende ações (preço do dia − corretagem)
 * Devolve o resultado e a bolsa atualizada.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    let resultado;
    if (corpo?.acao === "comprar") resultado = await comprarAcao(usuario.id, corpo.id, corpo.quantidade);
    else if (corpo?.acao === "vender") resultado = await venderAcao(usuario.id, corpo.id, corpo.quantidade);
    else throw new ErroDeAcesso(400, "ordem desconhecida");
    return json({ ok: true, resultado, bolsa: await estadoDaBolsa(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
