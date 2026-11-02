import { COOKIE_SESSAO, COOKIE_RENOVA, COOKIE_PAPEL } from "@/lib/authSession.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — encerra a sessão: no Supabase (o token de renovação deixa de valer — sem
 * isso, quem tivesse copiado o cookie seguiria renovando a sessão) e no navegador (apaga os cookies,
 * o do papel junto).
 *
 * Apagar cookie é definir o mesmo nome com validade zero: não existe "remover" no protocolo,
 * só substituir por algo que vence na hora. Se o Path não for idêntico ao da criação, o
 * navegador guarda DOIS cookies com o mesmo nome e a sessão parece não terminar nunca.
 */
export async function POST(req) {
  const acesso = req.cookies.get(COOKIE_SESSAO)?.value;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (acesso && url && anon) {
    // (01/11/2026) melhor esforço: o banco fora do ar não pode impedir a pessoa de sair
    try {
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: anon, authorization: `Bearer ${acesso}` },
        signal: AbortSignal.timeout(4000),
      });
    } catch { /* sai mesmo assim */ }
  }
  const morto = "HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
  const cabecalhos = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  cabecalhos.append("set-cookie", `${COOKIE_SESSAO}=; ${morto}`);
  cabecalhos.append("set-cookie", `${COOKIE_RENOVA}=; ${morto}`);
  cabecalhos.append("set-cookie", `${COOKIE_PAPEL}=; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cabecalhos });
}
