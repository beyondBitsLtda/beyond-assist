import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { painelDosCartoes, cartoesDaTrilha, criarCartoesDaLisa, criarCartaoDaPessoa } from "@/lib/cartoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cartoes              — a revisão de hoje e o resumo da pilha de cada trilha
 * GET /api/cartoes?trilha=ID    — todos os cartões de uma trilha
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const trilha = new URL(req.url).searchParams.get("trilha");
    return json({ ok: true, ...(trilha ? await cartoesDaTrilha(usuario.id, trilha) : await painelDosCartoes(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/cartoes { trilhaId, cardId? }                — a Lisa cria os cartões do assunto da vez
 * POST /api/cartoes { trilhaId, frente, verso, exemplo } — um cartão escrito pela pessoa
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    if (typeof corpo?.frente === "string") {
      return json({ ok: true, cartao: await criarCartaoDaPessoa(usuario.id, corpo.trilhaId, corpo) });
    }
    return json({ ok: true, ...(await criarCartoesDaLisa(usuario.id, corpo?.trilhaId, corpo?.cardId || null)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
