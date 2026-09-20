"use client";

import { useEffect, useState } from "react";

/**
 * Claro, escuro ou o que o sistema operacional disser.
 *
 * ERA UM BOTÃO SÓ, QUE CICLAVA ENTRE OS TRÊS. Parecia elegante e tinha um defeito que só
 * aparece usando: partindo de "escuro", o clique seguinte ia para "sistema" — e se o sistema
 * operacional também estivesse no escuro, NADA mudava na tela. O botão parecia quebrado, e
 * não estava; ele tinha acabado de fazer exatamente o que prometia.
 *
 * Três opções visíveis, com a atual marcada, acabam com o problema: você vê onde está antes
 * de clicar, e o que escolheu depois.
 *
 * O valor é lido de novo no `<head>`, antes de a página pintar (ver layout.js). Este
 * componente GRAVA e aplica — se ele também fosse quem aplica na carga, haveria um flash
 * branco a cada abertura no modo escuro.
 */
const OPCOES = [
  { valor: "claro", rotulo: "Claro", icone: "☀" },
  { valor: "escuro", rotulo: "Escuro", icone: "☾" },
  { valor: "sistema", rotulo: "Sistema", icone: "◑" },
];

function aplicar(escolha) {
  const escuro = escolha === "escuro" ||
    (escolha === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
}

export default function SeletorDeTema() {
  const [tema, setTema] = useState(null);

  useEffect(() => {
    let escolha = "sistema";
    try {
      escolha = localStorage.getItem("abacato-tema") || "sistema";
    } catch { /* armazenamento bloqueado — fica em sistema */ }
    setTema(escolha);

    // Em "sistema", seguir o sistema de VERDADE: se você trocar o tema do computador com a
    // aba aberta, a tela acompanha. Sem este ouvinte, "sistema" só valia no carregamento — e
    // a opção prometia uma coisa e entregava outra até alguém recarregar a página.
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const seguir = () => {
      let atual = "sistema";
      try { atual = localStorage.getItem("abacato-tema") || "sistema"; } catch { /* idem */ }
      if (atual === "sistema") aplicar("sistema");
    };
    consulta.addEventListener("change", seguir);
    return () => consulta.removeEventListener("change", seguir);
  }, []);

  function trocar(novo) {
    setTema(novo);
    try {
      if (novo === "sistema") localStorage.removeItem("abacato-tema");
      else localStorage.setItem("abacato-tema", novo);
    } catch { /* não poder lembrar a escolha não pode impedir de aplicá-la agora */ }
    aplicar(novo);
  }

  return (
    <div className="abacato-tema" role="group" aria-label="Tema da interface">
      {OPCOES.map((o) => {
        // Até o `useEffect` rodar não se sabe qual está valendo, e marcar um chute faria a
        // seleção pular na frente de quem está olhando.
        const ativa = tema === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            className={`abacato-tema__opcao${ativa ? " abacato-tema__opcao--ativa" : ""}`}
            onClick={() => trocar(o.valor)}
            aria-pressed={ativa}
            title={o.valor === "sistema" ? "Seguir o tema do computador" : `Tema ${o.rotulo.toLowerCase()}`}
          >
            <span className="abacato-tema__icone" aria-hidden="true">{o.icone}</span>
            <span className="abacato-tema__texto">{o.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
