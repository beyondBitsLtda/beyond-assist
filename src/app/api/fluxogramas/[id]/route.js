import { donoDe, lerFluxo, salvarFluxo, arquivarFluxo } from "@/lib/fluxogramas.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ProcessMap na Lisa (01/11/2026): abrir, gravar e excluir (arquivar) um fluxograma.
// O 409 do conflito leva o fluxo como está no banco (`fluxo`), para a tela oferecer as duas saídas.
const falhou = (err) => jsonResponse({ ok: false, error: String(err?.message || err), ...(err?.fluxo ? { fluxo: err.fluxo } : {}) }, err?.status || 500);

async function comDono(req, fazer) {
  const dono = donoDe(req);
  if (!dono) return jsonResponse({ ok: false, error: "sessão sem usuário" }, 401);
  try {
    return jsonResponse({ ok: true, ...((await fazer(dono)) || {}) });
  } catch (err) {
    return falhou(err);
  }
}

/** GET /api/fluxogramas/:id → { fluxo } com o documento. */
export async function GET(req, { params }) {
  const { id } = await params;
  return comDono(req, async (dono) => ({ fluxo: await lerFluxo(dono, id) }));
}

/** PUT /api/fluxogramas/:id   { documento?, nome?, projetoId?, versao?, forcar? } → { fluxo } (sem o documento). */
export async function PUT(req, { params }) {
  const { id } = await params;
  return comDono(req, async (dono) => ({ fluxo: await salvarFluxo(dono, id, await req.json()) }));
}

/** DELETE /api/fluxogramas/:id — arquiva. */
export async function DELETE(req, { params }) {
  const { id } = await params;
  return comDono(req, (dono) => arquivarFluxo(dono, id));
}
