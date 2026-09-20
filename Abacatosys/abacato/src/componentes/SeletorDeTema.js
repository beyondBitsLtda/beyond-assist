"use client";

import { useEffect, useState } from "react";

/**
 * Claro, escuro ou o que o sistema operacional disser.
 *
 * O valor escolhido é lido de novo no `<head>`, antes de a página pintar (ver layout.js). Este
 * componente só GRAVA e mostra o estado — se ele também fosse quem aplica, haveria um flash
 * branco a cada carregamento no modo escuro.
 */
const OPCOES = [
  { valor: "claro", rotulo: "Claro", icone: "☀" },
  { valor: "escuro", rotulo: "Escuro", icone: "☾" },
  { valor: "sistema", rotulo: "Sistema", icone: "◑" },
];

export default function SeletorDeTema() {
  const [tema, setTema] = useState("sistema");

  useEffect(() => {
    try {
      setTema(localStorage.getItem("abacato-tema") || "sistema");
    } catch { /* armazenamento bloqueado — fica em sistema */ }
  }, []);

  function trocar(novo) {
    setTema(novo);
    try {
      if (novo === "sistema") localStorage.removeItem("abacato-tema");
      else localStorage.setItem("abacato-tema", novo);
    } catch { /* não poder lembrar a escolha não pode impedir de aplicá-la agora */ }

    const escuro = novo === "escuro" ||
      (novo === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
  }

  const atual = OPCOES.find((o) => o.valor === tema) || OPCOES[2];
  const proximo = OPCOES[(OPCOES.indexOf(atual) + 1) % OPCOES.length];

  return (
    <button
      type="button"
      className="abacato-barra-lateral__item"
      onClick={() => trocar(proximo.valor)}
      title={`Tema: ${atual.rotulo}. Clique para ${proximo.rotulo.toLowerCase()}.`}
    >
      <span className="abacato-barra-lateral__icone">{atual.icone}</span>
      {atual.rotulo}
    </button>
  );
}
