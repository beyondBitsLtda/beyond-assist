import { comDono } from "@/lib/rotaDoUsuario.js";
import { lerPerfil, salvarPerfil, apagarPerfil } from "@/lib/perfilEtarefas.js";
import { retratoDaPessoa } from "@/lib/gemini.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O perfil da entrevista do primeiro acesso (01/11/2026, o MVP — src/lib/perfilEtarefas.js).

/** GET /api/perfil → { perfil } (null: ainda não fez a entrevista). */
export async function GET(req) {
  return comDono(req, async (dono) => ({ perfil: await lerPerfil(dono) }));
}

/**
 * PUT /api/perfil  { consentimento: true, nome?, area?, nivel?, objetivos?, preferencias?, retrato? }
 * → { perfil }. Junta com o que já existe. `retrato: true` (ao fim de cada etapa da entrevista): a
 * Lisa reescreve o retrato da pessoa com tudo o que ela contou — se o modelo falhar, o perfil fica
 * guardado sem o retrato novo.
 */
export async function PUT(req) {
  return comDono(req, async (dono) => {
    const dados = await req.json().catch(() => ({}));
    let perfil = await salvarPerfil(dono, dados);
    if (dados.retrato === true) {
      const retrato = await retratoDaPessoa(perfil).catch(() => "");
      if (retrato) perfil = await salvarPerfil(dono, { consentimento: true, preferencias: { retrato } });
    }
    return { perfil };
  });
}

/** DELETE /api/perfil — apaga o perfil (a pessoa pode pedir a qualquer hora). */
export async function DELETE(req) {
  return comDono(req, (dono) => apagarPerfil(dono));
}
