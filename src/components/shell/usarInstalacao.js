"use client";

import { useCallback, useEffect, useState } from "react";
import { DICA_DO_IPHONE, estadoDaInstalacao } from "@/lib/instalarApp.js";

/**
 * O estado do "Instalar app" (ver src/lib/instalarApp.js) e a ação de instalar. `instalar()`
 * abre a janela do próprio navegador; no iPhone, que não tem essa janela, mostra o caminho.
 */
export default function usarInstalacao() {
  const [estado, setEstado] = useState({ pode: false, instalado: false, ios: false });

  useEffect(() => {
    const atualizar = () => setEstado(estadoDaInstalacao());
    atualizar();
    window.addEventListener("instalar-app", atualizar);
    const janela = window.matchMedia?.("(display-mode: standalone)");
    janela?.addEventListener?.("change", atualizar);
    return () => {
      window.removeEventListener("instalar-app", atualizar);
      janela?.removeEventListener?.("change", atualizar);
    };
  }, []);

  const instalar = useCallback(async () => {
    const pedido = window.__pedidoDeInstalar;
    if (!pedido) {
      if (estadoDaInstalacao().ios) window.alert(DICA_DO_IPHONE);
      return;
    }
    // O pedido só vale uma vez; se a pessoa recusar, o Chrome manda outro mais tarde. Se a
    // janela nem abrir (o Chrome exige que venha de um toque), o pedido volta para a gaveta.
    window.__pedidoDeInstalar = null;
    try {
      await pedido.prompt();
    } catch {
      window.__pedidoDeInstalar = pedido;
      return;
    }
    await pedido.userChoice.catch(() => null);
    setEstado(estadoDaInstalacao());
  }, []);

  return { ...estado, instalar };
}
