import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { estadoDaBolsa, comprarAcao, venderAcao } from "@/lib/bolsa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reino/bolsa — a Bolsa do Reino (abre o pregão do dia, se ninguém abriu ainda).
 * No Reino de Teste (?mundo=teste), ?hora=0..23 mostra o pregão de hoje numa hora qualquer.
 */
export const GET = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const hora = new URL(req.url).searchParams.get("hora");
    return json({ ok: true, ...(await estadoDaBolsa(usuario.id, { hora: hora == null || hora === "" ? undefined : Number(hora) })) });
  } catch (e) {
    return respostaDeErro(e);
  }
});

/**
 * POST /api/reino/bolsa
 *   { acao: "comprar", id, quantidade }   compra ações (preço do dia + corretagem)
 *   { acao: "vender", id, quantidade }    vende ações (preço do dia − corretagem)
 * Só das 07:00 às 17:00. No Reino de Teste, a qualquer hora — e `hora` (0..23) negocia na hora simulada.
 * Devolve o resultado e a bolsa atualizada.
 */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const hora = Number.isInteger(corpo?.hora) ? corpo.hora : undefined;
    let resultado;
    if (corpo?.acao === "comprar") resultado = await comprarAcao(usuario.id, corpo.id, corpo.quantidade, { hora });
    else if (corpo?.acao === "vender") resultado = await venderAcao(usuario.id, corpo.id, corpo.quantidade, { hora });
    else throw new ErroDeAcesso(400, "ordem desconhecida");
    return json({ ok: true, resultado, bolsa: await estadoDaBolsa(usuario.id, { hora }) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
