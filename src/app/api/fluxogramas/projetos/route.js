import { donoDe, criarProjeto, mudarProjeto, arquivarProjeto, lerProjeto } from "@/lib/fluxogramas.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ProcessMap na Lisa (01/11/2026): ler (com os documentos), criar, renomear e excluir (arquivar) projetos.
const falhou = (err) => jsonResponse({ ok: false, error: String(err?.message || err) }, err?.status || 500);

async function comDono(req, fazer) {
  const dono = donoDe(req);
  if (!dono) return jsonResponse({ ok: false, error: "sessão sem usuário" }, 401);
  try {
    return jsonResponse({ ok: true, ...((await fazer(dono)) || {}) });
  } catch (err) {
    return falhou(err);
  }
}

/** GET /api/fluxogramas/projetos?id=… → { projeto, fluxos } com os documentos (a Lisa trabalhando no projeto). */
export async function GET(req) {
  return comDono(req, (dono) => lerProjeto(dono, new URL(req.url).searchParams.get("id")));
}

/** POST /api/fluxogramas/projetos   { nome, descricao? } → { projeto } */
export async function POST(req) {
  return comDono(req, async (dono) => ({ projeto: await criarProjeto(dono, await req.json()) }));
}

/** PATCH /api/fluxogramas/projetos   { id, nome?, descricao? } */
export async function PATCH(req) {
  return comDono(req, async (dono) => {
    const { id, nome, descricao } = await req.json();
    await mudarProjeto(dono, id, { nome, descricao });
  });
}

/** DELETE /api/fluxogramas/projetos?id=… — arquiva o projeto e os fluxos dele. */
export async function DELETE(req) {
  return comDono(req, (dono) => arquivarProjeto(dono, new URL(req.url).searchParams.get("id")));
}
