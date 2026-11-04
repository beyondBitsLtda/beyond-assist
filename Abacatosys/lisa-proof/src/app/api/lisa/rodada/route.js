import { json } from "@/lib/http.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { rodadaDaLisa } from "@/lib/lisaRotina.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lisa/rodada — uma rodada da Lisa (o que está na vez da agenda dela agora). Quem chama é o relógio da
 * nuvem (worker-proof.js, a cada 30 minutos), com o segredo PROOF_SEGREDO_DO_RELOGIO no cabeçalho
 * x-proof-relogio; sem ele (ou sem o segredo configurado), ninguém roda a Lisa por aqui. Uma jogada por chamada.
 */
export async function POST(req) {
  try {
    const segredo = process.env.PROOF_SEGREDO_DO_RELOGIO || "";
    if (segredo.length < 16 || req.headers.get("x-proof-relogio") !== segredo) throw new ErroDeAcesso(403, "só o relógio da Lisa chama esta rota");
    const feitas = await rodadaDaLisa({ maximo: 1 });
    return json({ ok: true, feitas });
  } catch (e) {
    return respostaDeErro(e);
  }
}
