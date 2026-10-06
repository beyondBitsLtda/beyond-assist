"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O Neuro — o mascote da Lisa_Proof. Um cérebro desenhado em SVG, animado só com CSS
 * (src/app/neuro.css), sem biblioteca de animação.
 *
 * Os humores são classes no elemento raiz (`neuro--feliz`, `neuro--triste`...). Cada pedaço do
 * desenho que só existe num humor tem a classe `v` mais `v-<humor>`, e o CSS mostra só o que
 * casa com o humor atual. Trocar de humor é trocar uma classe; não há estado de animação em JS.
 *
 * Reações vêm de qualquer lugar por evento de janela: `reagir("feliz", "+10!")` faz o Neuro da
 * tela (o que tiver `ouvir`) mudar de humor e falar por alguns segundos, e depois voltar ao humor
 * que a página deu a ele.
 */

export const HUMORES = ["normal", "feliz", "comemorando", "triste", "pensando", "dormindo", "surpreso"];

export function reagir(humor, fala, duracao = 3800) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("neuro", { detail: { humor, fala, duracao } }));
}

/** Reação grande: humor de festa e confete na tela toda. */
export function comemorar(fala) {
  reagir("comemorando", fala, 5000);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("neuro-confete"));
}

/** A reação certa para o resultado de marcar, responder ou entregar algo. */
export function reagirAoResultado(r) {
  if (!r) return;
  if (r.metaBatida) return comemorar(`Meta do dia batida! +${r.pontos} pontos 🎉`);
  if (r.cardConcluido && r.pontos > 0) return comemorar(`Assunto concluído! +${r.pontos} pontos`);
  if (r.pontos > 0) return reagir("feliz", `+${r.pontos}! Mandou bem!`);
  if (r.pontos < 0) return reagir("surpreso", "Desmarcou? Sem problema, os pontos voltam quando refizer.");
}

const CUTUCADAS = [
  "Oi! Eu sou o Neuro, seu parceiro de estudos. 🧠",
  "Um pouquinho por dia vence muito estudo de uma vez só.",
  "Sabia que explicar em voz alta ajuda a fixar? Tenta comigo!",
  "Errar no quiz faz parte. É assim que a gente aprende.",
  "Cuidado com a ofensiva, hein! 🔥",
  "Hoje é um ótimo dia para fechar um assunto.",
  "Faz cócegas! 😆",
];

export default function Neuro({ humor = "normal", fala = "", tamanho = 120, ouvir = false, lado = "direita", className = "" }) {
  const [reacao, setReacao] = useState(null);
  const [cutucado, setCutucado] = useState(false);
  const timer = useRef(null);
  const indice = useRef(0);

  useEffect(() => {
    if (!ouvir) return undefined;
    function aoReagir(e) {
      setReacao({ humor: e.detail.humor, fala: e.detail.fala });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setReacao(null), e.detail.duracao || 3800);
    }
    window.addEventListener("neuro", aoReagir);
    return () => {
      window.removeEventListener("neuro", aoReagir);
      clearTimeout(timer.current);
    };
  }, [ouvir]);

  function cutucar() {
    setCutucado(false);
    requestAnimationFrame(() => setCutucado(true));
    const frase = CUTUCADAS[indice.current++ % CUTUCADAS.length];
    setReacao({ humor: "feliz", fala: frase });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setReacao(null), 3200);
  }

  const atual = HUMORES.includes(reacao?.humor) ? reacao.humor : HUMORES.includes(humor) ? humor : "normal";
  const texto = reacao ? reacao.fala : fala;

  return (
    <div
      className={`neuro neuro--${atual} neuro--fala-${lado}${cutucado ? " neuro--cutucado" : ""} ${className}`}
      style={{ "--neuro-tamanho": `${tamanho}px` }}
    >
      <button type="button" className="neuro__botao" onClick={cutucar} onAnimationEnd={() => setCutucado(false)} aria-label="Neuro, o mascote. Toque para ele falar.">
        <svg className="neuro__svg" viewBox="0 0 200 200" aria-hidden="true">
          <ellipse className="neuro__sombra" cx="100" cy="190" rx="44" ry="6" />

          <g className="neuro__boneco">
            {/* pernas */}
            <path d="M86 150 v24 M114 150 v24" className="neuro__traco" strokeWidth="7" />
            <ellipse cx="82" cy="178" rx="11" ry="5.5" className="neuro__pe" />
            <ellipse cx="118" cy="178" rx="11" ry="5.5" className="neuro__pe" />

            {/* braços — atrás do corpo, saindo dos lados */}
            <g className="neuro__braco neuro__braco--esq">
              <path d="M36 118 q-14 6 -19 20" className="neuro__traco" strokeWidth="7" />
              <circle cx="16" cy="140" r="7.5" className="neuro__mao" />
            </g>
            <g className="neuro__braco neuro__braco--dir">
              <path d="M164 118 q14 6 19 20" className="neuro__traco" strokeWidth="7" />
              <circle cx="184" cy="140" r="7.5" className="neuro__mao" />
            </g>

            {/* o cérebro: contorno (círculos maiores) por baixo, recheio por cima */}
            <g className="neuro__contorno">
              <circle cx="72" cy="72" r="35" /><circle cx="100" cy="60" r="37" /><circle cx="128" cy="72" r="35" />
              <circle cx="58" cy="102" r="33" /><circle cx="142" cy="102" r="33" />
              <circle cx="78" cy="126" r="35" /><circle cx="122" cy="126" r="35" /><circle cx="100" cy="100" r="45" />
            </g>
            <g className="neuro__massa">
              <circle cx="72" cy="72" r="30" /><circle cx="100" cy="60" r="32" /><circle cx="128" cy="72" r="30" />
              <circle cx="58" cy="102" r="28" /><circle cx="142" cy="102" r="28" />
              <circle cx="78" cy="126" r="30" /><circle cx="122" cy="126" r="30" /><circle cx="100" cy="100" r="40" />
            </g>
            <g className="neuro__dobras">
              <path d="M100 30 C 95 42, 105 50, 100 64" />
              <path d="M56 72 q8 -11 19 -5" /><path d="M86 44 q10 -7 21 -1" /><path d="M122 62 q11 -8 21 3" />
              <path d="M42 100 q6 -9 15 -6" /><path d="M146 94 q9 2 12 11" />
              <path d="M62 136 q9 7 17 2" /><path d="M120 140 q9 2 17 -7" />
            </g>
            <ellipse cx="72" cy="54" rx="11" ry="5" transform="rotate(-25 72 54)" className="neuro__brilho-pele" />

            {/* rosto */}
            <ellipse cx="73" cy="119" rx="8" ry="5" className="neuro__bochecha" />
            <ellipse cx="127" cy="119" rx="8" ry="5" className="neuro__bochecha" />

            <g className="v v-normal v-triste v-surpreso v-pensando">
              <g className="neuro__olhos">
                <ellipse cx="86" cy="100" rx="10" ry="12" className="neuro__olho" />
                <ellipse cx="114" cy="100" rx="10" ry="12" className="neuro__olho" />
                <g className="neuro__pupilas">
                  <circle cx="87" cy="103" r="5.5" className="neuro__pupila" />
                  <circle cx="115" cy="103" r="5.5" className="neuro__pupila" />
                  <circle cx="89" cy="100" r="1.9" fill="#FFFFFF" />
                  <circle cx="117" cy="100" r="1.9" fill="#FFFFFF" />
                </g>
              </g>
            </g>
            <path className="v v-feliz v-comemorando neuro__linha" d="M77 103 q9 -11 18 0 M105 103 q9 -11 18 0" />
            <path className="v v-dormindo neuro__linha" d="M77 101 q9 7 18 0 M105 101 q9 7 18 0" />

            <path className="v v-triste neuro__linha" d="M76 90 l14 -6 M124 90 l-14 -6" strokeWidth="3" />
            <path className="v v-surpreso neuro__linha" d="M77 82 q9 -6 18 0 M105 82 q9 -6 18 0" strokeWidth="3" />
            <path className="v v-pensando neuro__linha" d="M77 86 q9 -3 18 1 M105 82 q9 -6 18 -2" strokeWidth="3" />

            <path className="v v-normal neuro__linha" d="M91 119 q9 8 18 0" />
            <g className="v v-feliz v-comemorando">
              <path d="M86 116 q14 19 28 0 z" className="neuro__boca" />
              <path d="M93 124 q7 6 14 0 q-7 -4 -14 0 z" className="neuro__lingua" />
            </g>
            <path className="v v-triste neuro__linha" d="M90 127 q10 -8 20 0" />
            <ellipse className="v v-surpreso neuro__boca" cx="100" cy="123" rx="5" ry="6.5" />
            <path className="v v-pensando neuro__linha" d="M92 123 q4 -3 8 0 q4 3 8 0" />
            <path className="v v-dormindo neuro__linha" d="M95 122 h10" />

            {/* extras por humor */}
            <path className="v v-triste neuro__lagrima" d="M131 106 q5 8 0 11 q-5 -3 0 -11 z" />
          </g>

          <g className="v v-comemorando v-feliz neuro__estrelas">
            <path d="M34 50 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
            <path d="M168 44 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
            <path d="M172 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
            <path d="M24 146 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
          </g>
          <g className="v v-dormindo neuro__zzz">
            <text x="150" y="58">z</text><text x="162" y="42">z</text><text x="176" y="24">Z</text>
          </g>
          <g className="v v-pensando neuro__pensar">
            <circle cx="152" cy="46" r="4" /><circle cx="164" cy="34" r="5.5" /><circle cx="180" cy="20" r="7" />
          </g>
        </svg>
      </button>
      {texto ? <div className="neuro__fala" role="status" aria-live="polite">{texto}</div> : null}
    </div>
  );
}

/** Confete na tela toda quando alguém chama `comemorar()`. Montado uma vez, na moldura. */
export function Confete() {
  const [rodada, setRodada] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    function soltar() {
      setRodada((r) => r + 1);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setRodada(0), 2600);
    }
    window.addEventListener("neuro-confete", soltar);
    return () => {
      window.removeEventListener("neuro-confete", soltar);
      clearTimeout(timer.current);
    };
  }, []);

  if (!rodada) return null;
  const cores = ["#22C55E", "#EC4899", "#EAB308", "#2362D3", "#A855F7", "#F97316"];
  return (
    <div className="confete" key={rodada} aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={i}
          className="confete__pedaco"
          style={{
            left: `${(i * 37) % 100}%`,
            background: cores[i % cores.length],
            animationDelay: `${(i % 12) * 0.05}s`,
            animationDuration: `${1.6 + (i % 5) * 0.2}s`,
            "--giro": `${(i % 2 ? 1 : -1) * (360 + (i % 4) * 120)}deg`,
            "--deriva": `${((i % 7) - 3) * 18}px`,
          }}
        />
      ))}
    </div>
  );
}
