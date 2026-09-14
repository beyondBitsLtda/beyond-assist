import { COOKIE_SESSAO, COOKIE_RENOVA } from "@/lib/authSession.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — apaga os dois cookies da sessão.
 *
 * Apagar cookie é definir o mesmo nome com validade zero: não existe "remover" no protocolo,
 * só substituir por algo que vence na hora. Se o Path não for idêntico ao da criação, o
 * navegador guarda DOIS cookies com o mesmo nome e a sessão parece não terminar nunca.
 */
export async function POST() {
  const morto = "HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
  const cabecalhos = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  cabecalhos.append("set-cookie", `${COOKIE_SESSAO}=; ${morto}`);
  cabecalhos.append("set-cookie", `${COOKIE_RENOVA}=; ${morto}`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cabecalhos });
}
