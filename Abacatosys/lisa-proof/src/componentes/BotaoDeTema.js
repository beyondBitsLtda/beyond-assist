"use client";

import { useEffect, useState } from "react";

/**
 * Troca o tema: escuro → claro → sistema. O escuro é o padrão.
 *
 * Quem aplica o tema na primeira pintura é o script do <head> (src/app/layout.js), antes do
 * React: aplicar só aqui, num efeito, faria a página piscar clara a cada carregamento.
 */
export const CHAVE_DO_TEMA = "proof-tema";
const ORDEM = ["escuro", "claro", "sistema"];
const ROTULOS = { escuro: "Tema escuro", claro: "Tema claro", sistema: "Tema do sistema" };
const ICONES = { escuro: "🌙", claro: "☀️", sistema: "🖥️" };

function lerEscolha() {
  try {
    const v = localStorage.getItem(CHAVE_DO_TEMA);
    return ORDEM.includes(v) ? v : "escuro";
  } catch {
    return "escuro";
  }
}

function aplicar(escolha) {
  const escuro = escolha === "escuro" || (escolha === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
}

export default function BotaoDeTema({ comTexto = false }) {
  const [escolha, setEscolha] = useState(null);

  useEffect(() => setEscolha(lerEscolha()), []);

  // No modo "sistema", acompanha o aparelho trocando de claro para escuro com a página aberta.
  useEffect(() => {
    if (escolha !== "sistema") return undefined;
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const seguir = () => aplicar("sistema");
    consulta.addEventListener("change", seguir);
    return () => consulta.removeEventListener("change", seguir);
  }, [escolha]);

  function trocar() {
    const proxima = ORDEM[(ORDEM.indexOf(escolha || "escuro") + 1) % ORDEM.length];
    setEscolha(proxima);
    aplicar(proxima);
    try {
      localStorage.setItem(CHAVE_DO_TEMA, proxima);
    } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  const atual = escolha || "escuro";
  return (
    <button
      type="button"
      className={comTexto ? "pf-tema pf-tema--texto" : "pf-tema"}
      onClick={trocar}
      aria-label={`${ROTULOS[atual]} (toque para trocar)`}
      title={`${ROTULOS[atual]} — toque para trocar`}
    >
      <span aria-hidden="true">{ICONES[atual]}</span>
      {comTexto && <span>{ROTULOS[atual]}</span>}
    </button>
  );
}
