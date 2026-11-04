import { json } from "@/lib/http.js";
import { exigirUsuarioReal, respostaDeErro, corpoDe, contaParaEspiar, COOKIE_ESPIAR, ErroDeAcesso } from "@/lib/sessao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 12 horas: quem esquece o modo ligado volta sozinho ao próprio Proof no dia seguinte
const DURACAO = 12 * 60 * 60;

/** GET /api/espiar — o modo espectador está ligado? { espiando, nome } (o nome da Lisa jogadora). */
export async function GET(req) {
  try {
    await exigirUsuarioReal(req);
    const espiando = (req.headers.get("cookie") || "").split(";").some((p) => p.trim() === `${COOKIE_ESPIAR}=lisa`);
    const lisa = await contaParaEspiar();
    return json({ ok: true, espiando: espiando && Boolean(lisa), existe: Boolean(lisa) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/espiar { ligar } — entra no Proof da Lisa (só olhar) ou volta para o seu. O cookie não é
 * HttpOnly de propósito: a moldura lê para mostrar a faixa "vendo o Proof da Lisa"; ele só troca as
 * LEITURAS pela conta-robô, que é pública por definição (src/lib/sessao.js).
 */
export async function POST(req) {
  try {
    await exigirUsuarioReal(req);
    const { ligar } = await corpoDe(req);
    if (ligar && !(await contaParaEspiar())) throw new ErroDeAcesso(404, "a Lisa ainda não está jogando");
    const cookie = ligar
      ? `${COOKIE_ESPIAR}=lisa; Secure; SameSite=Lax; Path=/; Max-Age=${DURACAO}`
      : `${COOKIE_ESPIAR}=; Secure; SameSite=Lax; Path=/; Max-Age=0`;
    return json({ ok: true, espiando: Boolean(ligar) }, 200, { "set-cookie": cookie });
  } catch (e) {
    return respostaDeErro(e);
  }
}
