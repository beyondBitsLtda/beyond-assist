import { json } from "@/lib/http.js";
import { COOKIE_SESSAO } from "@/lib/abacatoAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/sair — apaga o cookie. Max-Age=0 e não `delete`: é o que funciona igual em
 *  todo navegador, inclusive nos que ignoram um Set-Cookie sem valor. */
export async function POST() {
  return json({ ok: true }, 200, {
    "set-cookie": `${COOKIE_SESSAO}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  });
}
