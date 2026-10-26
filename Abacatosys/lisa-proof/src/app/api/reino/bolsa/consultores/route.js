import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { mesaDosConsultores } from "@/lib/bolsa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reino/bolsa/consultores — a Mesa dos Consultores: a projeção de cada um para o
 * fechamento de hoje e o placar dos últimos pregões (o de hoje, só depois que o pregão fecha).
 * No Reino de Teste (?mundo=teste), ?hora=0..23 vê a mesa numa hora qualquer.
 */
export const GET = rotaDoMundo(async (req) => {
  try {
    await exigirUsuario(req);
    const hora = new URL(req.url).searchParams.get("hora");
    return json({ ok: true, ...(await mesaDosConsultores({ hora: hora == null || hora === "" ? undefined : Number(hora) })) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
