// Os 20 tripulantes novos das ilhas (06/11/2026: "crie mais 20 tipos de tripulação"), no mesmo papel recortado das
// outras tropas (tropasDePapel.js): desenho em 200×200, pés perto de y = 190, `c` = a cor do time, `e` = a cor do
// time escurecida. O contorno grosso vem de quem embrulha o desenho (svgDaTropa).

const PELE = "#f2d3b1";
const PELE_MORENA = "#c98b5b";
const olhos = (cx, cy, d = 10) => `<circle cx="${cx - d}" cy="${cy}" r="4.5" fill="#1f2937" stroke="none"/><circle cx="${cx + d}" cy="${cy}" r="4.5" fill="#1f2937" stroke="none"/><circle cx="${cx - d + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#fff" stroke="none"/><circle cx="${cx + d + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#fff" stroke="none"/>`;
const sorriso = (cx, cy) => `<path d="M${cx - 8} ${cy} q8 7 16 0" fill="none"/>`;
const bochechas = (cx, cy, d = 17) => `<ellipse cx="${cx - d}" cy="${cy}" rx="5" ry="3" fill="#f9a8d4" stroke="none" opacity="0.8"/><ellipse cx="${cx + d}" cy="${cy}" rx="5" ry="3" fill="#f9a8d4" stroke="none" opacity="0.8"/>`;
const pernas = (cor = "#4b5563") => `<rect x="80" y="152" width="15" height="32" rx="6" fill="${cor}"/><rect x="105" y="152" width="15" height="32" rx="6" fill="${cor}"/><ellipse cx="86" cy="187" rx="14" ry="7" fill="#3a2a1e"/><ellipse cx="114" cy="187" rx="14" ry="7" fill="#3a2a1e"/>`;
const tronco = (cor) => `<path d="M62 102 Q100 90 138 102 L146 158 Q100 170 54 158 Z" fill="${cor}"/>`;
const cinto = `<rect x="58" y="138" width="84" height="11" rx="4" fill="#3a2a1e"/><rect x="94" y="137" width="12" height="13" rx="2" fill="#f0be45"/>`;
const rosto = (pele = PELE, cy = 72) => `<circle cx="100" cy="${cy}" r="30" fill="${pele}"/>${olhos(100, cy + 2)}${sorriso(100, cy + 14)}${bochechas(100, cy + 12)}`;
const tricornio = (cor, enfeite) => `<path d="M52 54 Q100 18 148 54 Q124 44 100 46 Q76 44 52 54 Z" fill="${cor}"/><path d="M60 52 Q100 30 140 52" fill="none" stroke="${enfeite}" stroke-width="4"/>`;

export const DESENHOS_DA_TRIPULACAO = {
  // ---- Porto 1
  marujo: (c) => `
    ${pernas("#1e3a8a")}
    <path d="M148 132 L166 104" stroke="#1f2937" stroke-width="10"/><path d="M148 132 L166 104" stroke="#e5e7eb" stroke-width="5"/>
    ${tronco("#f8fafc")}
    <path d="M60 114 H140 M58 128 H142 M56 142 H144" stroke="${c}" stroke-width="7"/>
    ${rosto()}
    <path d="M68 62 Q70 38 100 36 Q130 38 132 62 Q100 50 68 62 Z" fill="${c}"/>
    <path d="M130 56 l18 -6 l-6 14 z" fill="${c}"/>`,

  mosqueteira: (c, e) => `
    ${pernas("#3f3f46")}
    <path d="M28 150 L176 66" stroke="#1f2937" stroke-width="12"/><path d="M28 150 L176 66" stroke="#8a5a2b" stroke-width="6"/>
    <path d="M150 80 L178 64" stroke="#6b7280" stroke-width="8"/>
    <path d="M60 100 Q100 88 140 100 L152 168 Q100 176 48 168 Z" fill="${c}"/>
    <path d="M100 98 V166" stroke="${e}" stroke-width="6"/><circle cx="100" cy="116" r="4" fill="#f0be45"/><circle cx="100" cy="134" r="4" fill="#f0be45"/>
    <path d="M70 80 Q66 112 78 120 M130 80 Q134 112 122 120" fill="none" stroke="#7a3b1f" stroke-width="10"/>
    ${rosto()}
    ${tricornio("#1f2937", c)}
    <path d="M128 40 Q150 22 156 4 Q140 18 122 34" fill="#f472b6"/>`,

  cozinheiro: (c) => `
    ${pernas()}
    <path d="M140 118 L170 92" stroke="#1f2937" stroke-width="8"/><ellipse cx="174" cy="88" rx="11" ry="7" fill="#9ca3af"/>
    ${tronco(c)}
    <path d="M74 104 L126 104 L132 166 L68 166 Z" fill="#f8fafc"/><path d="M84 132 H116" stroke="${c}" stroke-width="4"/>
    <rect x="22" y="128" width="40" height="30" rx="8" fill="#6b7280"/><path d="M28 120 q6 -12 0 -22 M42 120 q6 -12 0 -22" fill="none" stroke="#e5e7eb" stroke-width="4"/>
    ${rosto()}
    <path d="M80 84 Q100 94 120 84" fill="none" stroke="#7a3b1f" stroke-width="5"/>
    <rect x="70" y="30" width="60" height="16" rx="4" fill="#f8fafc"/><circle cx="78" cy="24" r="14" fill="#f8fafc"/><circle cx="100" cy="16" r="16" fill="#f8fafc"/><circle cx="122" cy="24" r="14" fill="#f8fafc"/>`,

  gaivota: (c) => `
    <path d="M96 108 Q50 60 8 74 Q40 96 54 128 Z" fill="#e5e7eb"/><path d="M104 108 Q150 60 192 74 Q160 96 146 128 Z" fill="#e5e7eb"/>
    <path d="M8 74 Q22 84 30 82 M192 74 Q178 84 170 82" fill="none" stroke="#6b7280" stroke-width="6"/>
    <ellipse cx="100" cy="124" rx="34" ry="30" fill="#f8fafc"/>
    <path d="M90 150 L84 174 M110 150 L116 174" stroke="#f59e0b" stroke-width="6"/>
    <circle cx="100" cy="84" r="24" fill="#f8fafc"/>
    <circle cx="92" cy="80" r="4" fill="#1f2937" stroke="none"/><circle cx="112" cy="80" r="4" fill="#1f2937" stroke="none"/>
    <path d="M96 90 L124 96 L96 100 Z" fill="#f59e0b"/>
    <path d="M78 102 Q100 112 122 102 L118 114 Q100 120 82 114 Z" fill="${c}"/>`,

  // ---- Porto 2
  bucaneiro: (c, e) => `
    ${pernas("#3a2a1e")}
    <path d="M150 140 L170 40" stroke="#1f2937" stroke-width="10"/><path d="M150 140 L170 40" stroke="#8a5a2b" stroke-width="5"/>
    <path d="M166 34 Q196 46 186 78 Q176 60 160 58 Z" fill="#d1d5db"/>
    ${tronco(c)}
    <path d="M78 100 L100 130 L122 100" fill="none" stroke="${e}" stroke-width="8"/>
    ${cinto}
    <circle cx="100" cy="70" r="30" fill="${PELE_MORENA}"/>${olhos(100, 66)}
    <path d="M72 76 Q72 112 100 116 Q128 112 128 76 Q114 88 100 86 Q86 88 72 76 Z" fill="#7a3b1f"/>
    <path d="M90 82 h20" fill="none" stroke-width="4"/>
    <circle cx="70" cy="76" r="5" fill="none" stroke="#f0be45" stroke-width="3"/>`,

  ancoreiro: (c) => `
    ${pernas("#1e3a8a")}
    <path d="M44 128 Q100 92 156 128 L158 162 Q100 174 42 162 Z" fill="${c}"/>
    <path d="M40 104 Q26 128 40 150 M160 104 Q174 128 160 150" fill="none" stroke="#1f2937" stroke-width="18"/><path d="M40 104 Q26 128 40 150 M160 104 Q174 128 160 150" fill="none" stroke="${PELE}" stroke-width="11"/>
    <path d="M150 20 V112" stroke="#6b7280" stroke-width="10"/><circle cx="150" cy="18" r="9" fill="none" stroke="#6b7280" stroke-width="6"/>
    <path d="M120 98 Q150 132 180 98" fill="none" stroke="#6b7280" stroke-width="10"/><path d="M134 52 H166" stroke="#6b7280" stroke-width="8"/>
    ${rosto(PELE, 76)}
    <path d="M70 66 Q70 44 100 44 Q130 44 130 66 Z" fill="${c}"/><rect x="66" y="62" width="68" height="8" rx="3" fill="#1f2937"/>`,

  macaco: (c) => `
    <path d="M128 160 Q176 160 170 120 Q166 100 150 108" fill="none" stroke="#1f2937" stroke-width="12"/><path d="M128 160 Q176 160 170 120 Q166 100 150 108" fill="none" stroke="#8a5a2b" stroke-width="6"/>
    <ellipse cx="86" cy="182" rx="14" ry="8" fill="#8a5a2b"/><ellipse cx="116" cy="182" rx="14" ry="8" fill="#8a5a2b"/>
    <ellipse cx="100" cy="146" rx="36" ry="36" fill="#8a5a2b"/><ellipse cx="100" cy="152" rx="22" ry="24" fill="#e8c39e"/>
    <path d="M66 128 L40 104 M134 128 L160 104" stroke="#1f2937" stroke-width="12"/><path d="M66 128 L40 104 M134 128 L160 104" stroke="#8a5a2b" stroke-width="6"/>
    <path d="M156 100 Q170 82 164 70 Q176 86 162 104 Z" fill="#fde047"/>
    <circle cx="64" cy="82" r="14" fill="#8a5a2b"/><circle cx="136" cy="82" r="14" fill="#8a5a2b"/>
    <circle cx="100" cy="82" r="30" fill="#8a5a2b"/><ellipse cx="100" cy="90" rx="22" ry="18" fill="#e8c39e"/>
    ${olhos(100, 80, 9)}${sorriso(100, 96)}
    <path d="M72 66 Q100 48 128 66 Q100 58 72 66 Z" fill="${c}"/><path d="M126 64 l14 -4 l-4 12 z" fill="${c}"/>`,

  caranguejoCouracado: (c, e) => `
    <path d="M60 150 L34 178 M74 156 L58 186 M140 150 L166 178 M126 156 L142 186" stroke="#1f2937" stroke-width="10"/><path d="M60 150 L34 178 M74 156 L58 186 M140 150 L166 178 M126 156 L142 186" stroke="#ef4444" stroke-width="5"/>
    <path d="M52 120 L22 92 M148 120 L178 92" stroke="#1f2937" stroke-width="12"/><path d="M52 120 L22 92 M148 120 L178 92" stroke="#ef4444" stroke-width="6"/>
    <path d="M6 82 Q22 50 40 74 L26 88 Q30 70 20 70 Z" fill="#ef4444"/><path d="M194 82 Q178 50 160 74 L174 88 Q170 70 180 70 Z" fill="#ef4444"/>
    <ellipse cx="100" cy="132" rx="58" ry="38" fill="#ef4444"/>
    <path d="M50 126 Q100 82 150 126 Q100 108 50 126 Z" fill="${c}"/><path d="M70 138 Q100 150 130 138" fill="none" stroke="${e}" stroke-width="5"/><circle cx="100" cy="100" r="7" fill="#f0be45"/>
    <path d="M86 98 V74 M114 98 V74" stroke="#1f2937" stroke-width="6"/>
    <circle cx="86" cy="70" r="10" fill="#f8fafc"/><circle cx="114" cy="70" r="10" fill="#f8fafc"/><circle cx="88" cy="70" r="4.5" fill="#1f2937" stroke="none"/><circle cx="116" cy="70" r="4.5" fill="#1f2937" stroke="none"/>
    ${sorriso(100, 136)}`,

  sereia: (c) => `
    <path d="M86 150 Q70 182 46 188 Q80 194 100 172 Q120 194 154 188 Q130 182 114 150 Z" fill="#14b8a6"/>
    <path d="M70 110 Q100 100 130 110 Q134 140 114 156 H86 Q66 140 70 110 Z" fill="#2dd4bf"/>
    <path d="M78 124 q6 6 12 0 M100 128 q6 6 12 0 M88 140 q6 6 12 0" fill="none" stroke="#0f766e" stroke-width="3"/>
    <path d="M74 106 Q86 98 96 106 Q86 116 74 106 Z M104 106 Q114 98 126 106 Q114 116 104 106 Z" fill="${c}"/>
    <path d="M60 64 Q56 140 76 150 Q64 110 72 74 Z M140 64 Q144 140 124 150 Q136 110 128 74 Z" fill="#f97316"/>
    ${rosto(PELE, 74)}
    <path d="M66 74 Q64 36 100 34 Q136 36 134 74 Q122 50 100 50 Q78 50 66 74 Z" fill="#f97316"/>
    <path d="M146 60 l6 -16 l6 14 M156 40 l10 -10" fill="none" stroke="${c}" stroke-width="5"/><circle cx="164" cy="28" r="5" fill="${c}"/>`,

  // ---- Porto 3
  canhoneira: (c, e) => `
    ${pernas("#3f3f46")}
    ${tronco(c)}
    <path d="M70 104 L130 160 M130 104 L70 160" stroke="${e}" stroke-width="7"/>
    <rect x="26" y="56" width="120" height="30" rx="14" fill="#1f2937" transform="rotate(-18 86 71)"/>
    <circle cx="146" cy="50" r="13" fill="#374151"/><circle cx="146" cy="50" r="6" fill="#111827" stroke="none"/>
    <path d="M40 92 l-8 10 M30 84 l-12 4" stroke="#f97316" stroke-width="5"/>
    ${rosto(PELE, 76)}
    <rect x="72" y="62" width="56" height="12" rx="6" fill="none" stroke="#1f2937" stroke-width="4"/><circle cx="88" cy="68" r="7" fill="#93c5fd" opacity="0.8"/><circle cx="112" cy="68" r="7" fill="#93c5fd" opacity="0.8"/>
    <path d="M66 56 Q100 30 134 56 Z" fill="${c}"/>`,

  gancho: (c, e) => `
    ${pernas("#1f2937")}
    <path d="M58 100 Q100 88 142 100 L154 170 Q100 178 46 170 Z" fill="${c}"/>
    <path d="M100 98 L84 170 M100 98 L116 170" stroke="${e}" stroke-width="5"/>
    <path d="M150 112 L168 140" stroke="#1f2937" stroke-width="12"/><path d="M150 112 L168 140" stroke="${c}" stroke-width="6"/>
    <path d="M170 142 Q186 160 172 172 Q158 178 154 164" fill="none" stroke="#1f2937" stroke-width="9"/><path d="M170 142 Q186 160 172 172 Q158 178 154 164" fill="none" stroke="#d1d5db" stroke-width="4"/>
    ${rosto()}
    <path d="M80 84 Q90 78 100 84 Q110 78 120 84 Q110 92 100 88 Q90 92 80 84 Z" fill="#1f2937"/>
    ${tricornio("#1f2937", "#f0be45")}
    <circle cx="100" cy="40" r="7" fill="#f8fafc" stroke-width="2"/>`,

  polvoDeGuerra: (c) => `
    <path d="M44 120 Q16 150 30 186 Q44 160 60 150 M70 136 Q52 168 64 194 Q78 168 84 150 M100 140 Q100 172 100 196 M130 136 Q148 168 136 194 Q122 168 116 150 M156 120 Q184 150 170 186 Q156 160 140 150" fill="none" stroke="#1f2937" stroke-width="18"/>
    <path d="M44 120 Q16 150 30 186 Q44 160 60 150 M70 136 Q52 168 64 194 Q78 168 84 150 M100 140 Q100 172 100 196 M130 136 Q148 168 136 194 Q122 168 116 150 M156 120 Q184 150 170 186 Q156 160 140 150" fill="none" stroke="#a855f7" stroke-width="11"/>
    <ellipse cx="100" cy="94" rx="62" ry="58" fill="#a855f7"/>
    <circle cx="80" cy="100" r="13" fill="#f8fafc"/><circle cx="82" cy="102" r="6" fill="#1f2937" stroke="none"/>
    <ellipse cx="122" cy="100" rx="14" ry="11" fill="#1f2937"/><path d="M60 82 L150 112" stroke-width="3"/>
    <path d="M86 126 q14 8 28 0" fill="none"/>
    <path d="M44 56 Q100 4 156 56 Q100 40 44 56 Z" fill="${c}"/>`,

  navegadora: (c) => `
    ${pernas("#334155")}
    <rect x="132" y="80" width="54" height="14" rx="6" fill="#b45309" transform="rotate(-24 159 87)"/><circle cx="180" cy="74" r="8" fill="#fde68a"/>
    ${tronco(c)}
    <circle cx="100" cy="132" r="18" fill="#f0be45"/><circle cx="100" cy="132" r="12" fill="#f8fafc"/><path d="M100 122 L104 132 L100 142 L96 132 Z" fill="#ef4444" stroke-width="2"/>
    ${rosto()}
    <path d="M68 76 Q64 40 100 38 Q136 40 132 76 Q124 54 100 54 Q76 54 68 76 Z" fill="#1e293b"/>
    <path d="M58 54 Q100 22 142 54 Z" fill="${c}"/><path d="M100 28 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1 z" fill="#fde047" stroke-width="2"/>`,

  fantasma: (c) => `
    <path d="M52 92 Q52 30 100 30 Q148 30 148 92 L148 168 Q136 182 124 168 Q112 182 100 168 Q88 182 76 168 Q64 182 52 168 Z" fill="#e0f2fe" opacity="0.92"/>
    <path d="M60 120 L28 98 M140 120 L172 98" stroke="#1f2937" stroke-width="10"/><path d="M60 120 L28 98 M140 120 L172 98" stroke="#e0f2fe" stroke-width="5"/>
    <path d="M172 96 L184 60" stroke="#94a3b8" stroke-width="6"/>
    <ellipse cx="84" cy="88" rx="9" ry="12" fill="#1f2937" stroke="none"/><ellipse cx="116" cy="88" rx="9" ry="12" fill="#1f2937" stroke="none"/>
    <ellipse cx="100" cy="116" rx="10" ry="8" fill="#1f2937" stroke="none"/>
    ${tricornio(c, "#e0f2fe")}
    <path d="M60 150 Q100 140 140 150" fill="none" stroke="#94a3b8" stroke-width="5" stroke-dasharray="6 6"/>`,

  // ---- Porto 4
  tartaruga: (c, e) => `
    <ellipse cx="54" cy="176" rx="18" ry="12" fill="#65a30d"/><ellipse cx="146" cy="176" rx="18" ry="12" fill="#65a30d"/>
    <path d="M150 128 Q186 118 188 92 Q170 76 152 96 Z" fill="#65a30d"/>
    <circle cx="176" cy="96" r="4" fill="#1f2937" stroke="none"/><path d="M168 110 q8 4 14 -2" fill="none" stroke-width="3"/>
    <path d="M24 160 Q30 70 100 64 Q170 70 176 160 Z" fill="#15803d"/>
    <path d="M60 158 L74 100 L126 100 L140 158 M74 100 L100 78 L126 100 M40 130 H160" fill="none" stroke="#14532d" stroke-width="5"/>
    <path d="M28 158 Q100 174 172 158" fill="none" stroke="${c}" stroke-width="12"/>
    <path d="M86 86 L100 70 L114 86 Z" fill="${e}"/>`,

  filhoteKraken: (c) => `
    <path d="M58 140 Q30 168 44 196 M78 150 Q66 178 82 198 M100 152 Q102 182 96 198 M122 150 Q134 178 118 198 M142 140 Q170 168 156 196" fill="none" stroke="#1f2937" stroke-width="16"/>
    <path d="M58 140 Q30 168 44 196 M78 150 Q66 178 82 198 M100 152 Q102 182 96 198 M122 150 Q134 178 118 198 M142 140 Q170 168 156 196" fill="none" stroke="#ec4899" stroke-width="9"/>
    <path d="M100 8 Q160 60 150 140 Q100 158 50 140 Q40 60 100 8 Z" fill="#ec4899"/>
    <path d="M100 8 Q122 40 120 70 M100 8 Q78 40 80 70" fill="none" stroke="#be185d" stroke-width="5"/>
    <circle cx="80" cy="104" r="15" fill="#fef9c3"/><circle cx="120" cy="104" r="15" fill="#fef9c3"/>
    <circle cx="82" cy="106" r="7" fill="#1f2937" stroke="none"/><circle cx="122" cy="106" r="7" fill="#1f2937" stroke="none"/>
    <path d="M56 124 Q100 140 144 124" fill="none" stroke="${c}" stroke-width="10"/>`,

  albatroz: (c) => `
    <path d="M94 104 Q48 70 2 88 Q40 104 60 132 Z" fill="#f8fafc"/><path d="M106 104 Q152 70 198 88 Q160 104 140 132 Z" fill="#f8fafc"/>
    <path d="M2 88 Q24 100 40 98 M198 88 Q176 100 160 98" fill="none" stroke="#1f2937" stroke-width="8"/>
    <ellipse cx="100" cy="124" rx="40" ry="32" fill="#f8fafc"/>
    <circle cx="100" cy="166" r="16" fill="#7c4a2d"/><path d="M92 160 l4 4 M104 160 l4 4" stroke-width="3"/>
    <path d="M86 150 L94 158 M114 150 L106 158" stroke="#f59e0b" stroke-width="6"/>
    <circle cx="100" cy="82" r="26" fill="#f8fafc"/>
    <circle cx="90" cy="78" r="4.5" fill="#1f2937" stroke="none"/><circle cx="112" cy="78" r="4.5" fill="#1f2937" stroke="none"/>
    <path d="M96 88 L136 96 L128 104 L96 98 Z" fill="#fbbf24"/>
    <path d="M74 102 Q100 114 126 102 L130 116 Q100 124 70 116 Z" fill="${c}"/>`,

  bruxa: (c, e) => `
    <path d="M150 190 L166 50" stroke="#1f2937" stroke-width="10"/><path d="M150 190 L166 50" stroke="#6b4f2a" stroke-width="5"/>
    <circle cx="168" cy="42" r="14" fill="#22d3ee"/><circle cx="164" cy="38" r="4" fill="#f8fafc" stroke="none"/>
    <path d="M56 100 Q100 86 144 100 L160 188 Q100 196 40 188 Z" fill="${c}"/>
    <path d="M60 140 Q100 152 140 140" fill="none" stroke="${e}" stroke-width="6"/>
    <path d="M62 66 Q50 130 70 150 Q66 110 74 80 Z M138 66 Q150 130 130 150 Q134 110 126 80 Z" fill="#16a34a"/>
    <circle cx="100" cy="74" r="30" fill="#a7f3d0"/>${olhos(100, 76)}<path d="M90 90 q10 5 20 0" fill="none"/>
    <path d="M64 70 Q62 36 100 34 Q138 36 136 70 Q124 50 100 50 Q76 50 64 70 Z" fill="#16a34a"/>
    <path d="M60 50 L100 -2 L140 50 Z" fill="${e}"/><circle cx="100" cy="30" r="5" fill="#fde047"/>`,

  // ---- Porto 5
  capita: (c, e) => `
    ${pernas("#1f2937")}
    <path d="M30 150 L18 46" stroke="#1f2937" stroke-width="10"/><path d="M30 150 L18 46" stroke="#e5e7eb" stroke-width="5"/>
    <rect x="18" y="140" width="26" height="9" rx="3" fill="#f0be45" transform="rotate(-6 31 144)"/>
    <path d="M54 98 Q100 84 146 98 L158 176 Q100 186 42 176 Z" fill="${c}"/>
    <path d="M100 96 L78 176 M100 96 L122 176" stroke="#f0be45" stroke-width="5"/>
    <path d="M50 96 Q66 82 78 96 Q64 104 50 96 Z M122 96 Q134 82 150 96 Q136 104 122 96 Z" fill="#f0be45"/>
    ${rosto()}
    <path d="M68 74 Q60 112 74 128 Q72 98 78 82 Z M132 74 Q140 112 126 128 Q128 98 122 82 Z" fill="#7a3b1f"/>
    <path d="M42 52 Q100 6 158 52 Q130 40 100 42 Q70 40 42 52 Z" fill="#111827"/>
    <path d="M52 50 Q100 22 148 50" fill="none" stroke="#f0be45" stroke-width="5"/>
    <path d="M120 26 Q160 0 176 12 Q150 14 132 34 Z" fill="#ef4444"/><path d="M128 30 Q166 14 184 30 Q154 28 136 40 Z" fill="${e}"/>
    <path d="M88 32 l6 -12 l6 10 l6 -10 l6 12 z" fill="#f0be45"/>`,

  golemDeCoral: (c) => `
    <rect x="66" y="150" width="26" height="36" rx="8" fill="#a8a29e"/><rect x="108" y="150" width="26" height="36" rx="8" fill="#a8a29e"/>
    <path d="M36 104 L14 152 L34 162 L56 118 Z M164 104 L186 152 L166 162 L144 118 Z" fill="#fb7185"/>
    <path d="M38 100 Q100 78 162 100 L168 160 Q100 176 32 160 Z" fill="#d6d3d1"/>
    <path d="M58 158 Q54 122 64 108 Q60 128 72 132 M140 158 Q146 122 134 108 Q140 128 128 132" fill="none" stroke="#fb7185" stroke-width="8"/>
    <path d="M60 120 Q100 134 140 120" fill="none" stroke="${c}" stroke-width="10"/>
    <circle cx="74" cy="146" r="5" fill="#f97316" stroke="none"/><circle cx="126" cy="150" r="6" fill="#f97316" stroke="none"/>
    <path d="M66 36 Q100 18 134 36 L138 100 Q100 110 62 100 Z" fill="#e7e5e4"/>
    <path d="M70 34 Q60 4 76 0 Q78 18 86 28 M100 26 Q98 -6 112 -6 Q110 12 112 24 M128 34 Q144 6 156 14 Q140 22 134 36" fill="none" stroke="#fb7185" stroke-width="9"/>
    <ellipse cx="86" cy="64" rx="8" ry="5" fill="#22d3ee"/><ellipse cx="114" cy="64" rx="8" ry="5" fill="#22d3ee"/>
    <path d="M84 88 H116" stroke-width="6"/>`,
};

/** Tamanho do recorte de cada um (na unidade da ilha) e a altura de voo de quem voa. */
export const TAMANHO_DA_TRIPULACAO = {
  marujo: 0.9, mosqueteira: 0.95, cozinheiro: 1.0, gaivota: 0.85,
  bucaneiro: 1.05, ancoreiro: 1.2, macaco: 0.85, caranguejoCouracado: 1.2, sereia: 1.05,
  canhoneira: 1.05, gancho: 1.1, polvoDeGuerra: 1.5, navegadora: 1.0, fantasma: 1.15,
  tartaruga: 1.7, filhoteKraken: 1.8, albatroz: 1.4, bruxa: 1.1,
  capita: 1.4, golemDeCoral: 2.0,
};
export const VOO_DA_TRIPULACAO = { gaivota: 1.2, fantasma: 0.9, albatroz: 1.4 };
