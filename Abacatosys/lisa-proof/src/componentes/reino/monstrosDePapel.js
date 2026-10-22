// Os monstros das expedições, desenhados como as tropas e o Neuro: recortes de papel 2D, um SVG
// por monstro (pedido de 22/10/2026 — "monstros 2D, como o Cérbero"). Diferente das tropas, não
// levam a cor do time: cada um tem as cores dele. Desenho em 200×200, pés perto de y = 190,
// contorno escuro grosso (o traço vem do grupo em svgDoMonstro). O mundo 3D põe a borda branca de
// adesivo e mostra sempre de frente para a câmera.

const olhos = (cx, cy, d, cor = "#1f2937", r = 4.5) => `<circle cx="${cx - d}" cy="${cy}" r="${r}" fill="${cor}" stroke="none"/><circle cx="${cx + d}" cy="${cy}" r="${r}" fill="${cor}" stroke="none"/><circle cx="${cx - d + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#fff" stroke="none"/><circle cx="${cx + d + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#fff" stroke="none"/>`;
const olhosAmarelos = (cx, cy, d, r = 8) => `<circle cx="${cx - d}" cy="${cy}" r="${r}" fill="#fde047"/><circle cx="${cx + d}" cy="${cy}" r="${r}" fill="#fde047"/><circle cx="${cx - d}" cy="${cy}" r="${r * 0.42}" fill="#1f2937" stroke="none"/><circle cx="${cx + d}" cy="${cy}" r="${r * 0.42}" fill="#1f2937" stroke="none"/>`;
const olhosVermelhos = (cx, cy, d, r = 5) => `<circle cx="${cx - d}" cy="${cy}" r="${r}" fill="#ef4444" stroke="none"/><circle cx="${cx + d}" cy="${cy}" r="${r}" fill="#ef4444" stroke="none"/><circle cx="${cx - d}" cy="${cy}" r="${r * 0.4}" fill="#fff7d6" stroke="none"/><circle cx="${cx + d}" cy="${cy}" r="${r * 0.4}" fill="#fff7d6" stroke="none"/>`;
const pes = (cor, y = 186, d = 16) => `<ellipse cx="${100 - d}" cy="${y}" rx="14" ry="7" fill="${cor}"/><ellipse cx="${100 + d}" cy="${y}" rx="14" ry="7" fill="${cor}"/>`;

const DESENHOS = {
  cogumelo: () => `
    ${pes("#7c4a2d", 186, 18)}
    <path d="M70 104 Q66 150 74 176 Q100 186 126 176 Q134 150 130 104 Z" fill="#f6e7c9"/>
    ${olhos(100, 136, 12)}<path d="M92 152 q8 7 16 0" fill="none"/>
    <ellipse cx="80" cy="148" rx="5" ry="3" fill="#f9a8d4" stroke="none" opacity="0.8"/><ellipse cx="120" cy="148" rx="5" ry="3" fill="#f9a8d4" stroke="none" opacity="0.8"/>
    <path d="M22 108 Q26 36 100 32 Q174 36 178 108 Q100 124 22 108 Z" fill="#e53935"/>
    <circle cx="66" cy="70" r="12" fill="#fff" stroke="none"/><circle cx="112" cy="54" r="10" fill="#fff" stroke="none"/><circle cx="144" cy="84" r="9" fill="#fff" stroke="none"/><circle cx="96" cy="88" r="7" fill="#fff" stroke="none"/><circle cx="44" cy="96" r="6" fill="#fff" stroke="none"/>`,

  slime: () => `
    <path d="M24 182 Q14 120 56 86 Q78 34 104 36 Q132 38 146 84 Q188 116 178 182 Q100 196 24 182 Z" fill="#5fc96b"/>
    <path d="M52 182 q2 10 10 10 q8 0 8 -10 M138 182 q2 12 10 12 q8 0 6 -12" fill="#5fc96b"/>
    <ellipse cx="78" cy="70" rx="14" ry="9" fill="#ffffff" stroke="none" opacity="0.55" transform="rotate(-25 78 70)"/>
    <circle cx="80" cy="122" r="13" fill="#fff"/><circle cx="122" cy="122" r="13" fill="#fff"/>
    <circle cx="83" cy="125" r="6" fill="#1f2937" stroke="none"/><circle cx="119" cy="125" r="6" fill="#1f2937" stroke="none"/>
    <path d="M86 150 Q101 162 116 150" fill="none"/>`,

  goblin: () => `
    <rect x="82" y="156" width="14" height="26" rx="5" fill="#5d4037"/><rect x="104" y="156" width="14" height="26" rx="5" fill="#5d4037"/>
    ${pes("#3a2a1e", 186, 12)}
    <path d="M154 150 L180 96" stroke="#1f2937" stroke-width="12"/><path d="M154 150 L180 96" stroke="#cbd5e1" stroke-width="6"/>
    <rect x="146" y="146" width="20" height="8" rx="3" fill="#7c4a2d" transform="rotate(-25 156 150)"/>
    <path d="M66 118 Q100 106 134 118 L140 164 L126 156 L114 166 L100 156 L86 166 L74 156 L60 164 Z" fill="#8d6e63"/>
    <path d="M134 124 L156 148" stroke="#1f2937" stroke-width="14"/><path d="M134 124 L156 148" stroke="#7cb342" stroke-width="8"/>
    <path d="M70 80 L14 52 L62 100 Z M130 80 L186 52 L138 100 Z" fill="#7cb342"/>
    <path d="M64 72 L34 60 L60 90 Z M136 72 L166 60 L140 90 Z" fill="#f48fb1" stroke="none" opacity="0.7"/>
    <circle cx="100" cy="82" r="34" fill="#7cb342"/>
    ${olhosAmarelos(100, 76, 14, 9)}
    <path d="M78 64 l14 6 M122 64 l-14 6" stroke="#1f2937" stroke-width="5"/>
    <ellipse cx="100" cy="90" rx="6" ry="4" fill="#558b2f"/>
    <path d="M80 100 Q100 116 120 100 Z" fill="#fff"/><path d="M88 102 l3 6 3 -6 M106 102 l3 6 3 -6" fill="none" stroke-width="2.5"/>`,

  bandido: () => `
    <rect x="80" y="152" width="15" height="30" rx="6" fill="#374151"/><rect x="105" y="152" width="15" height="30" rx="6" fill="#374151"/>
    ${pes("#3a2a1e", 186, 14)}
    <path d="M62 104 Q100 92 138 104 L146 160 Q100 172 54 160 Z" fill="#4b5563"/>
    <path d="M58 140 H142" stroke="#7c4a2d" stroke-width="10"/><rect x="92" y="134" width="16" height="12" rx="3" fill="#a3a3a3"/>
    <path d="M20 110 H96" stroke="#1f2937" stroke-width="12"/><path d="M20 110 H96" stroke="#8a5a2b" stroke-width="6"/>
    <path d="M30 88 Q14 110 30 132" fill="none" stroke="#1f2937" stroke-width="9"/><path d="M30 88 Q14 110 30 132" fill="none" stroke="#a16207" stroke-width="4"/>
    <path d="M30 90 L52 110 L30 130" fill="none" stroke="#e5e7eb" stroke-width="2"/><path d="M14 104 l-10 6 10 6 z" fill="#9ca3af"/>
    <circle cx="100" cy="74" r="28" fill="#e8c39e"/>
    <path d="M72 78 Q100 96 128 78 L126 98 Q100 112 74 98 Z" fill="#b91c1c"/><path d="M128 80 l16 6 -6 8" fill="#b91c1c"/>
    ${olhos(100, 70, 10)}<path d="M84 60 l12 4 M116 60 l-12 4" stroke="#1f2937" stroke-width="4"/>
    <path d="M64 82 Q58 30 100 26 Q142 30 136 82 Q132 52 100 50 Q68 52 64 82 Z" fill="#1f2937"/>`,

  lobo: () => `
    <rect x="64" y="146" width="18" height="38" rx="7" fill="#7b8794"/><rect x="118" y="146" width="18" height="38" rx="7" fill="#7b8794"/>
    ${pes("#4b5563", 186, 27)}
    <path d="M150 140 Q190 120 182 82 Q176 110 150 118" fill="#8e9aa6"/>
    <ellipse cx="100" cy="132" rx="52" ry="38" fill="#8e9aa6"/><ellipse cx="100" cy="142" rx="28" ry="24" fill="#e5e7eb"/>
    <path d="M62 72 L58 18 L92 54 Z M138 72 L142 18 L108 54 Z" fill="#8e9aa6"/><path d="M68 62 L66 34 L84 54 Z M132 62 L134 34 L116 54 Z" fill="#f9a8d4" stroke="none"/>
    <path d="M56 80 Q56 40 100 40 Q144 40 144 80 Q144 108 100 112 Q56 108 56 80 Z" fill="#8e9aa6"/>
    <path d="M78 88 Q100 72 122 88 Q122 116 100 118 Q78 116 78 88 Z" fill="#e5e7eb"/>
    ${olhosAmarelos(100, 72, 18, 8)}
    <path d="M78 62 l14 6 M122 62 l-14 6" stroke="#1f2937" stroke-width="5"/>
    <ellipse cx="100" cy="94" rx="9" ry="6" fill="#1f2937"/>
    <path d="M88 108 l4 8 4 -8 M104 108 l4 8 4 -8" fill="#fff" stroke-width="2.5"/>`,

  aranha: () => `
    <path d="M70 120 Q30 80 12 112 M70 130 Q24 120 8 150 M74 142 Q36 152 26 186 M84 150 Q60 170 58 190" fill="none" stroke="#1f2937" stroke-width="13"/>
    <path d="M130 120 Q170 80 188 112 M130 130 Q176 120 192 150 M126 142 Q164 152 174 186 M116 150 Q140 170 142 190" fill="none" stroke="#1f2937" stroke-width="13"/>
    <path d="M70 120 Q30 80 12 112 M70 130 Q24 120 8 150 M74 142 Q36 152 26 186 M84 150 Q60 170 58 190" fill="none" stroke="#4c3570" stroke-width="6"/>
    <path d="M130 120 Q170 80 188 112 M130 130 Q176 120 192 150 M126 142 Q164 152 174 186 M116 150 Q140 170 142 190" fill="none" stroke="#4c3570" stroke-width="6"/>
    <ellipse cx="100" cy="88" rx="50" ry="44" fill="#3b2a52"/>
    <path d="M80 66 L100 50 L120 66 L100 82 Z" fill="#dc2626" stroke-width="3"/>
    <ellipse cx="100" cy="134" rx="36" ry="30" fill="#4c3570"/>
    ${olhosVermelhos(100, 126, 12, 6)}${olhosVermelhos(100, 112, 22, 4)}
    <path d="M88 150 Q84 166 92 168 M112 150 Q116 166 108 168" fill="#e5e7eb" stroke-width="3"/>`,

  morcego: () => `
    <path d="M86 92 Q52 50 14 62 Q34 74 30 96 Q46 88 56 104 Q66 94 82 110 Z" fill="#5b3a8a"/>
    <path d="M114 92 Q148 50 186 62 Q166 74 170 96 Q154 88 144 104 Q134 94 118 110 Z" fill="#5b3a8a"/>
    <path d="M70 66 L50 98 M130 66 L150 98" fill="none" stroke="#1f2937" stroke-width="3"/>
    <path d="M78 74 L72 36 L94 62 Z M122 74 L128 36 L106 62 Z" fill="#6d4aa3"/>
    <ellipse cx="100" cy="100" rx="30" ry="34" fill="#6d4aa3"/>
    ${olhosVermelhos(100, 92, 11, 6)}
    <path d="M88 112 Q100 120 112 112" fill="none"/><path d="M92 113 l3 8 3 -7 M102 114 l3 7 3 -8" fill="#fff" stroke-width="2"/>
    <path d="M90 132 l-4 12 M110 132 l4 12" stroke="#1f2937" stroke-width="5"/>`,

  esqueleto: () => `
    <path d="M90 150 L84 184 M110 150 L116 184" stroke="#1f2937" stroke-width="12"/><path d="M90 150 L84 184 M110 150 L116 184" stroke="#f1efe6" stroke-width="6"/>
    ${pes("#d6d3c4", 186, 16)}
    <path d="M140 126 L172 52" stroke="#1f2937" stroke-width="14"/><path d="M140 126 L172 52" stroke="#a16207" stroke-width="7"/>
    <path d="M150 112 L178 124" stroke="#1f2937" stroke-width="7"/>
    <path d="M100 100 V150" stroke="#1f2937" stroke-width="12"/><path d="M100 100 V150" stroke="#f1efe6" stroke-width="6"/>
    <path d="M76 108 Q100 102 124 108 M74 122 Q100 116 126 122 M78 136 Q100 130 122 136" fill="none" stroke="#1f2937" stroke-width="10"/>
    <path d="M76 108 Q100 102 124 108 M74 122 Q100 116 126 122 M78 136 Q100 130 122 136" fill="none" stroke="#f1efe6" stroke-width="5"/>
    <path d="M76 110 L52 148 M124 110 L146 126" stroke="#1f2937" stroke-width="11"/><path d="M76 110 L52 148 M124 110 L146 126" stroke="#f1efe6" stroke-width="5"/>
    <path d="M70 66 Q70 30 100 30 Q130 30 130 66 Q130 84 118 90 L116 100 H84 L82 90 Q70 84 70 66 Z" fill="#f1efe6"/>
    <ellipse cx="88" cy="64" rx="9" ry="10" fill="#1f2937"/><ellipse cx="112" cy="64" rx="9" ry="10" fill="#1f2937"/>
    <circle cx="88" cy="66" r="2.5" fill="#fde047" stroke="none"/><circle cx="112" cy="66" r="2.5" fill="#fde047" stroke="none"/>
    <path d="M96 80 L100 74 L104 80 Z" fill="#1f2937"/><path d="M88 92 V100 M96 92 V100 M104 92 V100 M112 92 V100" stroke-width="2.5"/>`,

  orc: () => `
    <rect x="66" y="150" width="24" height="32" rx="8" fill="#4b5563"/><rect x="110" y="150" width="24" height="32" rx="8" fill="#4b5563"/>
    ${pes("#3a2a1e", 186, 22)}
    <path d="M150 154 L176 40" stroke="#1f2937" stroke-width="14"/><path d="M150 154 L176 40" stroke="#7c4a2d" stroke-width="8"/>
    <path d="M172 48 Q202 52 196 86 Q184 70 168 74 Z" fill="#9ca3af"/><path d="M174 60 Q154 50 146 70 Q160 66 170 74 Z" fill="#9ca3af"/>
    <path d="M44 102 Q100 80 156 102 L162 158 Q100 172 38 158 Z" fill="#5f8a3c"/>
    <path d="M60 104 Q100 92 140 104 L142 136 Q100 146 58 136 Z" fill="#9ca3af"/><path d="M100 98 V142" stroke-width="3"/>
    <path d="M46 106 L26 150 M154 106 L160 140" stroke="#1f2937" stroke-width="24"/><path d="M46 106 L26 150 M154 106 L160 140" stroke="#5f8a3c" stroke-width="16"/>
    <circle cx="100" cy="66" r="32" fill="#5f8a3c"/>
    ${olhosVermelhos(100, 60, 13, 5)}
    <path d="M80 48 l16 7 M120 48 l-16 7" stroke="#1f2937" stroke-width="6"/>
    <path d="M82 82 Q100 74 118 82" fill="none"/>
    <path d="M84 84 L80 66 L90 80 Z M116 84 L120 66 L110 80 Z" fill="#fef3c7" stroke-width="3"/>
    <path d="M70 40 Q100 22 130 40" fill="none" stroke="#1f2937" stroke-width="8"/>`,

  ent: () => `
    <path d="M70 160 Q64 176 48 186 M86 166 Q86 180 78 190 M114 166 Q116 180 124 190 M130 160 Q138 176 152 186" fill="none" stroke="#1f2937" stroke-width="13"/>
    <path d="M70 160 Q64 176 48 186 M86 166 Q86 180 78 190 M114 166 Q116 180 124 190 M130 160 Q138 176 152 186" fill="none" stroke="#6d4626" stroke-width="7"/>
    <path d="M62 70 Q58 120 66 166 Q100 176 134 166 Q142 120 138 70 Z" fill="#7a5230"/>
    <path d="M80 84 Q76 120 82 158 M118 90 Q124 124 116 160 M100 120 V150" fill="none" stroke="#5b3a1f" stroke-width="3"/>
    <path d="M64 96 Q30 84 20 50 M38 70 L18 72 M136 96 Q170 84 182 48 M162 70 L184 74" fill="none" stroke="#1f2937" stroke-width="13"/>
    <path d="M64 96 Q30 84 20 50 M38 70 L18 72 M136 96 Q170 84 182 48 M162 70 L184 74" fill="none" stroke="#7a5230" stroke-width="7"/>
    <circle cx="20" cy="44" r="14" fill="#4caf50"/><circle cx="182" cy="42" r="14" fill="#4caf50"/>
    <circle cx="62" cy="50" r="30" fill="#388e3c"/><circle cx="138" cy="50" r="30" fill="#388e3c"/><circle cx="100" cy="30" r="34" fill="#43a047"/><circle cx="100" cy="62" r="26" fill="#4caf50"/>
    <ellipse cx="84" cy="100" rx="9" ry="7" fill="#1f2937"/><ellipse cx="116" cy="100" rx="9" ry="7" fill="#1f2937"/>
    <circle cx="84" cy="100" r="3" fill="#a3e635" stroke="none"/><circle cx="116" cy="100" r="3" fill="#a3e635" stroke="none"/>
    <path d="M76 90 l14 4 M124 90 l-14 4" stroke="#1f2937" stroke-width="5"/>
    <path d="M86 124 Q100 132 114 124" fill="none" stroke-width="5"/>`,

  ogro: () => `
    <rect x="62" y="152" width="28" height="30" rx="9" fill="#9a9d55"/><rect x="110" y="152" width="28" height="30" rx="9" fill="#9a9d55"/>
    ${pes("#3a2a1e", 186, 24)}
    <path d="M30 152 Q10 100 34 56" stroke="#1f2937" stroke-width="16"/><path d="M30 152 Q10 100 34 56" stroke="#8a5a2b" stroke-width="10"/>
    <ellipse cx="34" cy="50" rx="18" ry="24" fill="#8a5a2b"/><circle cx="28" cy="40" r="3" fill="#1f2937" stroke="none"/><circle cx="40" cy="56" r="3" fill="#1f2937" stroke="none"/>
    <ellipse cx="100" cy="122" rx="62" ry="46" fill="#b0b36a"/>
    <ellipse cx="100" cy="132" rx="38" ry="28" fill="#c9cb86"/>
    <path d="M44 150 Q100 166 156 150 L150 172 Q100 182 50 172 Z" fill="#7c4a2d"/>
    <path d="M44 108 L32 150 M156 108 L168 146" stroke="#1f2937" stroke-width="24"/><path d="M44 108 L32 150 M156 108 L168 146" stroke="#b0b36a" stroke-width="16"/>
    <circle cx="100" cy="60" r="34" fill="#b0b36a"/>
    <ellipse cx="74" cy="56" rx="8" ry="10" fill="#b0b36a"/><ellipse cx="126" cy="56" rx="8" ry="10" fill="#b0b36a"/>
    ${olhos(100, 54, 12, "#1f2937", 5)}
    <path d="M84 42 l14 6 M116 42 l-14 6" stroke="#1f2937" stroke-width="5"/>
    <ellipse cx="100" cy="68" rx="9" ry="6" fill="#9a9d55"/>
    <path d="M82 80 Q100 92 118 80" fill="none"/><path d="M90 82 L92 74 L96 84 Z" fill="#fef3c7" stroke-width="2.5"/>`,

  cerbero: () => `
    <rect x="52" y="146" width="20" height="38" rx="8" fill="#2a1a1a"/><rect x="128" y="146" width="20" height="38" rx="8" fill="#2a1a1a"/>
    <rect x="84" y="152" width="16" height="32" rx="7" fill="#2a1a1a"/><rect x="104" y="152" width="16" height="32" rx="7" fill="#2a1a1a"/>
    <ellipse cx="62" cy="187" rx="15" ry="6" fill="#111"/><ellipse cx="138" cy="187" rx="15" ry="6" fill="#111"/>
    <path d="M160 140 Q196 128 190 92 Q182 118 156 120" fill="#3b2323"/><path d="M188 88 l8 -10 2 14 z" fill="#f97316"/>
    <ellipse cx="100" cy="132" rx="62" ry="36" fill="#3b2323"/>
    <path d="M72 124 Q100 136 128 124" fill="none" stroke="#5c2b2b" stroke-width="4"/>
    <path d="M100 96 L100 66 M64 104 L44 76 M136 104 L156 76" stroke="#1f2937" stroke-width="22"/><path d="M100 96 L100 66 M64 104 L44 76 M136 104 L156 76" stroke="#3b2323" stroke-width="15"/>
    ${cabecaDeCao(42, 60, 0.82)}${cabecaDeCao(158, 60, 0.82)}${cabecaDeCao(100, 46, 0.95)}
    <path d="M86 76 Q100 84 114 76 M28 92 Q42 100 56 92 M144 92 Q158 100 172 92" fill="none" stroke="#9ca3af" stroke-width="7"/>
    <path d="M90 80 l-3 8 6 -3 z M100 82 l0 8 4 -6 z M110 80 l3 8 -6 -3 z" fill="#d1d5db" stroke-width="2"/>`,
};

/** Uma cabeça do Cérbero: focinho, orelhas pontudas, olhos em brasa e fogo saindo da boca. */
function cabecaDeCao(cx, cy, s) {
  const p = (x, y) => `${(cx + x * s).toFixed(1)} ${(cy + y * s).toFixed(1)}`;
  return `
    <path d="M${p(-20, -14)} L${p(-26, -46)} L${p(-4, -24)} Z M${p(20, -14)} L${p(26, -46)} L${p(4, -24)} Z" fill="#2a1a1a"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${30 * s}" ry="${26 * s}" fill="#3b2323"/>
    <ellipse cx="${cx}" cy="${cy + 12 * s}" rx="${17 * s}" ry="${12 * s}" fill="#5c2b2b"/>
    <ellipse cx="${cx}" cy="${cy + 5 * s}" rx="${6 * s}" ry="${4 * s}" fill="#111"/>
    ${olhosVermelhos(cx, cy - 7 * s, 11 * s, 5 * s)}
    <path d="M${p(-16, -16)} l${10 * s} ${4 * s} M${p(16, -16)} l${-10 * s} ${4 * s}" stroke="#1f2937" stroke-width="4"/>
    <path d="M${p(-10, 20)} Q${p(0, 46)} ${p(10, 20)} Z" fill="#f97316" stroke="#c2410c" stroke-width="3"/>
    <path d="M${p(-5, 22)} Q${p(0, 36)} ${p(5, 22)} Z" fill="#fde047" stroke="none"/>`;
}

export const ORDEM_DOS_DESENHOS = Object.keys(DESENHOS);
export const ehMonstroDePapel = (tipo) => Boolean(DESENHOS[tipo]);

/** O SVG de um monstro (as cores são dele; não usa a cor do time). */
export function svgDoMonstro(tipo) {
  const desenho = DESENHOS[tipo] || DESENHOS.goblin;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -12 212 212" width="424" height="424"><g stroke="#1f2937" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${desenho()}</g></svg>`;
}

/** O desenho como URL de imagem, para usar fora do 3D (cartões das expedições, novidades). */
export const urlDoMonstro = (tipo) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoMonstro(tipo))}`;

/** Tamanho do recorte na ilha (lado do quadrado) e a altura de voo de quem voa. */
export const TAMANHO_DOS_MONSTROS = {
  cogumelo: 0.8, slime: 0.85, goblin: 0.85, bandido: 0.95, lobo: 1.05, aranha: 1.25,
  morcego: 0.85, esqueleto: 0.95, orc: 1.25, ent: 1.9, ogro: 1.8, cerbero: 2.3,
};
export const VOO_DOS_MONSTROS = { morcego: 1.2 };
