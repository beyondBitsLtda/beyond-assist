import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { estadoDoReino, melhorarConstrucao, subirNeuro, coletarMina, renomearReino, treinarTropas } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino — o reino de quem está logado (nasce na primeira visita). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await estadoDoReino(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/reino   body: { acao, ... }
 *   { acao: "melhorar", chave }   constrói/melhora uma construção
 *   { acao: "neuro" }             sobe o Neuro um nível
 *   { acao: "coletar" }           coleta a mina
 *   { acao: "nome", nome }        renomeia o reino
 *   { acao: "treinar", tropa, quantidade, destino: "exercito" | "guarnicao" }
 * Devolve o resultado da ação e o reino já atualizado.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    let resultado;
    switch (corpo?.acao) {
      case "melhorar": resultado = await melhorarConstrucao(usuario.id, String(corpo.chave || "")); break;
      case "neuro": resultado = await subirNeuro(usuario.id); break;
      case "coletar": resultado = await coletarMina(usuario.id); break;
      case "nome": resultado = await renomearReino(usuario.id, corpo.nome); break;
      case "treinar": resultado = await treinarTropas(usuario.id, { tropa: String(corpo.tropa || ""), quantidade: corpo.quantidade, destino: String(corpo.destino || "") }); break;
      default: throw new ErroDeAcesso(400, "ação desconhecida");
    }
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
