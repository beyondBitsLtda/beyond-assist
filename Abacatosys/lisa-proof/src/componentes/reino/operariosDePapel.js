// Os operários da Mina de Ouro (23/10/2026: "quero poder ver os operários cavando na mina"), em
// papel como as tropas: capacete com lanterna, macacão e picareta. Dois quadros — a picareta no
// alto (0) e a picareta batendo na pedra (1) — que o Mundo3D alterna para animar. Desenhado
// virado para a direita (a pedra fica à direita dos pés).

const corpo = `
  <rect x="78" y="150" width="16" height="30" rx="6" fill="#1e3a8a"/><rect x="104" y="150" width="16" height="30" rx="6" fill="#1e3a8a"/>
  <ellipse cx="84" cy="184" rx="14" ry="7" fill="#5b3a1e"/><ellipse cx="114" cy="184" rx="14" ry="7" fill="#5b3a1e"/>
  <path d="M70 104 Q100 92 128 104 L132 156 Q100 164 66 156 Z" fill="#2563eb"/>
  <path d="M84 104 V128 M114 104 V128" stroke="#1e40af" stroke-width="5"/><rect x="88" y="120" width="22" height="16" rx="3" fill="#1d4ed8"/>
  <circle cx="99" cy="76" r="25" fill="#f2c48d"/>
  <circle cx="107" cy="76" r="3.6" fill="#1f2937" stroke="none"/><circle cx="91" cy="76" r="3.6" fill="#1f2937" stroke="none"/>
  <path d="M93 88 q7 5 14 0" fill="none" stroke-width="3.5"/>
  <ellipse cx="86" cy="84" rx="5" ry="3" fill="#fb7185" stroke="none" opacity="0.6"/><ellipse cx="114" cy="84" rx="5" ry="3" fill="#fb7185" stroke="none" opacity="0.6"/>
  <path d="M72 66 Q74 40 100 40 Q126 40 128 66 Z" fill="#facc15"/><rect x="68" y="62" width="64" height="8" rx="4" fill="#eab308"/>
  <circle cx="100" cy="52" r="7" fill="#fef9c3"/><path d="M106 49 l14 -6 M107 53 l15 0" stroke="#fde68a" stroke-width="3"/>
  <path d="M150 180 Q150 158 168 156 Q188 156 190 178 Z" fill="#78716c"/><path d="M160 166 l6 -4 M174 164 l5 4" stroke="#57534e" stroke-width="3"/>`;

const QUADROS = [
  // 0 — a picareta lá no alto, atrás da cabeça
  `${corpo}
  <path d="M120 112 L144 62" stroke-width="12"/><path d="M120 112 L144 62" stroke="#f2c48d" stroke-width="6"/>
  <path d="M142 72 L120 20" stroke-width="10"/><path d="M142 72 L120 20" stroke="#a16207" stroke-width="5"/>
  <path d="M100 30 Q118 6 146 14 Q126 18 120 24 Q112 22 100 30 Z" fill="#94a3b8"/>`,
  // 1 — a picareta batendo na pedra, com faíscas
  `${corpo}
  <path d="M122 112 L150 128" stroke-width="12"/><path d="M122 112 L150 128" stroke="#f2c48d" stroke-width="6"/>
  <path d="M146 126 L176 98" stroke-width="10"/><path d="M146 126 L176 98" stroke="#a16207" stroke-width="5"/>
  <path d="M164 92 Q188 96 182 128 Q178 110 172 104 Q168 98 164 92 Z" fill="#94a3b8"/>
  <path d="M186 140 l6 -10 M192 150 l11 -3 M178 136 l-2 -12" stroke="#fde047" stroke-width="5"/>
  <path d="M186 140 l6 -10 M192 150 l11 -3 M178 136 l-2 -12" stroke="#fff7d6" stroke-width="2"/>`,
];

export function svgDoOperario(quadro = 0) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 212 212" width="424" height="424"><g stroke="#1f2937" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${QUADROS[quadro] || QUADROS[0]}</g></svg>`;
}
