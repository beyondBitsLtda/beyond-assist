import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { mercadoDeTropas, anunciarTropas, comprarDoMercado, retirarAnuncio, estadoDoReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino/mercado — o mercado de tropas: as ofertas dos outros reinos, os meus anúncios e as minhas vendas. */
export const GET = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, mercado: await mercadoDeTropas(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});

/**
 * POST /api/reino/mercado   body: { acao, ... }
 *   { acao: "anunciar", tropa, quantidade, preco, origem: "exercito" | "guarnicao" }  as tropas saem da reserva na hora
 *   { acao: "comprar", anuncio, quantidade, destino: "exercito" | "guarnicao" }
 *   { acao: "retirar", anuncio }   o que sobrou do anúncio volta para a reserva de onde saiu
 * Devolve o resultado e o reino já atualizado. O mercado a tela pede de novo pelo GET: junto com o
 * reino, ele passaria do limite de 50 chamadas de rede por requisição do Worker gratuito.
 */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    let resultado;
    switch (corpo?.acao) {
      case "anunciar":
        resultado = await anunciarTropas(usuario.id, {
          tropa: String(corpo.tropa || ""), quantidade: Number(corpo.quantidade), preco: Number(corpo.preco), origem: String(corpo.origem || ""),
        });
        break;
      case "comprar":
        resultado = await comprarDoMercado(usuario.id, corpo.anuncio, { quantidade: Number(corpo.quantidade), destino: String(corpo.destino || "") });
        break;
      case "retirar": resultado = await retirarAnuncio(usuario.id, corpo.anuncio); break;
      default: throw new ErroDeAcesso(400, "ação desconhecida");
    }
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
