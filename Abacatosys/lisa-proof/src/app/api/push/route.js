import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inscrições de lembrete (push). O Worker só guarda e apaga — quem envia é o script do relógio do
 * iMac (scripts/lembretes.mjs), que é onde a biblioteca de push roda.
 */

/** GET /api/push — a chave pública para o navegador se inscrever, e quantos aparelhos a pessoa já tem. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const chave = process.env.VAPID_PUBLIC_KEY || "";
    const { count } = await supabase.from("proof_push").select("id", { count: "exact", head: true }).eq("usuario_id", usuario.id);
    return json({ ok: true, chave, disponivel: Boolean(chave), aparelhos: count || 0 });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/push   body: a inscrição do navegador (`PushSubscription.toJSON()`). */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const endpoint = String(corpo?.endpoint || "");
    const p256dh = String(corpo?.keys?.p256dh || "");
    const auth = String(corpo?.keys?.auth || "");
    // Só endpoints https de serviço de push: sem isto, alguém poderia gravar uma URL qualquer e
    // fazer o relógio do iMac mandar requisições para ela.
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) {
      throw new ErroDeAcesso(400, "inscrição inválida");
    }
    const { error } = await supabase.from("proof_push").upsert(
      {
        usuario_id: usuario.id, endpoint, p256dh, auth,
        aparelho: String(req.headers.get("user-agent") || "").slice(0, 200),
      },
      { onConflict: "endpoint" }
    );
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/push   body: { endpoint } — desliga os lembretes deste aparelho. */
export async function DELETE(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await req.json().catch(() => ({}));
    const consulta = supabase.from("proof_push").delete().eq("usuario_id", usuario.id);
    const { error } = corpo?.endpoint ? await consulta.eq("endpoint", String(corpo.endpoint)) : await consulta;
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
