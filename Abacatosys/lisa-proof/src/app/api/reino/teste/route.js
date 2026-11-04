import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { rotaDoMundo, emTeste } from "@/lib/mundo.js";
import { acaoDeTeste, estadoDoReino } from "@/lib/reino.js";
import { previaDoPregao } from "@/lib/bolsa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reino/teste?mundo=teste   body: { acao } — as ferramentas do REINO DE TESTE (o mundo à
 * parte, src/lib/mundo.js). Só funcionam no mundo de teste: sem ?mundo=teste, recusam — o reino de
 * verdade nunca muda por elas.
 *   moedas · dia · rivais · invasao · minas · guerra · liberado · zerar  (src/dominio/mundoDeTeste.js)
 *   pregao — a prévia do pregão de amanhã pela Lisa, sem aplicar nada
 */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    if (!emTeste()) throw new ErroDeAcesso(403, "as ferramentas de teste só funcionam no Reino de Teste");
    const corpo = await corpoDe(req);
    const acao = String(corpo?.acao || "");
    if (acao === "pregao") return json({ ok: true, previa: await previaDoPregao() });
    const resultado = await acaoDeTeste(usuario.id, acao);
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
