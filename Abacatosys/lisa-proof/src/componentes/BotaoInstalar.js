"use client";

import { useEffect, useState } from "react";
import { DICA_DO_IPHONE, estadoDaInstalacao } from "@/lib/instalarApp.js";

/**
 * "Instalar app", ao lado de Minha conta e Reportar problema (mesma cara, `pf-reportar`).
 * Só aparece quando o navegador oferece instalar (Chrome, Edge, Chrome do Android) ou no
 * iPhone, onde explica o caminho pelo Compartilhar. Já instalado, ou num navegador que não
 * instala, ele some.
 */
export default function BotaoInstalar({ comTexto = true }) {
  const [estado, setEstado] = useState({ pode: false, instalado: false, ios: false });

  useEffect(() => {
    const atualizar = () => setEstado(estadoDaInstalacao());
    atualizar();
    window.addEventListener("instalar-app", atualizar);
    return () => window.removeEventListener("instalar-app", atualizar);
  }, []);

  if (!estado.pode && !estado.ios) return null;

  async function instalar() {
    const pedido = window.__pedidoDeInstalar;
    if (!pedido) return window.alert(DICA_DO_IPHONE);
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
  }

  return (
    <button type="button" className="pf-reportar" onClick={instalar} title="Instalar o Lisa_Proof como aplicativo" aria-label="Instalar o Lisa_Proof como aplicativo">
      <span aria-hidden="true">📲</span>
      {comTexto && <span>Instalar app</span>}
    </button>
  );
}
