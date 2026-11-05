import { json } from "@/lib/http.js";
import { exigirUsuarioReal, respostaDeErro } from "@/lib/sessao.js";
import { ehAdministrador, registrarPresenca } from "@/lib/uso.js";
import { aparelhoDe } from "@/dominio/uso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/presenca   body: { caminho, voltou? }   (voltou: a aba voltou a ficar visível; marca sem somar tempo)
 *
 * A batida de presença (uma por minuto, com a aba visível): soma o tempo no acesso aberto da pessoa e a área em que
 * ela está (src/dominio/uso.js). Responde { admin } para a moldura saber se mostra o item "Uso" do menu. Uma falha na
 * gravação não vira erro na tela: a resposta é ok do mesmo jeito.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuarioReal(req);
    let corpo = {};
    try { corpo = (await req.json()) || {}; } catch { /* sem corpo: a Hoje */ }
    const caminho = String(corpo.caminho || "/").slice(0, 200);
    await registrarPresenca(usuario, { caminho, voltou: corpo.voltou === true, aparelho: aparelhoDe(req.headers.get("user-agent")) })
      .catch((e) => console.warn("[uso] batida não gravada:", e?.message || e));
    return json({ ok: true, admin: ehAdministrador(usuario) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
