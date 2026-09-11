"use client";

import { getDeviceId } from "./deviceId.js";

// Canal do jogo do disco (Modo Interativo → "Lançar Disco pra Nala"): uma tela lança, a outra
// tem a Nala e pega no ar.
//
// Reaproveita a fila de sinalização da Transmissão (public.screen_share_signals) em vez de criar
// tabela nova: a forma é exatamente a que precisamos — fila curta, ENDEREÇADA, com payload jsonb
// e polling — e essa tabela já existe no banco. O que distingue um sinal do outro é o `kind`, e
// todo sinal daqui começa com "disc-".
//
// As duas telas escutam e falam no MESMO pseudo-endereço. Funciona porque
// listScreenShareSignals já descarta o que veio do próprio dispositivo: cada lado enxerga só o
// outro. Com mais de dois aparelhos abertos no jogo eles se atrapalhariam — é um jogo de duas
// telas, e está tudo bem assim.
export const DISC_ADDRESS = "DISCO";

const PREFIX = "disc-";

/** Manda um sinal do jogo pra outra tela. Nunca lança: perder um sinal é só perder um lance. */
export async function sendDiscSignal(kind, payload = {}) {
  try {
    await fetch("/api/screen-share/signal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromDevice: getDeviceId(), toDevice: DISC_ADDRESS, kind: PREFIX + kind, payload }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sinais do jogo mais novos que `since`. Devolve também o `now` do SERVIDOR pra usar como
 * próximo `since` — usar o relógio do navegador aqui erraria por diferença de horário entre
 * a máquina e o banco, e isso significaria repetir ou perder lances.
 */
export async function pollDiscSignals(since) {
  const params = new URLSearchParams({ deviceId: getDeviceId(), alsoAddress: DISC_ADDRESS });
  if (since) params.set("since", since);
  const res = await fetch(`/api/screen-share/signal/recent?${params}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return {
    now: data.now,
    // a fila é compartilhada com a Transmissão: fora "disc-", nada aqui é da nossa conta
    signals: (data.signals || [])
      .filter((s) => typeof s.kind === "string" && s.kind.startsWith(PREFIX))
      .map((s) => ({ ...s, kind: s.kind.slice(PREFIX.length) })),
  };
}
