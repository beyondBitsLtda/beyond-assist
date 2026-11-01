import { comDono } from "@/lib/rotaDoUsuario.js";
import { listarTarefas, criarTarefa } from "@/lib/perfilEtarefas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A Lisa Task leve (01/11/2026, o MVP — src/lib/perfilEtarefas.js): as tarefas da pessoa, só texto.

/** GET /api/lisa-task → { tarefas } */
export async function GET(req) {
  return comDono(req, async (dono) => ({ tarefas: await listarTarefas(dono) }));
}

/** POST /api/lisa-task  { titulo, descricao?, prioridade?, lembreteEm? } → { tarefa } */
export async function POST(req) {
  return comDono(req, async (dono) => ({ tarefa: await criarTarefa(dono, await req.json().catch(() => ({}))) }));
}
