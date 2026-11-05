import { sessaoDe } from "@/lib/papelNaSessao.js";
import { usoParaPainel } from "@/lib/usoDosUsuarios.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/uso-dos-usuarios?dias=7|30|90 — o painel "Uso dos usuários" (só o admin; o portão já barra o usuário,
 * e a rota confere de novo): acessos, logins, tempo, telas e o que cada pessoa fez.
 */
export async function GET(req) {
  if (sessaoDe(req).papel !== "admin") return Response.json({ ok: false, error: "só o admin vê o uso" }, { status: 403 });
  try {
    const dias = new URL(req.url).searchParams.get("dias");
    return Response.json({ ok: true, ...(await usoParaPainel(dias)) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
