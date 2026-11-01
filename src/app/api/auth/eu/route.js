import { COOKIE_SESSAO, conferirToken, papelDe, adminsDe } from "@/lib/authSession.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/eu → { logado, papel: "admin" | "usuario" | null, modoMvp } (01/11/2026, o MVP).
 * A tela pergunta o papel para esconder o que o usuário não usa (quem barra é o portão). Mora em
 * /api/auth/, que não pede login — por isso confere o token aqui mesmo.
 */
export async function GET(req) {
  const r = await conferirToken(req.cookies.get(COOKIE_SESSAO)?.value, process.env.SUPABASE_JWT_SECRET);
  const modoMvp = adminsDe(process.env.LISA_ADMINS).length > 0;
  const corpo = r.ok
    ? { ok: true, logado: true, papel: papelDe(r.payload, process.env.LISA_ADMINS), modoMvp }
    : { ok: true, logado: false, papel: null, modoMvp };
  return Response.json(corpo, { headers: { "cache-control": "no-store" } });
}
