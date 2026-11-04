import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { anotar } from "@/lib/vinculos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/anotar { alvo: { tipo, id, numero? }, cadernoId? } — "Anotar aqui": uma página nova,
 * já ligada ao alvo, no caderno escolhido (ou num caderno novo com o nome do alvo).
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await anotar(usuario.id, { alvo: corpo?.alvo, cadernoId: corpo?.cadernoId || null })) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
