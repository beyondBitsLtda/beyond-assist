import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { invadir, estadoDoReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/reino/invadir   body: { alvo } — o id do dono do reino. A sorte é sorteada aqui. */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const resultado = await invadir(usuario.id, corpo?.alvo);
    return json({ ok: true, resultado, reino: await estadoDoReino(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});
