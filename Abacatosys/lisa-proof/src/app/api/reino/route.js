import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import {
  estadoDoReino, melhorarConstrucao, subirNeuro, coletarMina, renomearReino, treinarTropas, escolherPersonagem,
  comprarVeiculo, abastecer, comprarOperario, coletarOuro, ofertarOperarios,
} from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reino — o reino de quem está logado (nasce na primeira visita). Todas as rotas do reino
 * aceitam ?mundo=teste: aí tudo acontece no Reino de Teste (src/lib/mundo.js), à parte do de verdade.
 */
export const GET = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await estadoDoReino(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
});

/**
 * POST /api/reino   body: { acao, ... }
 *   { acao: "melhorar", chave }   constrói/melhora uma construção
 *   { acao: "neuro" }             sobe o Neuro um nível
 *   { acao: "coletar" }           coleta a mina
 *   { acao: "nome", nome }        renomeia o reino
 *   { acao: "treinar", tropa, quantidade, destino: "exercito" | "guarnicao" }
 *   { acao: "personagem", id }  compra (se precisar) e veste um personagem do Neuro
 *   { acao: "veiculo", id }       compra um veículo na garagem
 *   { acao: "abastecer", id }     compra mais uma carga de combustível para hoje
 *   { acao: "operario" }          contrata um operário para a Mina de Ouro
 *   { acao: "ouro" }              coleta o ouro (as pepitas viram moedas)
 *   { acao: "ofertar", quantidade, preco }  põe operários para alugar (0 tira a oferta)
 * Devolve o resultado da ação e o reino já atualizado.
 */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    let resultado;
    switch (corpo?.acao) {
      case "melhorar": resultado = await melhorarConstrucao(usuario.id, String(corpo.chave || "")); break;
      case "neuro": resultado = await subirNeuro(usuario.id); break;
      case "coletar": resultado = await coletarMina(usuario.id); break;
      case "nome": resultado = await renomearReino(usuario.id, corpo.nome); break;
      case "personagem": resultado = await escolherPersonagem(usuario.id, String(corpo.id || "")); break;
      case "veiculo": resultado = await comprarVeiculo(usuario.id, String(corpo.id || "")); break;
      case "abastecer": resultado = await abastecer(usuario.id, String(corpo.id || "")); break;
      case "operario": resultado = await comprarOperario(usuario.id); break;
      case "ouro": resultado = await coletarOuro(usuario.id); break;
      case "ofertar": resultado = await ofertarOperarios(usuario.id, { quantidade: corpo.quantidade, preco: corpo.preco }); break;
      case "treinar": resultado = await treinarTropas(usuario.id, { tropa: String(corpo.tropa || ""), quantidade: corpo.quantidade, destino: String(corpo.destino || "") }); break;
      default: throw new ErroDeAcesso(400, "ação desconhecida");
    }
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
