// O avatar "Lisa" (31/10/2026): o mascote da marca como bonequinha de corpo inteiro, como os outros
// avatares do Neuro — a cabeça é o desenho do logo, colorida (cabelo, rosto, lentes, brinco), com o
// corpo por baixo (roupa verde, braços, pernas e sapatos). Cada humor tem a sua boca e a sua pose
// dos braços; os pedaços de um humor têm `v v-<humor>`, como no cérebro, e as cores vêm do CSS
// (src/app/neuro.css) — o Reino 3D copia os estilos calculados para o boneco de papel.

import { CONTORNOS_DO_MASCOTE, PUPILAS_DO_MASCOTE, REGIOES_DO_MASCOTE as R } from "./desenhoDoMascote.js";

const TINTA = CONTORNOS_DO_MASCOTE.map((c) => c.d).join(" ");
// a cabeça: o queixo do desenho (55, 77) cai no pescoço (100, 118), um pouco maior que o original
const CABECA = "translate(17.5 2.5) scale(1.5)";

/** Um braço: do ombro até a mão (cor de pele com contorno, para aparecer no fundo claro e no escuro), e a mão. */
const Braco = ({ d, mao: [x, y], humores }) => (
  <g className={`v ${humores}`}>
    <path d={d} className="neuro__lisa-membro-contorno" />
    <path d={d} className="neuro__lisa-membro" />
    <circle cx={x} cy={y} r="5.5" className="neuro__lisa-mao" />
  </g>
);

export default function LisaDoNeuro() {
  return (
    <g className="neuro__boneco neuro__lisa">
      {/* pernas e sapatos */}
      <path d="M92 158 V174 M108 158 V174" className="neuro__lisa-membro-contorno" />
      <path d="M92 158 V174 M108 158 V174" className="neuro__lisa-membro" />
      <ellipse cx="89" cy="178" rx="8.5" ry="4.6" className="neuro__lisa-sapato" />
      <ellipse cx="111" cy="178" rx="8.5" ry="4.6" className="neuro__lisa-sapato" />

      {/* braços: a pose muda com o humor */}
      <Braco humores="v-normal v-feliz v-dormindo" d="M86 128 Q75 138 70 150" mao={[69, 152]} />
      <Braco humores="v-normal v-feliz v-dormindo v-triste" d="M114 128 Q125 138 130 150" mao={[131, 152]} />
      <Braco humores="v-comemorando" d="M86 128 Q73 117 68 103" mao={[67, 100]} />
      <Braco humores="v-comemorando" d="M114 128 Q127 117 132 103" mao={[133, 100]} />
      <Braco humores="v-surpreso" d="M86 128 Q71 131 62 123" mao={[60, 121]} />
      <Braco humores="v-surpreso" d="M114 128 Q129 131 138 123" mao={[140, 121]} />
      <Braco humores="v-pensando v-triste" d="M87 129 Q81 141 80 154" mao={[80, 156]} />
      <Braco humores="v-pensando" d="M114 128 Q129 130 121 120" mao={[118, 117]} />

      {/* o pescoço e a roupa */}
      <rect x="94.5" y="112" width="11" height="14" rx="3" className="neuro__lisa-pele neuro__lisa-contorno" />
      <path d="M84 123 Q100 117 116 123 L127 157 Q100 164 73 157 Z" className="neuro__lisa-roupa" />
      <path d="M93 121 L100 129 L107 121" className="neuro__lisa-gola" />

      {/* a cabeça: o desenho do logo, colorido por baixo do traço */}
      <g transform={CABECA}>
        <path d={R.cabelo} className="neuro__lisa-cabelo" />
        <path d={R.rabo} className="neuro__lisa-cabelo" />
        <path d={R.prendedor} className="neuro__lisa-prendedor" />
        <path d={R.rosto} className="neuro__lisa-pele" />
        <path d={R.orelha} className="neuro__lisa-pele" />
        {R.lentes.map((d, i) => <path key={i} d={d} className="neuro__lisa-lente" />)}
        <path d={R.brinco} className="neuro__lisa-brinco" />
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
          <text x="84" y="26" className="neuro__lisa-zz">z</text>
          <text x="90" y="17" className="neuro__lisa-zz neuro__lisa-zz--grande">z</text>
        </g>
        <g className="v v-pensando neuro__lisa-pensar">
          <circle cx="86" cy="34" r="1.6" /><circle cx="90.5" cy="27.5" r="2.2" /><circle cx="95.5" cy="20" r="2.9" />
        </g>
        <g className="v v-comemorando neuro__lisa-brilho">
          <path d="M8 26 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" />
          <path d="M94 62 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" />
          <path d="M88 10 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" />
        </g>
      </g>
    </g>
  );
}
