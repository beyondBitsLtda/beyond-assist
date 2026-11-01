import { donoDe, listar, criarFluxo } from "@/lib/fluxogramas.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ProcessMap na Lisa (01/11/2026): os projetos e fluxogramas de quem está logado (src/lib/fluxogramas.js).
const falhou = (err) => jsonResponse({ ok: false, error: String(err?.message || err), ...(err?.fluxo ? { fluxo: err.fluxo } : {}) }, err?.status || 500);

/** GET /api/fluxogramas — { projetos: [{ id, nome, descricao, atualizadoEm, fluxos: [...] }] } (sem os documentos). */
export async function GET(req) {
  const dono = donoDe(req);
  if (!dono) return jsonResponse({ ok: false, error: "sessão sem usuário" }, 401);
  try {
    return jsonResponse({ ok: true, projetos: await listar(dono) });
  } catch (err) {
    return falhou(err);
  }
}

/**
 * POST /api/fluxogramas — guarda um fluxo novo.
 *   { documento, nome?, projetoId? | projetoNovo?, origem?: "pessoa" | "lisa" }
 * Devolve { fluxo, projeto }.
 */
export async function POST(req) {
  const dono = donoDe(req);
  if (!dono) return jsonResponse({ ok: false, error: "sessão sem usuário" }, 401);
  try {
    const body = await req.json();
    return jsonResponse({ ok: true, ...(await criarFluxo(dono, body || {})) });
  } catch (err) {
    return falhou(err);
  }
}
