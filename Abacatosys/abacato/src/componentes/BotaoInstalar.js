"use client";

import { useEffect, useState } from "react";
import { DICA_DO_IPHONE, estadoDaInstalacao } from "@/lib/instalarApp.js";

/**
 * "Instalar app", na faixa do topo. Só aparece quando o navegador oferece instalar (Chrome,
 * Edge, Chrome do Android) ou no iPhone, onde explica o caminho pelo Compartilhar. Já
 * instalado, ou num navegador que não instala, ele some — um botão que não faz nada é pior
 * que nenhum.
 */
export default function BotaoInstalar() {
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
    <button type="button" className="abacato-topo__sair abacato-topo__instalar" title="Instalar o Abacato como aplicativo" onClick={instalar}>
      <span aria-hidden="true">⤓</span>
      <span className="abacato-topo__sair-texto">Instalar app</span>
    </button>
  );
}
