import { json } from "@/lib/http.js";
import { COOKIE_SESSAO } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/sair — apaga o cookie com Max-Age=0, que funciona igual em todo navegador. */
export async function POST() {
  return json({ ok: true }, 200, {
    "set-cookie": `${COOKIE_SESSAO}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  });
}
