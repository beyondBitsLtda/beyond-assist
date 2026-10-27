// Quem trabalha na Biblioteca Colaborativa (26/10/2026), no papel recortado do Reino: corpo inteiro,
// cores chapadas e contorno grosso (o mundo 3D põe a borda branca de adesivo — papel.js). Cada um
// cuida de um tipo de material (src/dominio/acervo.js):
//   Dona Celeste, a Bibliotecária    — a Torre dos Livros (com a pilha de livros e o coque com lápis)
//   Doutora Íris, a Cientista        — o Observatório dos Artigos (jaleco, óculos de proteção, frasco)
//   Mestre Tobias, o Professor       — o Auditório das Videoaulas (uma tartaruga de barba, com bengala)
//   Pipoca, o Projecionista          — o Cinema dos Vídeos (um guaxinim de quepe, com o balde de pipoca)

const C = "#1f2937";

const DESENHOS = {
  celeste: () => `
    <ellipse cx="86" cy="192" rx="12" ry="6" fill="#3f2a1e"/><ellipse cx="114" cy="192" rx="12" ry="6" fill="#3f2a1e"/>
    <path d="M66 132L134 132L146 188L54 188Z" fill="#64748b"/>
    <path d="M80 150L76 186M100 150L100 186M120 150L124 186" fill="none" stroke="#475569" stroke-width="3"/>
    <path d="M68 94Q100 84 132 94L138 140L62 140Z" fill="#9f1239"/>
    <circle cx="100" cy="104" r="2.6" fill="#fde68a" stroke-width="1.5"/><circle cx="100" cy="128" r="2.6" fill="#fde68a" stroke-width="1.5"/>
    <path d="M84 92Q100 104 116 92L112 88Q100 96 88 88Z" fill="#fff" stroke-width="3"/>
    <rect x="70" y="128" width="60" height="12" rx="2" fill="#2563eb"/>
    <rect x="74" y="116" width="54" height="12" rx="2" fill="#f59e0b"/>
    <rect x="68" y="104" width="58" height="12" rx="2" fill="#16a34a"/>
    <path d="M80 104L80 116M86 116L86 128M84 128L84 140" fill="none" stroke="#fef3c7" stroke-width="2.5"/>
    <circle cx="66" cy="124" r="8" fill="#f2c4a0"/><circle cx="134" cy="124" r="8" fill="#f2c4a0"/>
    <circle cx="100" cy="34" r="12" fill="#d1d5db"/>
    <path d="M88 26L114 40" fill="none" stroke="#facc15" stroke-width="4"/>
    <circle cx="100" cy="62" r="26" fill="#f2c4a0"/>
    <path d="M74 62Q72 36 100 36Q128 36 126 62Q118 48 100 48Q82 48 74 62Z" fill="#d1d5db"/>
    <circle cx="90" cy="64" r="7.5" fill="#e0f2fe" stroke-width="3"/><circle cx="110" cy="64" r="7.5" fill="#e0f2fe" stroke-width="3"/>
    <path d="M97.5 64L102.5 64" fill="none" stroke-width="2.5"/>
    <circle cx="90" cy="65" r="2.2" fill="${C}" stroke="none"/><circle cx="110" cy="65" r="2.2" fill="${C}" stroke="none"/>
    <path d="M82.5 66Q76 84 86 90M117.5 66Q124 84 114 90" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-dasharray="2 3"/>
    <ellipse cx="84" cy="74" rx="4.5" ry="2.8" fill="#fca5a5" fill-opacity=".6" stroke="none"/><ellipse cx="116" cy="74" rx="4.5" ry="2.8" fill="#fca5a5" fill-opacity=".6" stroke="none"/>
    <path d="M92 77Q100 83 108 77" fill="none" stroke-width="3"/>`,

  iris: () => `
    <ellipse cx="88" cy="192" rx="11" ry="6" fill="${C}"/><ellipse cx="112" cy="192" rx="11" ry="6" fill="${C}"/>
    <rect x="84" y="150" width="12" height="40" rx="3" fill="#1e3a8a"/><rect x="104" y="150" width="12" height="40" rx="3" fill="#1e3a8a"/>
    <path d="M68 94Q100 84 132 94L142 168L58 168Z" fill="#f8fafc"/>
    <path d="M88 92L100 116L112 92Z" fill="#7c3aed"/>
    <path d="M100 116L100 168M84 94L94 130M116 94L106 130" fill="none" stroke-width="3"/>
    <rect x="112" y="134" width="18" height="16" rx="2" fill="#f8fafc" stroke-width="3"/>
    <path d="M116 134L116 126M122 134L122 128" fill="none" stroke="#2563eb" stroke-width="3"/>
    <path d="M132 100L150 82" fill="none" stroke="#f8fafc" stroke-width="13"/>
    <path d="M132 100L150 82" fill="none" stroke-width="0"/>
    <circle cx="152" cy="80" r="7" fill="#c68642"/>
    <path d="M146 46L160 46L158 58L170 80Q172 88 165 88L141 88Q134 88 137 80L148 58Z" fill="#d1fae5"/>
    <path d="M140 74L166 74L170 80Q172 88 165 88L141 88Q134 88 137 80Z" fill="#34d399" stroke-width="3"/>
    <circle cx="150" cy="66" r="2.5" fill="#a7f3d0" stroke-width="1.5"/><circle cx="156" cy="56" r="2" fill="#a7f3d0" stroke-width="1.5"/>
    <rect x="46" y="110" width="28" height="36" rx="3" fill="#b45309"/>
    <rect x="50" y="116" width="20" height="26" fill="#fff" stroke-width="2.5"/>
    <path d="M53 122L67 122M53 128L67 128M53 134L62 134" fill="none" stroke="#94a3b8" stroke-width="2"/>
    <circle cx="72" cy="128" r="7" fill="#c68642"/>
    <path d="M124 46Q150 50 146 84Q140 66 126 58Z" fill="#7c3aed"/>
    <circle cx="100" cy="60" r="25" fill="#c68642"/>
    <path d="M75 60Q72 32 100 32Q128 32 125 60Q114 44 100 44Q86 44 75 60Z" fill="#7c3aed"/>
    <path d="M74 46L126 46" fill="none" stroke-width="5"/>
    <circle cx="88" cy="44" r="8" fill="#67e8f9"/><circle cx="112" cy="44" r="8" fill="#67e8f9"/>
    <circle cx="91" cy="64" r="3" fill="${C}" stroke="none"/><circle cx="109" cy="64" r="3" fill="${C}" stroke="none"/>
    <circle cx="92" cy="63" r="1" fill="#fff" stroke="none"/><circle cx="110" cy="63" r="1" fill="#fff" stroke="none"/>
    <path d="M90 74Q100 82 110 74Z" fill="#7f1d1d" stroke-width="3"/>`,

  tobias: () => `
    <ellipse cx="80" cy="190" rx="14" ry="8" fill="#65a30d"/><ellipse cx="120" cy="190" rx="14" ry="8" fill="#65a30d"/>
    <ellipse cx="100" cy="130" rx="48" ry="54" fill="#92400e"/>
    <path d="M72 98L86 92L100 100L114 92L128 98M64 130L80 120L100 128L120 120L136 130M70 162L86 154L100 162L114 154L130 162" fill="none" stroke="#5b2a0a" stroke-width="3"/>
    <ellipse cx="100" cy="134" rx="30" ry="42" fill="#fde68a"/>
    <path d="M74 118L126 118M72 136L128 136M76 154L124 154" fill="none" stroke="#d97706" stroke-width="3"/>
    <rect x="44" y="112" width="26" height="32" rx="3" fill="#1d4ed8" transform="rotate(-8 57 128)"/>
    <path d="M50 116L52 140" fill="none" stroke="#fde68a" stroke-width="3" transform="rotate(-8 57 128)"/>
    <ellipse cx="62" cy="136" rx="9" ry="7" fill="#84cc16"/>
    <path d="M150 112L152 190" fill="none" stroke="#78350f" stroke-width="6"/>
    <path d="M152 112Q152 98 142 100" fill="none" stroke="#78350f" stroke-width="6"/>
    <ellipse cx="146" cy="130" rx="9" ry="7" fill="#84cc16"/>
    <rect x="92" y="78" width="16" height="16" fill="#84cc16"/>
    <circle cx="100" cy="60" r="24" fill="#84cc16"/>
    <path d="M84 72Q100 112 116 72Q100 80 84 72Z" fill="#f8fafc"/>
    <path d="M82 50Q90 44 97 50M103 50Q110 44 118 50" fill="#f8fafc" stroke-width="3"/>
    <circle cx="90" cy="58" r="7.5" fill="#e0f2fe" stroke-width="3"/><circle cx="110" cy="58" r="7.5" fill="#e0f2fe" stroke-width="3"/>
    <path d="M97.5 58L102.5 58" fill="none" stroke-width="2.5"/>
    <circle cx="90" cy="59" r="2.2" fill="${C}" stroke="none"/><circle cx="110" cy="59" r="2.2" fill="${C}" stroke="none"/>
    <path d="M94 72Q100 76 106 72" fill="none" stroke-width="2.5"/>
    <path d="M86 36L100 28L114 36L100 42Z" fill="#7c2d12" stroke-width="3"/>`,

  pipoca: () => `
    <path d="M128 168Q176 160 170 112Q166 92 150 96Q160 116 150 140Q140 156 122 156Z" fill="#9ca3af"/>
    <path d="M160 104Q166 108 166 114M164 124Q168 128 166 134M158 142Q160 148 156 152" fill="none" stroke="${C}" stroke-width="7"/>
    <ellipse cx="88" cy="192" rx="11" ry="6" fill="${C}"/><ellipse cx="112" cy="192" rx="11" ry="6" fill="${C}"/>
    <ellipse cx="100" cy="146" rx="32" ry="42" fill="#9ca3af"/>
    <ellipse cx="100" cy="152" rx="18" ry="28" fill="#e5e7eb"/>
    <path d="M70 120Q72 104 86 102L92 174L74 170Q66 150 70 120ZM130 120Q128 104 114 102L108 174L126 170Q134 150 130 120Z" fill="#dc2626"/>
    <circle cx="90" cy="130" r="2.5" fill="#fde68a" stroke-width="1.5"/><circle cx="90" cy="148" r="2.5" fill="#fde68a" stroke-width="1.5"/>
    <path d="M90 104L100 110L90 116ZM110 104L100 110L110 116Z" fill="${C}"/>
    <path d="M48 126L76 126L72 156L52 156Z" fill="#fff"/>
    <path d="M55 126L57 156M62 126L62 156M69 126L67 156" fill="none" stroke="#dc2626" stroke-width="4"/>
    <circle cx="54" cy="122" r="5" fill="#fef3c7" stroke-width="2"/><circle cx="62" cy="119" r="5.5" fill="#fef9c3" stroke-width="2"/><circle cx="70" cy="122" r="5" fill="#fef3c7" stroke-width="2"/>
    <circle cx="78" cy="142" r="7" fill="#6b7280"/>
    <circle cx="138" cy="128" r="16" fill="#374151"/>
    <circle cx="138" cy="128" r="4" fill="#9ca3af" stroke-width="2"/>
    <circle cx="138" cy="118" r="3.5" fill="#9ca3af" stroke-width="1.5"/><circle cx="147" cy="133" r="3.5" fill="#9ca3af" stroke-width="1.5"/><circle cx="129" cy="133" r="3.5" fill="#9ca3af" stroke-width="1.5"/>
    <circle cx="124" cy="138" r="7" fill="#6b7280"/>
    <path d="M76 52L70 26L92 40Z" fill="#c3c8d0"/><path d="M124 52L130 26L108 40Z" fill="#c3c8d0"/>
    <path d="M77 46L74 34L85 41ZM123 46L126 34L115 41Z" fill="${C}" stroke="none"/>
    <circle cx="100" cy="64" r="28" fill="#c3c8d0"/>
    <path d="M77 63Q100 54 123 63Q121 72 112 71Q100 66 88 71Q79 72 77 63Z" fill="#374151"/>
    <circle cx="89" cy="64" r="5" fill="#fff" stroke="none"/><circle cx="111" cy="64" r="5" fill="#fff" stroke="none"/>
    <circle cx="90" cy="65" r="2.6" fill="${C}" stroke="none"/><circle cx="112" cy="65" r="2.6" fill="${C}" stroke="none"/>
    <ellipse cx="100" cy="80" rx="14" ry="10" fill="#f3f4f6"/>
    <ellipse cx="100" cy="76" rx="5" ry="3.5" fill="${C}"/>
    <path d="M94 84Q100 89 106 84" fill="none" stroke-width="2.5"/>
    <path d="M82 40L118 40L116 30Q100 24 84 30Z" fill="#dc2626"/>
    <path d="M80 40L120 40" fill="none" stroke="#fbbf24" stroke-width="5"/>`,
};

export const IDS_DOS_FUNCIONARIOS = Object.keys(DESENHOS);

/** O SVG de um funcionário (corpo inteiro, fundo transparente). */
export function svgDoFuncionario(id) {
  const d = DESENHOS[id];
  if (!d) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400"><g stroke="${C}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${d()}</g></svg>`;
}

const cache = new Map();
/** O funcionário como URL de imagem. */
export function urlDoFuncionario(id) {
  if (!cache.has(id)) cache.set(id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoFuncionario(id))}`);
  return cache.get(id);
}
