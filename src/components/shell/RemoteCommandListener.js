"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/deviceId.js";

const POLL_MS = 3000; // rápido de propósito — é um "controle remoto", precisa parecer instantâneo

/**
 * Escuta comandos remotos vindos de OUTROS dispositivos (ver src/lib/remoteCommands.js) e
 * navega este aqui quando um chega — ex.: "abre o dashboard" falado no celular navega o
 * desktop/TV que estão com essa tela montada (todo painel, via Shell.js).
 */
export default function RemoteCommandListener() {
  const router = useRouter();
  const sinceRef = useRef(null);
  const bootstrappedRef = useRef(false);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      const deviceId = getDeviceId();
      const qs = new URLSearchParams({ deviceId, ...(sinceRef.current ? { since: sinceRef.current } : {}) });
      const res = await fetch(`/api/remote-command/recent?${qs}`);
      const data = await res.json();
      if (!data.ok) return;

      if (!bootstrappedRef.current) {
        // 1ª checagem: só marca o ponto de partida, não executa comandos de antes de abrir
        bootstrappedRef.current = true;
        sinceRef.current = data.now;
        return;
      }

      sinceRef.current = data.now;
      const last = (data.commands || []).filter((c) => c.action === "navigate").pop();
      if (last?.target) router.push(last.target);
    } catch {
      // silencioso — tenta de novo no próximo ciclo
    }
  }, [router]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [check]);

  return null;
}
