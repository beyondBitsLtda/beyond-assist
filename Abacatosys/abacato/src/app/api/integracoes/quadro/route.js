import { json } from "@/lib/http.js";
import { respostaDeErro } from "@/lib/acesso.js";
import { exigirIntegracao, quadroParaIntegracao } from "@/lib/integracoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/integracoes/quadro   Authorization: Bearer abi_...
 *
 * O quadro da integração, inteiro, sem as pessoas (ver `quadroParaIntegracao`). O id do quadro
 * não vem na URL: é o token que diz qual é, e não existe como pedir outro.
 */
export async function GET(req) {
  try {
    const { integracao, quadro } = await exigirIntegracao(req, "ler");
    const conteudo = await quadroParaIntegracao(quadro.id);
    return json({
      ok: true,
      atualizadoEm: new Date().toISOString(),
      quadro: { id: quadro.id, nome: quadro.nome },
      colunaEntradaId: integracao.coluna_entrada_id,
      ...conteudo,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
