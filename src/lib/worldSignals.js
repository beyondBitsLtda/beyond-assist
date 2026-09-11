"use client";

import { getDeviceId } from "./deviceId.js";

// Canal do Modo Deus: você manda chuva, zumbis ou o Steve de um aparelho, e o Mundo da Lisa
// aberto no outro obedece.
//
// Reaproveita a fila de sinalização da Transmissão (public.screen_share_signals), exatamente
// como o jogo do disco já faz: a forma é a que precisamos — fila curta, endereçada, com payload
// jsonb e polling — e a tabela já existe. O que distingue um sinal do outro é o `kind`, e todo
// sinal daqui começa com "god-".
//
// As duas telas falam e escutam no MESMO pseudo-endereço. Funciona porque
// listScreenShareSignals já descarta o que veio do próprio dispositivo: cada lado enxerga só o
// outro. O aparelho que manda também aplica o evento localmente, então dá pra brincar sozinho
// com uma tela só — só que sem a graça de ver a cara de quem está do outro lado.
export const WORLD_ADDRESS = "MUNDO";

const PREFIX = "god-";

/** Manda um evento pro mundo. Nunca lança: perder um sinal é só perder uma chuva. */
export async function sendWorldSignal(kind, payload = {}) {
  try {
    await fetch("/api/screen-share/signal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromDevice: getDeviceId(), toDevice: WORLD_ADDRESS, kind: PREFIX + kind, payload }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Eventos mais novos que `since`. Devolve também o `now` do SERVIDOR pra usar como próximo
 * `since` — usar o relógio do navegador erraria pela diferença de horário entre a máquina e o
 * banco, e isso significaria repetir ou perder eventos.
 */
export async function pollWorldSignals(since) {
  const params = new URLSearchParams({ deviceId: getDeviceId(), alsoAddress: WORLD_ADDRESS });
  if (since) params.set("since", since);
  const res = await fetch(`/api/screen-share/signal/recent?${params}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return {
    now: data.now,
    // a fila é compartilhada com a Transmissão e com o jogo do disco: fora "god-", nada aqui é
    // da nossa conta
    signals: (data.signals || [])
      .filter((s) => typeof s.kind === "string" && s.kind.startsWith(PREFIX))
      .map((s) => ({ ...s, kind: s.kind.slice(PREFIX.length) })),
  };
}
