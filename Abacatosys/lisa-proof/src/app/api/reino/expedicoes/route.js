import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { expedicoesDe, atacarExpedicao, estadoDoReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino/expedicoes — o mapa das expedições contra a CPU (vilas, florestas, bosques...). */
export const GET = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await expedicoesDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
});

/** POST /api/reino/expedicoes   body: { id } — parte na expedição. A sorte é sorteada aqui. */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const resultado = await atacarExpedicao(usuario.id, corpo?.id);
    const [reino, mapa] = await Promise.all([estadoDoReino(usuario.id), expedicoesDe(usuario.id)]);
    return json({ ok: true, resultado, reino, mapa });
  } catch (e) {
    return respostaDeErro(e);
  }
});
