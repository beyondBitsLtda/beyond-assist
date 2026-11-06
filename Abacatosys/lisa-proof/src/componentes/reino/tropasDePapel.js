// As tropas desenhadas como o Neuro: recortes de papel 2D (estilo Paper Mario), um SVG por tropa,
// pintado com a cor do time (azul = minhas, vermelho = inimigas, verde = de defesa). O mundo 3D
// transforma cada SVG em textura, põe a borda branca de adesivo e mostra sempre de frente para a
// câmera. Desenho em 200×200, pés perto de y = 190, contorno escuro grosso de papel recortado.
// Os monstros das expedições (monstrosDePapel.js) passam por aqui também: o mundo 3D pede o papel
// de qualquer "tipo" e não precisa saber quem é tropa e quem é monstro.

import { ehMonstroDePapel, svgDoMonstro, TAMANHO_DOS_MONSTROS, VOO_DOS_MONSTROS } from "./monstrosDePapel.js";
import { DESENHOS_DA_TRIPULACAO, TAMANHO_DA_TRIPULACAO, VOO_DA_TRIPULACAO } from "./tripulacaoDePapel.js";

/** Escurece (ou clareia, com fator > 1) uma cor #rrggbb. */
function tom(hex, fator) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(fator > 1 ? v + (255 - v) * (fator - 1) : v * fator))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const PELE = "#f2d3b1";
const TRACO = 'stroke="#1f2937" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
const olhos = (cx, cy, d = 10) => `<circle cx="${cx - d}" cy="${cy}" r="4.5" fill="#1f2937" stroke="none"/><circle cx="${cx + d}" cy="${cy}" r="4.5" fill="#1f2937" stroke="none"/><circle cx="${cx - d + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#fff" stroke="none"/><circle cx="${cx + d + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#fff" stroke="none"/>`;
const sorriso = (cx, cy) => `<path d="M${cx - 8} ${cy} q8 7 16 0" fill="none"/>`;
const bochechas = (cx, cy, d = 17) => `<ellipse cx="${cx - d}" cy="${cy}" rx="5" ry="3" fill="#f9a8d4" stroke="none" opacity="0.8"/><ellipse cx="${cx + d}" cy="${cy}" rx="5" ry="3" fill="#f9a8d4" stroke="none" opacity="0.8"/>`;
const pernas = (cor = "#4b5563") => `<rect x="80" y="152" width="15" height="32" rx="6" fill="${cor}"/><rect x="105" y="152" width="15" height="32" rx="6" fill="${cor}"/><ellipse cx="86" cy="187" rx="14" ry="7" fill="#3a2a1e"/><ellipse cx="114" cy="187" rx="14" ry="7" fill="#3a2a1e"/>`;

const DESENHOS = {
  guerreiro: (c, e) => `
    ${pernas()}
    <path d="M150 128 L172 40" stroke="#1f2937" stroke-width="16"/><path d="M150 128 L172 40" stroke="#e5e7eb" stroke-width="8"/>
    <rect x="140" y="120" width="26" height="8" rx="3" fill="#b45309" transform="rotate(-15 153 124)"/>
    <path d="M62 102 Q100 90 138 102 L146 158 Q100 170 54 158 Z" fill="${c}"/>
    <rect x="58" y="138" width="84" height="11" rx="4" fill="#8a5a2b"/><rect x="94" y="137" width="12" height="13" rx="2" fill="#f0be45"/>
    <path d="M26 98 Q48 86 70 98 L66 140 Q48 160 30 140 Z" fill="${c}"/><path d="M48 104 v34 M34 118 h28" stroke="#fff" stroke-width="7"/>
    <circle cx="100" cy="70" r="30" fill="${PELE}"/>${olhos(100, 74)}${sorriso(100, 86)}${bochechas(100, 84)}
    <path d="M68 70 Q68 32 100 32 Q132 32 132 70 L122 64 Q100 56 78 64 Z" fill="#9aa3ad"/><rect x="96" y="58" width="8" height="20" rx="2" fill="#9aa3ad"/>
    <path d="M100 32 Q112 8 134 12 Q118 22 110 36" fill="${c}"/>`,

  arqueira: (c, e) => `
    ${pernas("#6b4f2a")}
    <rect x="126" y="70" width="20" height="58" rx="6" fill="#8a5a2b" transform="rotate(14 136 99)"/>
    <path d="M138 64 l6 -20 M146 66 l9 -18 M131 66 l1 -21" stroke="#1f2937" stroke-width="4"/>
    <path d="M64 104 Q100 92 136 104 L142 160 Q100 170 58 160 Z" fill="${c}"/>
    <rect x="60" y="138" width="80" height="10" rx="4" fill="#6b4f2a"/>
    <path d="M44 52 Q16 108 44 164" fill="none" stroke="#1f2937" stroke-width="12"/><path d="M44 52 Q16 108 44 164" fill="none" stroke="#a0703f" stroke-width="6"/>
    <path d="M44 54 L44 162" stroke="#e5e7eb" stroke-width="2"/><path d="M40 108 H96" stroke="#1f2937" stroke-width="5"/><path d="M92 102 l10 6 -10 6 z" fill="#9aa3ad"/>
    <path d="M66 82 Q64 30 100 28 Q136 30 134 82 Q126 54 100 54 Q74 54 66 82 Z" fill="${e}"/>
    <circle cx="100" cy="76" r="27" fill="${PELE}"/>${olhos(100, 78, 9)}${sorriso(100, 90)}${bochechas(100, 88, 15)}
    <path d="M72 70 Q74 44 100 44 Q126 44 128 70 Q114 56 100 58 Q86 56 72 70 Z" fill="#7a3b1f"/>
    <path d="M62 84 Q60 26 100 22 Q140 26 138 84 Q132 46 100 44 Q68 46 62 84 Z" fill="${c}"/>`,

  bombardeiro: (c, e) => `
    ${pernas()}
    <path d="M66 118 Q100 106 134 118 L140 162 Q100 172 60 162 Z" fill="${c}"/>
    <path d="M66 122 L50 74 M134 122 L150 74" stroke="#1f2937" stroke-width="16"/><path d="M66 122 L50 74 M134 122 L150 74" stroke="${PELE}" stroke-width="9"/>
    <circle cx="100" cy="102" r="22" fill="${PELE}"/>${olhos(100, 102, 8)}
    <rect x="80" y="94" width="40" height="12" rx="6" fill="none" stroke="#1f2937" stroke-width="4"/><circle cx="91" cy="100" r="7" fill="#93c5fd" opacity="0.7"/><circle cx="109" cy="100" r="7" fill="#93c5fd" opacity="0.7"/>
    <path d="M90 115 q10 6 20 0" fill="none"/>
    <circle cx="100" cy="52" r="38" fill="#22252a"/><ellipse cx="86" cy="38" rx="9" ry="6" fill="#6b7280" stroke="none"/>
    <path d="M118 22 Q130 6 146 10" fill="none" stroke="#a16207" stroke-width="5"/>
    <path d="M150 2 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" fill="#f59e0b" stroke="#b45309" stroke-width="3"/>`,

  gigante: (c, e) => `
    <rect x="66" y="150" width="26" height="34" rx="8" fill="#4b5563"/><rect x="108" y="150" width="26" height="34" rx="8" fill="#4b5563"/>
    <ellipse cx="78" cy="188" rx="20" ry="8" fill="#3a2a1e"/><ellipse cx="122" cy="188" rx="20" ry="8" fill="#3a2a1e"/>
    <path d="M40 100 Q100 74 160 100 L168 156 Q100 172 32 156 Z" fill="${c}"/>
    <rect x="36" y="134" width="128" height="14" rx="5" fill="#6b4f2a"/><rect x="90" y="132" width="20" height="18" rx="3" fill="#9aa3ad"/>
    <path d="M44 104 L18 150 M156 104 L182 150" stroke="#1f2937" stroke-width="28"/><path d="M44 104 L18 150 M156 104 L182 150" stroke="#e9c39a" stroke-width="19"/>
    <circle cx="18" cy="156" r="16" fill="#e9c39a"/><circle cx="182" cy="156" r="16" fill="#e9c39a"/>
    <circle cx="100" cy="62" r="34" fill="#e9c39a"/>${olhos(100, 66, 12)}
    <path d="M82 52 l14 6 M118 52 l-14 6" stroke="#1f2937" stroke-width="6"/>
    <path d="M86 84 q14 -8 28 0" fill="none"/><path d="M72 76 Q100 110 128 76 Q114 92 100 92 Q86 92 72 76 Z" fill="#8a5a2b"/>`,

  mago: (c, e) => `
    <path d="M152 60 L146 186" stroke="#1f2937" stroke-width="12"/><path d="M152 60 L146 186" stroke="#8a5a2b" stroke-width="6"/>
    <circle cx="153" cy="52" r="15" fill="#c4b5fd"/><circle cx="153" cy="52" r="8" fill="#f5f3ff" stroke="none"/>
    <path d="M60 100 Q100 88 140 100 L156 186 Q100 196 44 186 Z" fill="${c}"/>
    <path d="M48 176 Q100 186 152 176" fill="none" stroke="#f0be45" stroke-width="5"/>
    <path d="M136 110 L152 130" stroke="#1f2937" stroke-width="14"/><path d="M136 110 L152 130" stroke="${c}" stroke-width="8"/>
    <circle cx="100" cy="74" r="26" fill="${PELE}"/>${olhos(100, 74, 9)}${bochechas(100, 82, 15)}
    <path d="M76 84 Q100 136 124 84 Q112 96 100 94 Q88 96 76 84 Z" fill="#f4f1ea"/>
    <path d="M58 62 Q100 50 142 62 Q100 72 58 62 Z" fill="#4c1d95"/>
    <path d="M66 60 L106 -4 L134 60 Z" fill="#5b21b6"/>
    <path d="M100 24 l3 6 6 2 -6 2 -3 6 -3 -6 -6 -2 6 -2 z" fill="#fde047" stroke="none"/><path d="M114 44 l2 4 4 1.5 -4 1.5 -2 4 -2 -4 -4 -1.5 4 -1.5 z" fill="#fde047" stroke="none"/>`,

  balao: (c, e) => `
    <path d="M70 120 L82 156 M130 120 L118 156 M100 130 L100 156" stroke="#6b4f2a" stroke-width="4"/>
    <circle cx="100" cy="72" r="62" fill="${c}"/>
    <path d="M100 10 Q72 72 100 134 Q128 72 100 10 Z" fill="#f4f1ea"/>
    <path d="M44 46 Q60 72 44 100" fill="none" stroke="#f4f1ea" stroke-width="12"/><path d="M156 46 Q140 72 156 100" fill="none" stroke="#f4f1ea" stroke-width="12"/>
    <circle cx="100" cy="72" r="62" fill="none"/>
    <ellipse cx="72" cy="40" rx="12" ry="7" fill="#ffffff" stroke="none" opacity="0.5"/>
    <rect x="74" y="154" width="52" height="26" rx="5" fill="#a0703f"/><path d="M78 164 H122 M78 172 H122" stroke="#6b4f2a" stroke-width="3"/>
    <circle cx="100" cy="186" r="9" fill="#22252a"/>${olhos(100, 96, 14)}
    <path d="M88 110 q12 8 24 0" fill="none"/>`,

  dragao: (c, e) => `
    <path d="M100 96 L8 40 Q24 84 14 118 Q48 104 70 122 Z" fill="${e}"/><path d="M100 96 L192 40 Q176 84 186 118 Q152 104 130 122 Z" fill="${e}"/>
    <path d="M28 66 L66 104 M172 66 L134 104" fill="none" stroke="#1f2937" stroke-width="4"/>
    <path d="M128 168 Q170 176 176 146 Q178 134 166 136" fill="none" stroke="#1f2937" stroke-width="16"/><path d="M128 168 Q170 176 176 146 Q178 134 166 136" fill="none" stroke="${c}" stroke-width="9"/>
    <ellipse cx="100" cy="140" rx="40" ry="42" fill="${c}"/><ellipse cx="100" cy="146" rx="24" ry="30" fill="#fde68a"/>
    <path d="M88 136 H112 M86 150 H114 M88 164 H112" stroke="#f59e0b" stroke-width="3"/>
    <ellipse cx="82" cy="184" rx="14" ry="7" fill="${e}"/><ellipse cx="118" cy="184" rx="14" ry="7" fill="${e}"/>
    <path d="M72 50 L64 18 L84 40 Z M128 50 L136 18 L116 40 Z" fill="#fde68a"/>
    <ellipse cx="100" cy="72" rx="36" ry="30" fill="${c}"/>${olhos(100, 66, 13)}
    <ellipse cx="100" cy="86" rx="20" ry="12" fill="${tom(c, 1.25)}"/><circle cx="93" cy="84" r="3" fill="#1f2937" stroke="none"/><circle cx="107" cy="84" r="3" fill="#1f2937" stroke="none"/>`,

  curandeira: (c, e) => `
    <path d="M86 92 Q30 50 22 100 Q34 140 82 122 Z" fill="#fdf2f8"/><path d="M114 92 Q170 50 178 100 Q166 140 118 122 Z" fill="#fdf2f8"/>
    <path d="M150 58 L144 186" stroke="#1f2937" stroke-width="10"/><path d="M150 58 L144 186" stroke="#f0be45" stroke-width="5"/>
    <path d="M150 62 C138 46 126 64 150 80 C174 64 162 46 150 62 Z" fill="#f472b6"/>
    <path d="M66 104 Q100 92 134 104 L150 184 Q100 194 50 184 Z" fill="#f8fafc"/>
    <path d="M68 108 L132 150" stroke="${c}" stroke-width="12"/>
    <circle cx="100" cy="76" r="26" fill="${PELE}"/>${olhos(100, 78, 9)}${sorriso(100, 90)}${bochechas(100, 88, 15)}
    <path d="M72 78 Q70 44 100 44 Q130 44 128 78 Q124 58 100 56 Q76 58 72 78 Z" fill="#fde68a"/>
    <ellipse cx="100" cy="36" rx="22" ry="7" fill="none" stroke="#f0be45" stroke-width="6"/>`,

  // ---- as novas (03/11/2026, BEYOND-0020)
  lanceiro: (c, e) => `
    ${pernas()}
    <path d="M156 186 L156 16" stroke="#1f2937" stroke-width="12"/><path d="M156 186 L156 16" stroke="#a0703f" stroke-width="6"/>
    <path d="M156 2 L144 30 L168 30 Z" fill="#e5e7eb"/>
    <path d="M62 102 Q100 90 138 102 L146 158 Q100 170 54 158 Z" fill="${c}"/>
    <rect x="58" y="138" width="84" height="11" rx="4" fill="#8a5a2b"/>
    <circle cx="148" cy="118" r="10" fill="${PELE}"/>
    <circle cx="100" cy="70" r="30" fill="${PELE}"/>${olhos(100, 74)}${sorriso(100, 86)}${bochechas(100, 84)}
    <path d="M70 66 Q70 34 100 34 Q130 34 130 66 Z" fill="${e}"/><path d="M100 34 V20" stroke-width="6"/><circle cx="100" cy="16" r="7" fill="${c}"/>`,

  cavaleiro: (c, e) => `
    <rect x="52" y="140" width="12" height="44" rx="5" fill="#6b4423"/><rect x="72" y="146" width="12" height="40" rx="5" fill="#6b4423"/>
    <rect x="124" y="146" width="12" height="40" rx="5" fill="#6b4423"/><rect x="142" y="140" width="12" height="44" rx="5" fill="#6b4423"/>
    <path d="M46 124 Q22 132 28 162" fill="none" stroke="#3a2a1e" stroke-width="10"/>
    <ellipse cx="102" cy="132" rx="58" ry="28" fill="#8b5a2b"/>
    <path d="M146 122 Q168 92 174 70 L190 78 Q186 108 158 140 Z" fill="#8b5a2b"/>
    <ellipse cx="184" cy="74" rx="14" ry="10" fill="#8b5a2b"/><circle cx="182" cy="70" r="3" fill="#1f2937" stroke="none"/>
    <path d="M162 86 Q150 70 168 60" fill="none" stroke="#3a2a1e" stroke-width="8"/>
    <path d="M60 124 Q102 140 144 124" fill="none" stroke="${c}" stroke-width="10"/>
    <path d="M74 118 Q100 106 126 118 L128 132 Q100 138 72 132 Z" fill="${c}"/>
    <path d="M80 118 Q100 80 120 118 Z" fill="${c}"/>
    <circle cx="100" cy="66" r="24" fill="${PELE}"/>${olhos(100, 68, 8)}${sorriso(100, 78)}
    <path d="M74 62 Q74 34 100 34 Q126 34 126 62 L118 58 Q100 52 82 58 Z" fill="#9aa3ad"/>
    <path d="M126 96 L150 24" stroke="#1f2937" stroke-width="10"/><path d="M126 96 L150 24" stroke="#e5e7eb" stroke-width="5"/>
    <path d="M150 24 l-10 2 l16 -20 l2 24 z" fill="${c}"/>`,

  grifo: (c, e) => `
    <path d="M96 100 L14 52 Q26 96 20 128 Q54 110 76 128 Z" fill="${e}"/><path d="M104 100 L186 52 Q174 96 180 128 Q146 110 124 128 Z" fill="${e}"/>
    <path d="M30 70 L70 108 M170 70 L130 108" fill="none" stroke-width="4"/>
    <path d="M138 150 Q172 160 170 128" fill="none" stroke="#1f2937" stroke-width="12"/><path d="M138 150 Q172 160 170 128" fill="none" stroke="#e0a54a" stroke-width="6"/>
    <ellipse cx="100" cy="142" rx="44" ry="32" fill="#e0a54a"/>
    <ellipse cx="80" cy="180" rx="12" ry="7" fill="#b7791f"/><ellipse cx="120" cy="180" rx="12" ry="7" fill="#b7791f"/>
    <path d="M70 112 Q100 126 130 112" fill="none" stroke="${c}" stroke-width="10"/>
    <path d="M78 60 L70 38 L92 54 Z M122 60 L130 38 L108 54 Z" fill="#f8fafc"/>
    <circle cx="100" cy="84" r="30" fill="#f8fafc"/>${olhos(100, 78, 11)}
    <path d="M90 92 L100 118 L112 92 Z" fill="#f59e0b"/>`,

  colosso: (c, e) => `
    <rect x="70" y="150" width="24" height="34" rx="6" fill="#6b7280"/><rect x="106" y="150" width="24" height="34" rx="6" fill="#6b7280"/>
    <path d="M40 104 L16 150 L34 162 L56 120 Z M160 104 L184 150 L166 162 L144 120 Z" fill="#9ca3af"/>
    <path d="M40 100 Q100 80 160 100 L168 160 Q100 178 32 160 Z" fill="#9ca3af"/>
    <path d="M60 124 Q100 136 140 124" fill="none" stroke="${c}" stroke-width="12"/>
    <circle cx="70" cy="146" r="4" fill="#57534e" stroke="none"/><circle cx="128" cy="150" r="5" fill="#57534e" stroke="none"/>
    <path d="M70 34 Q100 18 130 34 L134 104 Q100 112 66 104 Z" fill="#a8a29e"/>
    <path d="M74 56 H98 M102 56 H126" stroke-width="7"/>
    <ellipse cx="86" cy="68" rx="7" ry="4" fill="#fde047"/><ellipse cx="114" cy="68" rx="7" ry="4" fill="#fde047"/>
    <path d="M100 62 L92 86 H108 Z" fill="#78716c"/>
    <path d="M84 96 H116" stroke-width="6"/>`,

  // ---- a tripulação das ilhas (Temporada das Ilhas)
  pirata: (c, e) => `
    ${pernas("#3f3f46")}
    <path d="M150 128 Q180 96 168 56" fill="none" stroke="#1f2937" stroke-width="14"/><path d="M150 128 Q180 96 168 56" fill="none" stroke="#e5e7eb" stroke-width="7"/>
    <rect x="140" y="122" width="22" height="8" rx="3" fill="#f0be45" transform="rotate(-30 151 126)"/>
    <path d="M62 102 Q100 90 138 102 L146 158 Q100 170 54 158 Z" fill="#f8fafc"/>
    <path d="M72 104 L80 158 M92 100 L96 160 M108 100 L104 160 M128 104 L120 158" stroke="${c}" stroke-width="7"/>
    <rect x="58" y="138" width="84" height="11" rx="4" fill="#3a2a1e"/><rect x="94" y="137" width="12" height="13" rx="2" fill="#f0be45"/>
    <circle cx="100" cy="72" r="30" fill="${PELE}"/>
    <circle cx="112" cy="74" r="4.5" fill="#1f2937" stroke="none"/><circle cx="113.5" cy="72.5" r="1.5" fill="#fff" stroke="none"/>
    <ellipse cx="88" cy="74" rx="9" ry="7" fill="#1f2937"/><path d="M78 66 L124 58" stroke-width="3"/>
    <path d="M86 92 Q100 108 114 92" fill="#7c4a2d" stroke-width="3"/>
    <path d="M56 56 Q100 20 144 56 Q100 46 56 56 Z" fill="#1f2937"/><path d="M66 53 Q100 34 134 53" fill="none" stroke="${c}" stroke-width="4"/>
    <circle cx="100" cy="42" r="6" fill="#f8fafc" stroke-width="2"/>`,

  arpoadora: (c, e) => `
    ${pernas("#0e7490")}
    <path d="M40 176 L170 30" stroke="#1f2937" stroke-width="10"/><path d="M40 176 L170 30" stroke="#a0703f" stroke-width="5"/>
    <path d="M172 28 L150 34 L160 44 Z M172 28 L166 50 L160 44 Z" fill="#e5e7eb"/>
    <path d="M64 104 Q100 92 136 104 L142 160 Q100 170 58 160 Z" fill="${c}"/>
    <path d="M64 120 Q100 132 136 120" fill="none" stroke="#f8fafc" stroke-width="6"/>
    <path d="M128 70 Q148 92 132 120" fill="none" stroke="#3a2a1e" stroke-width="10"/>
    <circle cx="100" cy="74" r="28" fill="#d6a77a"/>${olhos(100, 76, 9)}${sorriso(100, 88)}${bochechas(100, 86, 15)}
    <path d="M72 76 Q66 40 100 40 Q134 40 128 76 Q122 54 100 54 Q78 54 72 76 Z" fill="#3a2a1e"/>
    <circle cx="78" cy="56" r="7" fill="#f472b6"/>`,

  polvorista: (c, e) => `
    ${pernas()}
    <path d="M64 108 Q100 96 136 108 L142 158 Q100 168 58 158 Z" fill="${c}"/>
    <circle cx="100" cy="72" r="26" fill="${PELE}"/>${olhos(100, 74, 9)}<path d="M90 86 h20" fill="none"/>
    <path d="M74 66 Q74 42 100 42 Q126 42 126 66 Z" fill="${e}"/>
    <rect x="56" y="110" width="88" height="64" rx="16" fill="#8a5a2b"/>
    <path d="M56 128 H144 M56 158 H144" stroke="#4b3621" stroke-width="6"/>
    <path d="M100 110 Q110 94 124 98" fill="none" stroke="#1f2937" stroke-width="4"/>
    <path d="M124 98 l6 -10 l4 8 l8 -2 l-6 8 z" fill="#f97316"/>
    <circle cx="100" cy="143" r="10" fill="#f8fafc"/><path d="M95 141 h2 M103 141 h2 M96 147 h8" stroke-width="2.5"/>`,

  papagaio: (c, e) => `
    <path d="M96 104 L20 70 Q36 112 30 140 Q60 120 80 134 Z" fill="#22c55e"/><path d="M104 104 L180 70 Q164 112 170 140 Q140 120 120 134 Z" fill="#22c55e"/>
    <path d="M30 86 L70 116 M170 86 L130 116" fill="none" stroke="#2563eb" stroke-width="6"/>
    <path d="M86 164 L76 196 L100 176 L124 196 L114 164 Z" fill="#2563eb"/>
    <ellipse cx="100" cy="128" rx="32" ry="42" fill="#ef4444"/>
    <path d="M78 116 Q100 126 122 116" fill="none" stroke="${c}" stroke-width="9"/>
    <circle cx="100" cy="76" r="28" fill="#ef4444"/>
    <circle cx="90" cy="70" r="9" fill="#f8fafc"/><circle cx="91" cy="71" r="4.5" fill="#1f2937" stroke="none"/>
    <path d="M108 70 Q134 72 128 98 Q118 86 106 90 Z" fill="#fde047"/>`,
};

/** O SVG de uma tropa na cor do time. */
export function svgDaTropa(tipo, cor) {
  if (ehMonstroDePapel(tipo)) return svgDoMonstro(tipo);
  const desenho = DESENHOS[tipo] || DESENHOS_DA_TRIPULACAO[tipo] || DESENHOS.guerreiro;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -12 212 212" width="424" height="424"><g ${TRACO}>${desenho(cor, tom(cor, 0.62))}</g></svg>`;
}

/** Tamanho do recorte (lado do quadrado, na unidade da ilha) e altura de voo de quem voa. */
export const TAMANHO_DO_PAPEL = {
  guerreiro: 0.95, arqueira: 0.95, bombardeiro: 0.9, mago: 1.05, gigante: 1.8, balao: 1.6, dragao: 1.9, curandeira: 1.15,
  lanceiro: 1.0, cavaleiro: 1.35, grifo: 1.5, colosso: 2.1, pirata: 0.95, arpoadora: 0.95, polvorista: 0.95, papagaio: 1.05,
  ...TAMANHO_DA_TRIPULACAO, ...TAMANHO_DOS_MONSTROS,
};
export const ALTURA_DE_VOO = { balao: 1.5, dragao: 1.35, curandeira: 1.2, grifo: 1.3, papagaio: 1.15, ...VOO_DA_TRIPULACAO, ...VOO_DOS_MONSTROS };
