import { donoDe, listarVersoes, voltarVersao } from "@/lib/fluxogramas.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// As versões anteriores de um fluxograma (01/11/2026): listar e voltar para uma delas. Quem guarda as
// versões é a gravação (src/lib/fluxogramas.js: salvarFluxo → guardarVersao).
async function comDono(req, fazer) {
  const dono = donoDe(req);
  if (!dono) return jsonResponse({ ok: false, error: "sessão sem usuário" }, 401);
  try {
    return jsonResponse({ ok: true, ...((await fazer(dono)) || {}) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, err?.status || 500);
  }
}

/** GET /api/fluxogramas/:id/versoes → { versoes: [{ id, versao, nome, formas, modo, motivo, criadoEm }] } */
export async function GET(req, { params }) {
  const { id } = await params;
  return comDono(req, async (dono) => ({ versoes: await listarVersoes(dono, id) }));
}

/** POST /api/fluxogramas/:id/versoes   { versaoId } → { fluxo } — volta para essa versão (a de agora fica guardada). */
export async function POST(req, { params }) {
  const { id } = await params;
  return comDono(req, async (dono) => {
    const { versaoId } = await req.json().catch(() => ({}));
    return { fluxo: await voltarVersao(dono, id, versaoId) };
  });
}
