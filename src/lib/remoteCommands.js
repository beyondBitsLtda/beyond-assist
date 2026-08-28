import { supabase } from "./supabase.js";

/**
 * Comandos remotos entre dispositivos — "abre o dashboard" falado no celular navega os
 * OUTROS dispositivos com o app aberto. Fila curta no Postgres (public.remote_commands):
 * quem manda insere uma linha; quem escuta (todo dispositivo, ver
 * src/components/shell/RemoteCommandListener.js) faz polling rápido perguntando "tem algo
 * mais novo que X que não veio de mim?" — sem precisar marcar como "lido".
 */

/** Manda um comando de navegação — os outros dispositivos (não o `originDevice`) navegam pra `target`. */
export async function sendRemoteCommand({ target, originDevice }) {
  if (!target || !originDevice) throw new Error("target e originDevice são obrigatórios");
  const { error } = await supabase
    .from("remote_commands")
    .insert({ action: "navigate", target, origin_device: originDevice });
  if (error) throw new Error(`sendRemoteCommand: ${error.message}`);
}

/** Comandos mais novos que `since`, que não vieram do próprio dispositivo que está perguntando. */
export async function listRecentCommands({ since, excludeDevice }) {
  let q = supabase
    .from("remote_commands")
    .select("action, target, origin_device, created_at")
    .order("created_at", { ascending: true })
    .limit(10);
  if (since) q = q.gt("created_at", since);
  if (excludeDevice) q = q.neq("origin_device", excludeDevice);
  const { data, error } = await q;
  if (error) throw new Error(`listRecentCommands: ${error.message}`);
  return data || [];
}
