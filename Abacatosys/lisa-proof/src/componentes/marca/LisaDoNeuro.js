// O avatar "Lisa" (31/10/2026): o mascote da marca vestido de Neuro — no selo de papel, como o logo,
// e com as expressões de cada humor por cima do desenho (o traço original não tem boca): a boca,
// as bochechas, a lágrima, os olhos fechados, as estrelinhas. Vai dentro do <svg> do Neuro
// (viewBox 0 0 200 200); cada pedaço de um humor tem `v v-<humor>`, como no cérebro, e as cores
// vêm do CSS (src/app/neuro.css) — o Reino 3D copia os estilos calculados para o boneco de papel.

import { CONTORNOS_DO_MASCOTE, PUPILAS_DO_MASCOTE } from "./desenhoDoMascote.js";

const TINTA = CONTORNOS_DO_MASCOTE.map((c) => c.d).join(" ");
// o desenho (viewBox 6.85 8.35 82 82) num quadrado de 150 centrado no selo
const ENCAIXE = "translate(25 19) scale(1.8293) translate(-6.85 -8.35)";

export default function LisaDoNeuro() {
  return (
    <g className="neuro__boneco neuro__lisa">
      <circle cx="100" cy="94" r="84" className="neuro__lisa-papel" />
      <g transform={ENCAIXE}>
        {/* bochechas (por baixo do traço) */}
        <g className="v v-feliz v-comemorando">
          <ellipse cx="51.5" cy="63.5" rx="4.2" ry="2.6" className="neuro__lisa-bochecha" />
          <ellipse cx="76.5" cy="61.5" rx="2.6" ry="2.2" className="neuro__lisa-bochecha" />
        </g>
        <path d={TINTA} fillRule="evenodd" className="neuro__lisa-tinta" />
        {PUPILAS_DO_MASCOTE.map((p, i) => <path key={i} d={p.d} className="neuro__lisa-tinta neuro__lisa-pupila" />)}

        {/* as bocas */}
        <path d="M62 68.8 q4 2.6 8 0" className="v v-normal neuro__lisa-boca" />
        <path d="M60.6 68 q5.4 4.8 10.8 0" className="v v-feliz neuro__lisa-boca" />
        <path d="M60 67.2 q6 7.5 12 0 z" className="v v-comemorando neuro__lisa-tinta" />
        <path d="M61.2 71.4 q4.4 -3.2 8.8 0" className="v v-triste neuro__lisa-boca" />
        <path d="M62.6 69.8 l6.4 -1.4" className="v v-pensando neuro__lisa-boca" />
        <ellipse cx="66" cy="69.4" rx="2" ry="2.6" className="v v-surpreso neuro__lisa-tinta" />
        <path d="M63 69.2 q3 1.2 6 0" className="v v-dormindo neuro__lisa-boca" />

        {/* triste: a lágrima; dormindo: os olhos fechados e os zz; pensando: as bolinhas */}
        <path d="M55 60 q-3 4.6 0 6.8 q3 -2.2 0 -6.8 z" className="v v-triste neuro__lisa-lagrima" />
        <g className="v v-dormindo">
          <path d="M57.4 50.4 q2.6 2.2 5.2 0 M71.8 49 q2.2 1.8 4.4 0" className="neuro__lisa-boca" />
          <text x="80" y="26" className="neuro__lisa-zz">z</text>
          <text x="86" y="18" className="neuro__lisa-zz neuro__lisa-zz--grande">z</text>
        </g>
        <g className="v v-pensando neuro__lisa-pensar">
          <circle cx="84" cy="34" r="1.6" /><circle cx="88.5" cy="27.5" r="2.2" /><circle cx="93.5" cy="20" r="2.9" />
        </g>
        <g className="v v-comemorando neuro__lisa-brilho">
          <path d="M14 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" />
          <path d="M90 64 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" />
          <path d="M86 14 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" />
        </g>
      </g>
    </g>
  );
}
