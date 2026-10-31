import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { diarioDaTrilha, escreverNoDiario } from "@/lib/diario.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/diario?trilha=ID — as últimas entradas do diário da trilha. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await diarioDaTrilha(usuario.id, new URL(req.url).searchParams.get("trilha"))) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/diario { trilhaId, aprendi, travei } — escrever a entrada de hoje (a primeira do dia pontua). */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await escreverNoDiario(usuario.id, corpo?.trilhaId, corpo)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
