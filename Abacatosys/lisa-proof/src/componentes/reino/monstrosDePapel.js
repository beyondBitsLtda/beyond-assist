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

  // ---- o fundo do mar (23/10/2026)
  caranguejo: () => `
    <path d="M52 150 L30 176 M62 158 L48 184 M148 150 L170 176 M138 158 L152 184" stroke-width="7"/>
    <path d="M58 118 Q30 96 34 66" fill="none" stroke-width="10"/><path d="M142 118 Q170 96 166 66" fill="none" stroke-width="10"/>
    <path d="M20 62 Q22 34 44 40 L36 56 L52 58 Q48 78 24 76 Z" fill="#ef4444"/><path d="M180 62 Q178 34 156 40 L164 56 L148 58 Q152 78 176 76 Z" fill="#ef4444"/>
    <ellipse cx="100" cy="134" rx="56" ry="34" fill="#f87171"/>
    <path d="M70 122 q30 -14 60 0" fill="none" stroke="#b91c1c" stroke-width="4"/>
    <path d="M84 102 V84 M116 102 V84" stroke-width="6"/>
    <circle cx="84" cy="80" r="10" fill="#fff"/><circle cx="116" cy="80" r="10" fill="#fff"/>
    <circle cx="86" cy="82" r="5" fill="#1f2937" stroke="none"/><circle cx="114" cy="82" r="5" fill="#1f2937" stroke="none"/>
    <path d="M88 146 q12 8 24 0" fill="none"/>`,

  aguaViva: () => `
    <path d="M60 110 Q56 150 66 176 M80 112 Q86 150 78 184 M100 114 Q96 150 104 186 M120 112 Q114 150 124 182 M140 110 Q146 146 134 174" fill="none" stroke="#c084fc" stroke-width="7"/>
    <path d="M60 110 Q56 150 66 176 M80 112 Q86 150 78 184 M100 114 Q96 150 104 186 M120 112 Q114 150 124 182 M140 110 Q146 146 134 174" fill="none" stroke="#1f2937" stroke-width="2" opacity="0.5"/>
    <path d="M34 108 Q34 40 100 40 Q166 40 166 108 Q150 116 134 108 Q118 118 100 108 Q82 118 66 108 Q50 116 34 108 Z" fill="#e9d5ff"/>
    <ellipse cx="78" cy="64" rx="16" ry="9" fill="#fff" stroke="none" opacity="0.7" transform="rotate(-20 78 64)"/>
    ${olhos(100, 84, 16)}<path d="M92 98 q8 6 16 0" fill="none"/>
    <ellipse cx="72" cy="94" rx="6" ry="3.5" fill="#f9a8d4" stroke="none"/><ellipse cx="128" cy="94" rx="6" ry="3.5" fill="#f9a8d4" stroke="none"/>`,

  tritao: () => `
    <path d="M150 182 L172 30" stroke-width="12"/><path d="M150 182 L172 30" stroke="#fbbf24" stroke-width="6"/>
    <path d="M160 40 L162 14 M172 30 L174 6 M182 40 L186 14" stroke-width="6"/><path d="M158 42 Q172 50 186 42" fill="none" stroke-width="6"/>
    <path d="M78 140 Q70 170 54 184 Q86 176 100 160 Q114 176 146 184 Q130 170 122 140 Z" fill="#14b8a6"/>
    <path d="M70 100 Q100 88 130 100 L132 142 Q100 152 68 142 Z" fill="#5eead4"/>
    <path d="M80 112 q20 6 40 0 M80 126 q20 6 40 0" fill="none" stroke="#0f766e" stroke-width="3"/>
    <path d="M130 108 L156 132" stroke-width="12"/><path d="M130 108 L156 132" stroke="#5eead4" stroke-width="6"/>
    <circle cx="100" cy="70" r="30" fill="#5eead4"/>
    <path d="M70 60 L52 44 L66 70 Z M130 60 L148 44 L134 70 Z" fill="#14b8a6"/>
    <path d="M78 46 Q100 20 122 46" fill="#0d9488"/>
    ${olhos(100, 70, 12)}<path d="M90 86 q10 6 20 0" fill="none"/>`,

  tubarao: () => `
    <path d="M24 120 Q60 70 120 76 L104 40 L140 82 Q176 92 186 120 Q160 150 100 154 Q50 152 24 120 Z" fill="#64748b"/>
    <path d="M40 124 Q80 144 150 136 Q120 154 70 148 Z" fill="#e2e8f0"/>
    <path d="M24 120 L4 96 L12 124 L4 150 Z" fill="#475569"/>
    <path d="M92 150 L84 180 L110 152 Z" fill="#475569"/>
    <path d="M150 104 L176 92 L176 118 Z" fill="#475569"/>
    <circle cx="160" cy="104" r="6" fill="#fff"/><circle cx="161" cy="105" r="3" fill="#1f2937" stroke="none"/>
    <path d="M132 128 l6 8 6 -8 6 8 6 -8 6 8" fill="#fff" stroke-width="2.5"/>
    <path d="M110 100 q6 10 0 20 M120 98 q6 10 0 20" fill="none" stroke="#334155" stroke-width="3"/>`,

  kraken: () => `
    <path d="M40 150 Q10 160 16 186 Q30 170 52 170 M70 160 Q56 186 72 196 Q80 178 92 170 M130 160 Q144 186 128 196 Q120 178 108 170 M160 150 Q190 160 184 186 Q170 170 148 170" fill="#7c3aed"/>
    <path d="M22 120 Q-4 100 8 70 Q20 96 40 100 M178 120 Q204 100 192 70 Q180 96 160 100" fill="#6d28d9"/>
    <path d="M44 150 Q34 60 100 34 Q166 60 156 150 Q100 170 44 150 Z" fill="#8b5cf6"/>
    <circle cx="70" cy="78" r="8" fill="#c4b5fd" stroke="none"/><circle cx="132" cy="70" r="6" fill="#c4b5fd" stroke="none"/><circle cx="104" cy="54" r="5" fill="#c4b5fd" stroke="none"/>
    ${olhosAmarelos(100, 108, 22, 12)}
    <path d="M72 92 l18 8 M128 92 l-18 8" stroke="#1f2937" stroke-width="6"/>
    <path d="M84 136 Q100 126 116 136" fill="none" stroke-width="5"/>
    <circle cx="60" cy="168" r="4" fill="#ddd6fe" stroke="none"/><circle cx="140" cy="168" r="4" fill="#ddd6fe" stroke="none"/>`,

  // ---- as montanhas geladas
  bode: () => `
    <rect x="64" y="140" width="14" height="40" rx="5" fill="#a8a29e"/><rect x="122" y="140" width="14" height="40" rx="5" fill="#a8a29e"/>
    ${pes("#44403c", 186, 28)}
    <ellipse cx="100" cy="126" rx="54" ry="32" fill="#f5f5f4"/>
    <path d="M58 116 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0" fill="none" stroke="#d6d3d1" stroke-width="4"/>
    <path d="M74 64 Q40 40 46 80 Q54 66 70 74 M126 64 Q160 40 154 80 Q146 66 130 74" fill="#a16207"/>
    <path d="M70 70 Q70 44 100 44 Q130 44 130 70 L124 104 Q100 120 76 104 Z" fill="#e7e5e4"/>
    ${olhos(100, 74, 14, "#1f2937", 4)}
    <ellipse cx="100" cy="100" rx="12" ry="8" fill="#fda4af"/>
    <path d="M96 110 Q100 130 104 110 Z" fill="#d6d3d1"/>`,

  harpia: () => `
    <path d="M100 96 Q40 40 6 64 Q30 76 26 92 Q46 86 54 104 Q70 96 80 112 Z" fill="#92400e"/>
    <path d="M100 96 Q160 40 194 64 Q170 76 174 92 Q154 86 146 104 Q130 96 120 112 Z" fill="#92400e"/>
    <path d="M72 162 L64 186 M128 162 L136 186" stroke-width="8"/><path d="M56 186 h18 M126 186 h18" stroke-width="6"/>
    <ellipse cx="100" cy="128" rx="34" ry="40" fill="#b45309"/>
    <path d="M82 116 q18 8 36 0 M80 132 q20 8 40 0 M84 148 q16 6 32 0" fill="none" stroke="#78350f" stroke-width="3"/>
    <circle cx="100" cy="66" r="26" fill="#fcd9b6"/>
    <path d="M74 58 Q76 30 100 30 Q124 30 126 58 Q112 44 100 48 Q88 44 74 58 Z" fill="#7c2d12"/>
    ${olhosVermelhos(100, 64, 10, 5)}
    <path d="M94 76 L100 88 L106 76 Z" fill="#f59e0b"/>`,

  yeti: () => `
    <rect x="66" y="146" width="26" height="36" rx="10" fill="#e2e8f0"/><rect x="108" y="146" width="26" height="36" rx="10" fill="#e2e8f0"/>
    ${pes("#94a3b8", 186, 22)}
    <path d="M44 100 Q22 130 30 160 Q44 150 50 132 M156 100 Q178 130 170 160 Q156 150 150 132" fill="#f1f5f9"/>
    <path d="M40 160 q-6 10 4 14 q8 -2 8 -10 M160 160 q6 10 -4 14 q-8 -2 -8 -10" fill="#94a3b8"/>
    <path d="M46 110 Q40 50 100 42 Q160 50 154 110 Q156 158 100 160 Q44 158 46 110 Z" fill="#f8fafc"/>
    <path d="M60 80 q10 -8 20 0 M120 80 q10 -8 20 0 M66 130 q10 6 20 0 M114 130 q10 6 20 0" fill="none" stroke="#cbd5e1" stroke-width="4"/>
    <path d="M72 76 Q100 60 128 76 Q132 112 100 118 Q68 112 72 76 Z" fill="#93c5fd"/>
    ${olhos(100, 86, 13)}
    <path d="M84 104 Q100 116 116 104 Z" fill="#1f2937"/><path d="M90 104 l3 6 3 -6 M104 104 l3 6 3 -6" fill="#fff" stroke-width="2"/>`,

  golem: () => `
    <rect x="58" y="146" width="30" height="36" rx="6" fill="#78716c"/><rect x="112" y="146" width="30" height="36" rx="6" fill="#78716c"/>
    ${pes("#44403c", 186, 26)}
    <path d="M36 92 L22 150 L50 156 L58 104 Z M164 92 L178 150 L150 156 L142 104 Z" fill="#a8a29e"/>
    <path d="M18 150 h36 v22 h-36 z M146 150 h36 v22 h-36 z" fill="#78716c"/>
    <path d="M48 84 L152 84 L160 150 L40 150 Z" fill="#a8a29e"/>
    <path d="M64 100 l16 18 M130 104 l-12 22 M90 130 l20 6" fill="none" stroke="#57534e" stroke-width="4"/>
    <path d="M70 34 L130 34 L136 84 L64 84 Z" fill="#d6d3d1"/>
    <rect x="76" y="52" width="16" height="10" fill="#22d3ee" stroke-width="3"/><rect x="108" y="52" width="16" height="10" fill="#22d3ee" stroke-width="3"/>
    <path d="M84 72 h32" stroke-width="5"/>
    <path d="M60 32 l10 -12 M140 32 l-10 -12" stroke="#16a34a" stroke-width="5"/>`,

  giganteDeGelo: () => `
    <rect x="62" y="146" width="28" height="38" rx="8" fill="#93c5fd"/><rect x="110" y="146" width="28" height="38" rx="8" fill="#93c5fd"/>
    ${pes("#1e3a8a", 186, 24)}
    <path d="M160 150 L190 40" stroke-width="12"/><path d="M160 150 L190 40" stroke="#e0f2fe" stroke-width="6"/>
    <path d="M182 50 L198 26 L176 36 Z" fill="#bae6fd"/>
    <path d="M42 96 Q20 130 32 156 Q46 146 52 124 M158 96 Q172 116 164 140" fill="#bfdbfe"/>
    <path d="M48 100 Q46 60 100 56 Q154 60 152 100 L150 150 Q100 162 50 150 Z" fill="#dbeafe"/>
    <path d="M60 110 l14 20 M140 104 l-10 26 M92 136 l18 -6" fill="none" stroke="#60a5fa" stroke-width="4"/>
    <path d="M70 60 Q70 22 100 22 Q130 22 130 60 Q130 84 100 88 Q70 84 70 60 Z" fill="#bfdbfe"/>
    <path d="M70 26 L76 4 L86 22 L94 0 L102 20 L112 0 L118 22 L128 4 L130 26 Z" fill="#f0be45"/>
    ${olhos(100, 56, 13, "#1e40af", 5)}
    <path d="M84 72 Q100 64 116 72" fill="none" stroke-width="5"/>
    <path d="M78 82 q22 22 44 0" fill="#f8fafc" stroke-width="3"/>`,

  // ---- os reinos de fogo e lava
  diabrete: () => `
    <path d="M78 104 Q30 60 12 86 Q34 90 36 106 Q56 98 66 118 Z M122 104 Q170 60 188 86 Q166 90 164 106 Q144 98 134 118 Z" fill="#7f1d1d"/>
    <path d="M86 154 L80 182 M114 154 L120 182" stroke-width="9"/>
    <path d="M120 156 Q170 168 168 132 L160 138 L172 128 L158 128" fill="none" stroke-width="6"/>
    <ellipse cx="100" cy="132" rx="30" ry="30" fill="#dc2626"/>
    <circle cx="100" cy="84" r="32" fill="#ef4444"/>
    <path d="M74 64 L62 32 L86 56 Z M126 64 L138 32 L114 56 Z" fill="#facc15"/>
    ${olhosAmarelos(100, 82, 13, 9)}
    <path d="M84 100 Q100 112 116 100" fill="none" stroke-width="5"/><path d="M90 102 l3 6 3 -6 M104 102 l3 6 3 -6" fill="#fff" stroke-width="2"/>
    <path d="M150 120 Q160 100 150 84 Q166 96 162 116 Z" fill="#f97316" stroke="#c2410c" stroke-width="3"/>`,

  salamandra: () => `
    <path d="M40 150 Q14 140 16 116 Q30 132 48 134" fill="#ea580c"/>
    <path d="M60 158 L52 184 M88 162 L84 186 M120 162 L124 186 M148 158 L156 184" stroke-width="8"/>
    <ellipse cx="100" cy="142" rx="66" ry="26" fill="#f97316"/>
    <path d="M60 124 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0" fill="#fde047" stroke="#c2410c" stroke-width="3"/>
    <path d="M134 108 Q148 70 182 80 Q192 104 168 124 Q150 132 134 124 Z" fill="#f97316"/>
    ${olhosAmarelos(162, 96, 9, 7)}
    <path d="M176 114 q8 -2 12 6" fill="none" stroke-width="4"/>
    <path d="M186 104 Q204 96 200 80 Q194 94 184 96 Z" fill="#fde047" stroke="#c2410c" stroke-width="3"/>`,

  golemDeMagma: () => `
    <rect x="58" y="146" width="32" height="36" rx="6" fill="#292524"/><rect x="110" y="146" width="32" height="36" rx="6" fill="#292524"/>
    ${pes("#0c0a09", 186, 26)}
    <path d="M36 92 L20 152 L50 158 L60 104 Z M164 92 L180 152 L150 158 L140 104 Z" fill="#44403c"/>
    <path d="M46 84 L154 84 L162 152 L38 152 Z" fill="#44403c"/>
    <path d="M60 96 l20 22 l-8 18 M136 100 l-16 24 l12 16 M92 130 l18 4" fill="none" stroke="#f97316" stroke-width="6"/>
    <path d="M60 96 l20 22 l-8 18 M136 100 l-16 24 l12 16 M92 130 l18 4" fill="none" stroke="#fde047" stroke-width="2.5"/>
    <path d="M68 32 L132 32 L138 84 L62 84 Z" fill="#57534e"/>
    ${olhosAmarelos(100, 56, 16, 8)}
    <path d="M80 72 Q100 82 120 72" fill="#f97316" stroke-width="4"/>
    <path d="M86 32 Q90 12 100 20 Q108 6 116 32" fill="#f97316" stroke="#c2410c" stroke-width="3"/>`,

  dragaoDeLava: () => `
    <path d="M70 100 Q20 40 4 70 Q22 78 18 96 Q40 92 46 112 Z M130 100 Q180 40 196 70 Q178 78 182 96 Q160 92 154 112 Z" fill="#7f1d1d"/>
    <rect x="62" y="150" width="22" height="34" rx="8" fill="#450a0a"/><rect x="116" y="150" width="22" height="34" rx="8" fill="#450a0a"/>
    ${pes("#1c0505", 186, 27)}
    <path d="M150 152 Q196 150 192 110 L184 120 L196 108 L180 108" fill="none" stroke-width="8"/>
    <ellipse cx="100" cy="136" rx="56" ry="36" fill="#991b1b"/>
    <path d="M70 124 Q100 140 130 124 M74 140 Q100 154 126 140" fill="none" stroke="#f97316" stroke-width="4"/>
    <path d="M100 104 L100 80" stroke-width="22"/><path d="M100 104 L100 80" stroke="#991b1b" stroke-width="15"/>
    <path d="M66 60 Q66 28 100 26 Q134 28 134 60 Q134 84 100 90 Q66 84 66 60 Z" fill="#b91c1c"/>
    <path d="M72 34 L58 10 L84 28 Z M128 34 L142 10 L116 28 Z" fill="#fde68a"/>
    ${olhosAmarelos(100, 52, 15, 8)}
    <path d="M84 74 Q100 96 116 74 Z" fill="#f97316" stroke="#c2410c" stroke-width="3"/><path d="M92 76 Q100 88 108 76 Z" fill="#fde047" stroke="none"/>`,

  // ---- os alienígenas dos planetoides
  zorg: () => `
    <rect x="86" y="146" width="12" height="32" rx="5" fill="#16a34a"/><rect x="102" y="146" width="12" height="32" rx="5" fill="#16a34a"/>
    ${pes("#14532d", 184, 12)}
    <path d="M130 120 L170 108" stroke-width="12"/><path d="M130 120 L170 108" stroke="#22c55e" stroke-width="6"/>
    <rect x="160" y="96" width="26" height="14" rx="4" fill="#94a3b8"/><path d="M186 103 h12" stroke="#a3e635" stroke-width="6"/>
    <path d="M76 116 Q100 104 124 116 L126 150 Q100 158 74 150 Z" fill="#4ade80"/>
    <path d="M76 120 L52 142" stroke-width="10"/><path d="M76 120 L52 142" stroke="#22c55e" stroke-width="5"/>
    <ellipse cx="100" cy="72" rx="44" ry="38" fill="#86efac"/>
    <path d="M84 36 L72 10 M116 36 L128 10" stroke-width="5"/><circle cx="72" cy="10" r="6" fill="#a3e635"/><circle cx="128" cy="10" r="6" fill="#a3e635"/>
    <ellipse cx="82" cy="72" rx="14" ry="18" fill="#1f2937"/><ellipse cx="118" cy="72" rx="14" ry="18" fill="#1f2937"/>
    <circle cx="86" cy="66" r="4" fill="#fff" stroke="none"/><circle cx="122" cy="66" r="4" fill="#fff" stroke="none"/>
    <path d="M94 98 q6 4 12 0" fill="none"/>`,

  gosmoide: () => `
    <path d="M20 184 Q8 136 46 112 Q50 60 100 56 Q150 60 154 112 Q192 136 180 184 Q100 196 20 184 Z" fill="#a3e635"/>
    <path d="M40 184 q4 12 12 10 M150 184 q2 14 12 10" fill="#a3e635"/>
    <circle cx="70" cy="140" r="10" fill="#bef264" stroke="none"/><circle cx="140" cy="150" r="7" fill="#bef264" stroke="none"/><circle cx="110" cy="170" r="5" fill="#bef264" stroke="none"/>
    <circle cx="80" cy="100" r="15" fill="#fff"/><circle cx="120" cy="98" r="11" fill="#fff"/><circle cx="102" cy="76" r="8" fill="#fff"/>
    <circle cx="83" cy="103" r="7" fill="#1f2937" stroke="none"/><circle cx="118" cy="100" r="5" fill="#1f2937" stroke="none"/><circle cx="102" cy="78" r="4" fill="#1f2937" stroke="none"/>
    <path d="M84 128 Q100 140 116 128" fill="none" stroke-width="5"/>`,

  insetoide: () => `
    <path d="M70 140 L36 170 M76 150 L56 186 M130 140 L164 170 M124 150 L144 186 M72 128 L34 132 M128 128 L166 132" stroke-width="7"/>
    <ellipse cx="100" cy="150" rx="34" ry="28" fill="#0f766e"/>
    <path d="M74 140 q26 10 52 0 M76 156 q24 10 48 0" fill="none" stroke="#134e4a" stroke-width="4"/>
    <ellipse cx="100" cy="112" rx="26" ry="20" fill="#14b8a6"/>
    <path d="M66 96 Q20 70 30 120 Q50 100 70 108 Z M134 96 Q180 70 170 120 Q150 100 130 108 Z" fill="#99f6e4" opacity="0.85"/>
    <ellipse cx="100" cy="72" rx="28" ry="24" fill="#2dd4bf"/>
    <path d="M86 50 Q70 20 56 24 M114 50 Q130 20 144 24" fill="none" stroke-width="4"/>
    <ellipse cx="86" cy="70" rx="10" ry="12" fill="#dc2626"/><ellipse cx="114" cy="70" rx="10" ry="12" fill="#dc2626"/>
    <path d="M90 90 L86 100 M110 90 L114 100" stroke-width="5"/>`,

  ciborgue: () => `
    <rect x="68" y="146" width="24" height="36" rx="6" fill="#64748b"/><rect x="108" y="146" width="24" height="36" rx="6" fill="#64748b"/>
    ${pes("#1e293b", 186, 20)}
    <path d="M136 110 L176 110" stroke-width="18"/><path d="M136 110 L176 110" stroke="#94a3b8" stroke-width="10"/>
    <circle cx="182" cy="110" r="8" fill="#f97316"/>
    <path d="M64 100 L44 146" stroke-width="14"/><path d="M64 100 L44 146" stroke="#94a3b8" stroke-width="7"/>
    <path d="M60 90 L140 90 L136 150 L64 150 Z" fill="#94a3b8"/>
    <rect x="84" y="104" width="32" height="24" rx="4" fill="#0ea5e9"/><path d="M90 116 h20" stroke="#bae6fd" stroke-width="4"/>
    <path d="M70 40 Q70 26 100 26 Q130 26 130 40 L130 82 Q100 92 70 82 Z" fill="#cbd5e1"/>
    <path d="M100 26 V82" stroke="#64748b" stroke-width="3"/>
    <circle cx="86" cy="56" r="8" fill="#fff"/><circle cx="87" cy="57" r="4" fill="#1f2937" stroke="none"/>
    <rect x="104" y="48" width="20" height="14" rx="3" fill="#ef4444"/>
    <path d="M84 74 h32" stroke-width="4"/>`,

  cristalino: () => `
    <path d="M66 184 L76 140 L92 184 Z M108 184 L124 140 L134 184 Z" fill="#7dd3fc"/>
    <path d="M40 120 L22 70 L56 104 Z M160 120 L178 70 L144 104 Z" fill="#a5b4fc"/>
    <path d="M100 20 L156 80 L140 150 L60 150 L44 80 Z" fill="#c4b5fd"/>
    <path d="M100 20 L100 150 M44 80 L156 80 M60 150 L100 80 L140 150" fill="none" stroke="#7c3aed" stroke-width="3"/>
    <path d="M70 46 L84 34 L80 60 Z" fill="#fff" stroke="none" opacity="0.7"/>
    ${olhos(100, 104, 16, "#312e81", 6)}
    <path d="M88 124 h24" stroke-width="5"/>`,

  polvoEstelar: () => `
    <path d="M56 130 Q30 160 46 184 Q54 160 70 150 M76 140 Q66 172 82 190 Q88 166 96 152 M124 140 Q134 172 118 190 Q112 166 104 152 M144 130 Q170 160 154 184 Q146 160 130 150" fill="#ec4899"/>
    <path d="M44 132 Q34 50 100 38 Q166 50 156 132 Q100 150 44 132 Z" fill="#f472b6"/>
    <circle cx="66" cy="76" r="6" fill="#fbcfe8" stroke="none"/><circle cx="138" cy="70" r="8" fill="#fbcfe8" stroke="none"/><circle cx="112" cy="54" r="4" fill="#fbcfe8" stroke="none"/>
    <path d="M100 38 L100 18" stroke-width="5"/><path d="M100 4 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#fde047"/>
    <circle cx="100" cy="96" r="22" fill="#fff"/><circle cx="100" cy="98" r="12" fill="#1f2937" stroke="none"/><circle cx="105" cy="93" r="4" fill="#fff" stroke="none"/>
    <path d="M86 124 Q100 132 114 124" fill="none" stroke-width="4"/>`,

  disco: () => `
    <path d="M70 150 L56 180 M100 154 V186 M130 150 L144 180" stroke="#fde047" stroke-width="8" opacity="0.8"/>
    <ellipse cx="100" cy="122" rx="86" ry="28" fill="#94a3b8"/>
    <ellipse cx="100" cy="116" rx="86" ry="20" fill="#cbd5e1"/>
    <path d="M52 92 Q56 46 100 44 Q144 46 148 92 Z" fill="#67e8f9" opacity="0.85"/>
    <circle cx="100" cy="76" r="16" fill="#86efac"/><ellipse cx="94" cy="74" rx="4" ry="6" fill="#1f2937" stroke="none"/><ellipse cx="106" cy="74" rx="4" ry="6" fill="#1f2937" stroke="none"/>
    <path d="M70 58 Q80 50 90 52" fill="none" stroke="#fff" stroke-width="5" opacity="0.8"/>
    <circle cx="40" cy="122" r="6" fill="#fde047"/><circle cx="70" cy="132" r="6" fill="#f472b6"/><circle cx="100" cy="136" r="6" fill="#fde047"/><circle cx="130" cy="132" r="6" fill="#f472b6"/><circle cx="160" cy="122" r="6" fill="#fde047"/>`,

  rainhaAlien: () => `
    <path d="M64 120 Q20 110 10 70 Q36 92 60 96 M136 120 Q180 110 190 70 Q164 92 140 96" fill="#6d28d9"/>
    <rect x="76" y="150" width="18" height="34" rx="7" fill="#4c1d95"/><rect x="106" y="150" width="18" height="34" rx="7" fill="#4c1d95"/>
    ${pes("#2e1065", 186, 15)}
    <path d="M56 156 Q60 104 100 98 Q140 104 144 156 Q100 166 56 156 Z" fill="#7c3aed"/>
    <path d="M70 130 Q100 142 130 130" fill="none" stroke="#c4b5fd" stroke-width="4"/>
    <path d="M58 64 Q48 18 100 14 Q152 18 142 64 Q140 98 100 104 Q60 98 58 64 Z" fill="#a78bfa"/>
    <path d="M62 30 L54 0 L76 22 L86 -4 L100 18 L114 -4 L124 22 L146 0 L138 30 Q100 16 62 30 Z" fill="#f0be45"/>
    <circle cx="100" cy="10" r="5" fill="#22d3ee" stroke="none"/>
    <ellipse cx="82" cy="62" rx="12" ry="15" fill="#1f2937"/><ellipse cx="118" cy="62" rx="12" ry="15" fill="#1f2937"/>
    <circle cx="85" cy="57" r="4" fill="#22d3ee" stroke="none"/><circle cx="121" cy="57" r="4" fill="#22d3ee" stroke="none"/>
    <path d="M90 86 Q100 92 110 86" fill="none" stroke-width="4"/>`,
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
  caranguejo: 0.95, aguaViva: 0.85, tritao: 1.05, tubarao: 1.3, kraken: 2.3,
  bode: 0.95, harpia: 0.95, yeti: 1.5, golem: 1.8, giganteDeGelo: 2.4,
  diabrete: 0.8, salamandra: 1.15, golemDeMagma: 1.85, dragaoDeLava: 2.4,
  zorg: 0.85, gosmoide: 1.1, insetoide: 1.0, ciborgue: 1.35, cristalino: 1.6, polvoEstelar: 1.1, disco: 1.2, rainhaAlien: 2.1,
};
export const VOO_DOS_MONSTROS = { morcego: 1.2, aguaViva: 1.0, harpia: 1.3, diabrete: 1.1, disco: 1.4 };
