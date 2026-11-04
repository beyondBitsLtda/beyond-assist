import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import {
  estadoDasIlhas, comprarConchas, coletarIlhas, construirNaIlha, treinarTripulacao, atacarIlha, proporPacto, aceitarPacto,
} from "@/lib/ilhas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ilhas — o arquipélago da Temporada das Ilhas: as ilhas, as conchas, a tripulação, os pactos. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await estadoDasIlhas(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/ilhas
 *   { acao: "conchas", moedas }            troca moedas do reino por conchas
 *   { acao: "coletar" }                     coleta a produção das suas ilhas
 *   { acao: "construir", ilha, chave }      melhora uma construção da sua ilha
 *   { acao: "treinar", tropa, quantidade }  treina a tripulação
 *   { acao: "atacar", ilha }                zarpa para uma ilha (a batalha volta para a tela mostrar)
 *   { acao: "pacto", com }                  propõe um pacto a outro jogador
 *   { acao: "aceitar-pacto", id }           aceita um pacto proposto a você
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const c = await corpoDe(req);
    const u = usuario.id;
    switch (c.acao) {
      case "conchas": return json({ ok: true, ...(await comprarConchas(u, c.moedas)) });
      case "coletar": return json({ ok: true, ...(await coletarIlhas(u)) });
      case "construir": return json({ ok: true, ...(await construirNaIlha(u, String(c.ilha || ""), String(c.chave || ""))) });
      case "treinar": return json({ ok: true, ...(await treinarTripulacao(u, String(c.tropa || ""), c.quantidade)) });
      case "atacar": return json({ ok: true, ...(await atacarIlha(u, String(c.ilha || ""))) });
      case "pacto": return json({ ok: true, ...(await proporPacto(u, String(c.com || ""))) });
      case "aceitar-pacto": return json({ ok: true, ...(await aceitarPacto(u, String(c.id || ""))) });
      default: throw new ErroDeAcesso(400, "ação desconhecida");
    }
  } catch (e) {
    return respostaDeErro(e);
  }
}
