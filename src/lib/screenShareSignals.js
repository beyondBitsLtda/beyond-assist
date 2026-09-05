import { supabase } from "./supabase.js";

// Transmissão: sinalização WebRTC entre dois dispositivos (ver db/schema.sql seção 25) — o
// mesmo padrão de fila curta + polling do remoteCommands.js, mas ENDEREÇADO (cada linha tem um
// destinatário) em vez de "todo dispositivo escuta". O vídeo em si nunca passa por aqui — só o
// "aperto de mão" inicial (offer/answer/ICE) até os dois navegadores conseguirem conversar
// direto (peer-to-peer).

/** Manda um sinal — `toDevice` pode ser o id real de um dispositivo, ou o pseudo-endereço
 * 'HOST' (qualquer dispositivo transmitindo agora está escutando por esse endereço também). */
export async function sendScreenShareSignal({ fromDevice, toDevice, kind, payload = {} }) {
  if (!fromDevice || !toDevice || !kind) throw new Error("fromDevice, toDevice e kind são obrigatórios");
  const { error } = await supabase
    .from("screen_share_signals")
    .insert({ from_device: fromDevice, to_device: toDevice, kind, payload });
  if (error) throw new Error(`sendScreenShareSignal: ${error.message}`);
}

/** Sinais endereçados a mim (meu deviceId real, e opcionalmente também 'HOST') mais novos que
 * `since`. Nunca devolve sinais que EU MESMO mandei (evita eco). */
export async function listScreenShareSignals({ myDevice, alsoHost = false, since }) {
  const addresses = alsoHost ? [myDevice, "HOST"] : [myDevice];
  let q = supabase
    .from("screen_share_signals")
    .select("id, from_device, to_device, kind, payload, created_at")
    .in("to_device", addresses)
    .neq("from_device", myDevice)
    .order("created_at", { ascending: true })
    .limit(50);
  if (since) q = q.gt("created_at", since);
  const { data, error } = await q;
  if (error) throw new Error(`listScreenShareSignals: ${error.message}`);
  return data || [];
}
