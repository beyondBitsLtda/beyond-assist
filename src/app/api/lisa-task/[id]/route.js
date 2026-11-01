import { comDono } from "@/lib/rotaDoUsuario.js";
import { mudarTarefa, apagarTarefa } from "@/lib/perfilEtarefas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/lisa-task/:id  { titulo?, descricao?, prioridade?, status?, lembreteEm? } → { tarefa } */
export async function PATCH(req, { params }) {
  const { id } = await params;
  return comDono(req, async (dono) => ({ tarefa: await mudarTarefa(dono, id, await req.json().catch(() => ({}))) }));
}

/** DELETE /api/lisa-task/:id */
export async function DELETE(req, { params }) {
  const { id } = await params;
  return comDono(req, (dono) => apagarTarefa(dono, id));
}
