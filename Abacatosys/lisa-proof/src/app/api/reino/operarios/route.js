import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { rotaDoMundo } from "@/lib/mundo.js";
import { mercadoDeOperarios, alugarOperarios, estadoDoReino } from "@/lib/reino.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reino/operarios — o mercado: quem tem operários para alugar agora. */
export const GET = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ofertas: await mercadoDeOperarios(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
});

/** POST /api/reino/operarios   body: { dono, quantidade } — aluga operários de outro reino por 24 h. */
export const POST = rotaDoMundo(async (req) => {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const resultado = await alugarOperarios(usuario.id, corpo?.dono, corpo?.quantidade);
    const [reino, ofertas] = await Promise.all([estadoDoReino(usuario.id), mercadoDeOperarios(usuario.id)]);
    return json({ ok: true, resultado, reino, ofertas });
  } catch (e) {
    return respostaDeErro(e);
  }
});
