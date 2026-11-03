import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { caixaDoCorreio, destinatarios, lerCorreio, mandarRecado } from "@/lib/correio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/correio — a caixa (recebidas, enviadas, não lidas) e para quem dá para escrever (BEYOND-0016). `?destinatarios=0` pula a lista. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const comLista = new URL(req.url).searchParams.get("destinatarios") !== "0";
    const [caixa, lista] = await Promise.all([caixaDoCorreio(usuario.id), comLista ? destinatarios(usuario.id) : Promise.resolve(null)]);
    return json({ ok: true, ...caixa, ...(lista ? { destinatarios: lista } : {}) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/correio — { acao: "recado", paraId, texto } manda um recado; { acao: "ler" } marca a caixa como lida. */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    if (corpo?.acao === "ler") { await lerCorreio(usuario.id); return json({ ok: true }); }
    return json({ ok: true, ...(await mandarRecado(usuario.id, corpo || {})) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
