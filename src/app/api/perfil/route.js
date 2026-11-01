import { comDono } from "@/lib/rotaDoUsuario.js";
import { lerPerfil, salvarPerfil, apagarPerfil } from "@/lib/perfilEtarefas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O perfil da entrevista do primeiro acesso (01/11/2026, o MVP — src/lib/perfilEtarefas.js).

/** GET /api/perfil → { perfil } (null: ainda não fez a entrevista). */
export async function GET(req) {
  return comDono(req, async (dono) => ({ perfil: await lerPerfil(dono) }));
}

/** PUT /api/perfil  { consentimento: true, nome, area, nivel, objetivos, preferencias } → { perfil } */
export async function PUT(req) {
  return comDono(req, async (dono) => ({ perfil: await salvarPerfil(dono, await req.json().catch(() => ({}))) }));
}

/** DELETE /api/perfil — apaga o perfil (a pessoa pode pedir a qualquer hora). */
export async function DELETE(req) {
  return comDono(req, (dono) => apagarPerfil(dono));
}
