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

// ---- personagens (visuais do Neuro comprados no Reino: src/dominio/personagens.js)
// O personagem que a pessoa usa mora no atributo data-personagem do <html> (a moldura põe, ao
// abrir o app); todo Neuro da tela segue ele, a não ser que receba `personagem` (as vitrines).
const GUARDADO = "proof-personagem";

/** Veste o Neuro de todas as telas com um personagem (e lembra neste navegador). */
export function definirPersonagem(id) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.personagem = id || "neuro";
  try { localStorage.setItem(GUARDADO, id || "neuro"); } catch { /* sem armazenamento: vale só nesta visita */ }
  window.dispatchEvent(new CustomEvent("proof-personagem", { detail: id }));
}

/** O personagem que a pessoa usa, atualizado quando ela troca. */
export function usePersonagem() {
  const [id, setId] = useState("neuro");
  useEffect(() => {
    let guardado = document.documentElement.dataset.personagem;
    if (!guardado) {
      try { guardado = localStorage.getItem(GUARDADO); } catch { /* nada */ }
      if (guardado) document.documentElement.dataset.personagem = guardado;
    }
    setId(guardado || "neuro");
    const aoTrocar = (e) => setId(e.detail || "neuro");
    window.addEventListener("proof-personagem", aoTrocar);
    return () => window.removeEventListener("proof-personagem", aoTrocar);
  }, []);
  return id;
}

export function reagir(humor, fala, duracao = 3800) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("neuro", { detail: { humor, fala, duracao } }));
}

/** Reação grande: humor de festa e confete na tela toda. */
export function comemorar(fala) {
  reagir("comemorando", fala, 5000);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("neuro-confete"));
}

/**
 * Abre a comemoração em tela cheia (componente Celebracao, na moldura) para o que o servidor
 * devolveu: ofensiva que subiu, meta batida, conquistas. Devolve se houve o que comemorar.
 */
export function celebrar(r) {
  if (!r || typeof window === "undefined") return false;
  const cartoes = [];
  if (r.ofensivaAumentou && r.ofensiva) cartoes.push({ tipo: "ofensiva", dias: r.ofensiva });
  if (r.metaBatida) cartoes.push({ tipo: "meta" });
  for (const c of r.conquistas || []) cartoes.push({ tipo: "conquista", ...c });
  if (!cartoes.length) return false;
  window.dispatchEvent(new CustomEvent("proof-celebrar", { detail: { cartoes } }));
  return true;
}

/** A reação certa para o resultado de marcar, responder ou entregar algo. */
export function reagirAoResultado(r) {
  if (!r) return;
  if (celebrar(r)) return reagir("comemorando", `+${r.pontos} pontos! 🎉`, 5000);
  // a teoria terminou, mas o assunto só conclui com o quiz dele (23/10/2026)
  if (r.cardConcluido && r.faltaQuiz) return reagir("feliz", "Teoria feita! Agora é só passar no quiz do assunto. 🧠", 5000);
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

export default function Neuro({ humor = "normal", fala = "", tamanho = 120, ouvir = false, lado = "direita", className = "", personagem }) {
  const doApp = usePersonagem();
  const visual = personagem || doApp;
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
      data-personagem={visual}
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

            {/* o Neuro Abacate (mascote do Abacato, 23/10/2026): a casca e o caroço ficam ATRÁS do rosto */}
            <g className="acc acc-abacato-fundo">
              <path d="M100 6 C 56 6, 38 44, 31 76 C 23 108, 14 128, 20 150 C 28 175, 66 182, 100 182 C 134 182, 172 175, 180 150 C 186 128, 177 108, 169 76 C 162 44, 144 6, 100 6 Z" fill="#3F6212" />
              <path d="M100 17 C 63 17, 47 50, 40 80 C 33 110, 25 130, 30 149 C 37 169, 70 173, 100 173 C 130 173, 163 169, 170 149 C 175 130, 167 110, 160 80 C 153 50, 137 17, 100 17 Z" fill="#D9F99D" />
              <circle cx="100" cy="112" r="44" fill="#B45309" />
              <circle cx="100" cy="112" r="38" fill="#F2C48D" />
              <ellipse cx="78" cy="96" rx="9" ry="5" transform="rotate(-30 78 96)" fill="#FFFFFF" opacity="0.6" />
            </g>

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

            {/* acessórios dos personagens: só o do personagem atual aparece (src/app/neuro.css) */}
            <g className="acc acc-ninja">
              <path d="M27 72 Q100 46 173 72 L173 86 Q100 60 27 86 Z" fill="#DC2626" />
              <circle cx="170" cy="79" r="6" fill="#B91C1C" />
              <path d="M172 77 q18 -6 27 4 q-13 1 -23 6 z" fill="#DC2626" />
              <path d="M172 82 q15 8 18 20 q-9 -7 -21 -12 z" fill="#B91C1C" />
            </g>
            <g className="acc acc-astronauta">
              <path d="M100 22 V4" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              <circle cx="100" cy="2" r="6" fill="#EF4444" />
              <circle cx="100" cy="94" r="84" fill="rgba(186, 230, 253, 0.22)" stroke="#E0F2FE" strokeWidth="5" />
              <path d="M44 52 q14 -24 42 -32" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
              <ellipse cx="100" cy="166" rx="46" ry="9" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="3" />
            </g>
            <g className="acc acc-mago">
              <path d="M50 46 L104 -40 L150 46 Z" fill="#5B21B6" />
              <ellipse cx="100" cy="46" rx="64" ry="12" fill="#4C1D95" />
              <path d="M92 6 l3 6 6 2 -6 2 -3 6 -3 -6 -6 -2 6 -2 z" fill="#FDE047" />
              <path d="M116 26 l2 4 4 1.5 -4 1.5 -2 4 -2 -4 -4 -1.5 4 -1.5 z" fill="#FDE047" />
              <path d="M78 30 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 z" fill="#FEF08A" />
            </g>
            <g className="acc acc-pirata">
              <path d="M34 50 Q100 -14 166 50 Q100 28 34 50 Z" fill="#111827" />
              <path d="M40 48 Q100 30 160 48" fill="none" stroke="#F59E0B" strokeWidth="4" />
              <circle cx="100" cy="24" r="7" fill="#F9FAFB" />
              <path d="M96 28 h8" stroke="#111827" strokeWidth="2" />
              <path d="M58 84 L144 88" stroke="#111827" strokeWidth="3.5" />
              <ellipse cx="86" cy="101" rx="13" ry="14" fill="#111827" />
            </g>
            <g className="acc acc-abacato">
              {/* luvas brancas de desenho animado, uma fazendo o sinal da paz */}
              <path d="M10 132 l-4 -26 a4 4 0 0 1 8 -1 l4 20 M18 128 l2 -26 a4 4 0 0 1 8 1 l-2 26" fill="#FFFFFF" stroke="#1F2937" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="16" cy="140" r="11" fill="#FFFFFF" stroke="#1F2937" strokeWidth="3" />
              <circle cx="184" cy="140" r="11" fill="#FFFFFF" stroke="#1F2937" strokeWidth="3" />
              <path d="M178 144 q6 4 12 0 M182 134 v6" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
              {/* tênis */}
              <path d="M70 176 q2 -9 14 -9 q12 0 14 9 q0 6 -6 6 h-18 q-4 0 -4 -6 z" fill="#FFFFFF" stroke="#1F2937" strokeWidth="3" />
              <path d="M102 176 q2 -9 14 -9 q12 0 14 9 q0 6 -6 6 h-18 q-4 0 -4 -6 z" fill="#FFFFFF" stroke="#1F2937" strokeWidth="3" />
              <path d="M70 180 h28 M102 180 h28" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g className="acc acc-robo">
              <path d="M100 24 V2" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />
              <circle cx="100" cy="-2" r="8" fill="#22D3EE" stroke="#0891B2" strokeWidth="3" />
              <circle cx="27" cy="104" r="8" fill="#94A3B8" stroke="#475569" strokeWidth="3" />
              <circle cx="173" cy="104" r="8" fill="#94A3B8" stroke="#475569" strokeWidth="3" />
              <path d="M62 60 h76 M70 146 h60" stroke="#64748B" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
            </g>
            {/* os dos ambientes das expedições (23/10/2026) */}
            <g className="acc acc-cogumelo">
              <path d="M14 72 C 14 -14, 186 -14, 186 72 Q 100 52, 14 72 Z" fill="#DC2626" stroke="#7F1D1D" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="60" cy="38" r="9" fill="#FFFFFF" /><circle cx="100" cy="24" r="8" fill="#FFFFFF" />
              <circle cx="140" cy="38" r="9" fill="#FFFFFF" /><circle cx="100" cy="48" r="5.5" fill="#FFFFFF" />
              <circle cx="34" cy="60" r="5" fill="#FFFFFF" /><circle cx="166" cy="60" r="5" fill="#FFFFFF" />
              <path d="M38 30 q16 -18 40 -22" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
            </g>
            <g className="acc acc-mergulhador">
              <path d="M26 98 H68 M132 98 H174" stroke="#1E293B" strokeWidth="7" strokeLinecap="round" />
              <rect x="68" y="84" width="64" height="32" rx="14" fill="rgba(165, 243, 252, 0.35)" stroke="#1E293B" strokeWidth="5" />
              <path d="M75 93 q4 -4 10 -4" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
              <path d="M116 126 H138 Q148 126 148 116 V40" fill="none" stroke="#FB923C" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M148 40 v-6" stroke="#1E293B" strokeWidth="9" strokeLinecap="round" />
              <circle cx="156" cy="22" r="4.5" fill="none" stroke="#22D3EE" strokeWidth="2.5" />
              <circle cx="146" cy="12" r="3.2" fill="none" stroke="#22D3EE" strokeWidth="2.5" />
              <circle cx="155" cy="4" r="2.3" fill="none" stroke="#22D3EE" strokeWidth="2" />
            </g>
            <g className="acc acc-yeti">
              <path d="M58 50 C 40 42, 32 24, 40 6 C 46 22, 58 32, 76 38 Z" fill="#E7E5E4" stroke="#78716C" strokeWidth="3" strokeLinejoin="round" />
              <path d="M142 50 C 160 42, 168 24, 160 6 C 154 22, 142 32, 124 38 Z" fill="#E7E5E4" stroke="#78716C" strokeWidth="3" strokeLinejoin="round" />
              <path d="M30 84 L16 90 L26 96 L12 104 L25 108 L14 118 L30 118 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M170 84 L184 90 L174 96 L188 104 L175 108 L186 118 L170 118 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M18 34 v14 M12 37.5 l12 7 M12 44.5 l12 -7 M184 52 v12 M179 55 l10 6 M179 61 l10 -6" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            </g>
            <g className="acc acc-magma">
              <g transform="translate(66 48) scale(0.62) translate(-100 -30)">
                <path d="M100 30 C 82 22, 86 2, 98 -12 C 98 2, 106 4, 110 -4 C 120 12, 116 26, 100 30 Z" fill="#F97316" stroke="#9A3412" strokeWidth="3" strokeLinejoin="round" />
                <path d="M100 25 C 92 19, 94 9, 100 1 C 102 9, 107 11, 108 7 C 112 15, 108 23, 100 25 Z" fill="#FACC15" />
              </g>
              <g transform="translate(134 48) scale(0.62) translate(-100 -30)">
                <path d="M100 30 C 82 22, 86 2, 98 -12 C 98 2, 106 4, 110 -4 C 120 12, 116 26, 100 30 Z" fill="#F97316" stroke="#9A3412" strokeWidth="3" strokeLinejoin="round" />
                <path d="M100 25 C 92 19, 94 9, 100 1 C 102 9, 107 11, 108 7 C 112 15, 108 23, 100 25 Z" fill="#FACC15" />
              </g>
              <g transform="translate(0 12)">
                <path d="M100 30 C 82 22, 86 2, 98 -12 C 98 2, 106 4, 110 -4 C 120 12, 116 26, 100 30 Z" fill="#F97316" stroke="#9A3412" strokeWidth="3" strokeLinejoin="round" />
                <path d="M100 25 C 92 19, 94 9, 100 1 C 102 9, 107 11, 108 7 C 112 15, 108 23, 100 25 Z" fill="#FACC15" />
              </g>
              <circle cx="40" cy="38" r="3" fill="#FB923C" /><circle cx="164" cy="28" r="2.5" fill="#FB923C" /><circle cx="152" cy="10" r="2" fill="#FACC15" />
            </g>
            <g className="acc acc-alienigena">
              <path d="M84 30 Q 76 16, 62 10 M116 30 Q 124 16, 138 10" fill="none" stroke="#3F6212" strokeWidth="4" strokeLinecap="round" />
              <circle cx="60" cy="9" r="7" fill="#F0ABFC" stroke="#86198F" strokeWidth="3" />
              <circle cx="140" cy="9" r="7" fill="#F0ABFC" stroke="#86198F" strokeWidth="3" />
              {/* o terceiro olho segue o humor como os outros dois: aberto, fechado de alegria ou dormindo */}
              <g className="v v-normal v-triste v-surpreso v-pensando">
                <ellipse cx="100" cy="68" rx="8" ry="9" fill="#FFFFFF" stroke="#1A2E05" strokeWidth="2.5" />
                <circle cx="100" cy="70" r="4" fill="#1F2937" />
              </g>
              <path className="v v-feliz v-comemorando" d="M92 70 q8 -9 16 0" fill="none" stroke="#1A2E05" strokeWidth="3.5" strokeLinecap="round" />
              <path className="v v-dormindo" d="M92 68 q8 6 16 0" fill="none" stroke="#1A2E05" strokeWidth="3.5" strokeLinecap="round" />
            </g>
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
