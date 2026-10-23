import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { acaoDeTeste, estadoDoReino } from "@/lib/reino.js";
import { previaDoPregao } from "@/lib/bolsa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reino/teste   body: { acao } — o MODO DE TESTE (liberado para todos por enquanto;
 * desliga com PROOF_MODO_TESTE=0). Mexe só no reino de quem usa:
 *   moedas · tanques · veiculos · construcoes · exercito · minas · operarios · limpar
 *   pregao — a prévia do pregão de amanhã pela Lisa, sem aplicar nada
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const acao = String(corpo?.acao || "");
    if (acao === "pregao") return json({ ok: true, previa: await previaDoPregao() });
    const resultado = await acaoDeTeste(usuario.id, acao);
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
