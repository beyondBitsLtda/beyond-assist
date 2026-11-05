import { sessaoDe } from "@/lib/papelNaSessao.js";
import { registrarPresenca, aparelhoDe } from "@/lib/usoDosUsuarios.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/presenca   body: { caminho, voltou? }
 *
 * A batida de presença do painel "Uso dos usuários" (src/lib/usoDosUsuarios.js): uma por minuto, com a aba visível.
 * `voltou`: a aba voltou a ficar visível (marca sem somar o tempo escondida). Uma falha na gravação não vira erro na
 * tela: a resposta é ok do mesmo jeito.
 */
export async function POST(req) {
  const { dono } = sessaoDe(req);
  if (!dono) return Response.json({ ok: false, error: "sessão sem usuário" }, { status: 401 });
  const corpo = await req.json().catch(() => ({}));
  await registrarPresenca(dono, {
    caminho: String(corpo?.caminho || "/").slice(0, 200),
    voltou: corpo?.voltou === true,
    aparelho: aparelhoDe(req.headers.get("user-agent")),
  }).catch((err) => console.warn("[uso] batida não gravada:", err?.message || err));
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
