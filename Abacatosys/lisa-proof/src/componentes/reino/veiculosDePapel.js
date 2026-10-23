// Os veículos da garagem (23/10/2026), desenhados como as tropas e os monstros: recortes de papel,
// um SVG por veículo, contorno escuro grosso. Só para a tela (cartões da garagem e das expedições);
// no 3D da batalha cada um tem o seu modelo (Mundo3D, função veiculoDaBatalha).

const DESENHOS = {
  barco: () => `
    <path d="M30 120 L170 120 L150 160 L50 160 Z" fill="#a0703f"/>
    <path d="M42 120 L158 120" stroke-width="8" stroke="#6e4a2a"/>
    <path d="M100 120 V30" stroke-width="7"/>
    <path d="M104 36 L160 104 L104 104 Z" fill="#f8fafc"/>
    <path d="M96 46 L52 104 L96 104 Z" fill="#2f6fd6"/>
    <ellipse cx="100" cy="24" rx="46" ry="20" fill="#2f6fd6"/><ellipse cx="86" cy="18" rx="12" ry="6" fill="#fff" stroke="none" opacity="0.6"/>
    <path d="M60 140 h80" stroke="#6e4a2a"/>`,
  submarino: () => `
    <ellipse cx="96" cy="118" rx="74" ry="34" fill="#facc15"/>
    <rect x="80" y="62" width="40" height="34" rx="10" fill="#eab308"/>
    <path d="M100 62 V36 h18" fill="none" stroke-width="7"/>
    <circle cx="70" cy="118" r="11" fill="#7dd3fc"/><circle cx="104" cy="118" r="11" fill="#7dd3fc"/><circle cx="138" cy="118" r="11" fill="#7dd3fc"/>
    <path d="M168 104 l22 -12 v52 l-22 -12 z" fill="#a16207"/>
    <circle cx="40" cy="150" r="6" fill="#bae6fd"/><circle cx="28" cy="132" r="4" fill="#bae6fd"/><circle cx="50" cy="168" r="3" fill="#bae6fd"/>`,
  dirigivel: () => `
    <ellipse cx="100" cy="72" rx="82" ry="40" fill="#f97316"/>
    <path d="M30 60 Q100 44 170 60 M26 82 Q100 98 174 82" fill="none" stroke="#c2410c" stroke-width="4"/>
    <path d="M176 72 l20 -18 v36 z" fill="#ea580c"/>
    <path d="M70 108 L78 132 M130 108 L122 132" stroke-width="5"/>
    <rect x="66" y="130" width="68" height="28" rx="8" fill="#a0703f"/>
    <rect x="78" y="136" width="14" height="12" rx="3" fill="#7dd3fc"/><rect x="108" y="136" width="14" height="12" rx="3" fill="#7dd3fc"/>
    <path d="M26 176 L58 148 L84 176 Z M110 176 L146 140 L184 176 Z" fill="#e2e8f0"/>
    <path d="M136 152 L146 140 L156 152 Z" fill="#fff" stroke="none"/>`,
  tanque: () => `
    <rect x="22" y="134" width="156" height="34" rx="17" fill="#374151"/>
    <circle cx="44" cy="151" r="10" fill="#9ca3af"/><circle cx="78" cy="151" r="10" fill="#9ca3af"/><circle cx="112" cy="151" r="10" fill="#9ca3af"/><circle cx="146" cy="151" r="10" fill="#9ca3af"/>
    <path d="M34 134 L52 102 H148 L166 134 Z" fill="#b91c1c"/>
    <rect x="72" y="72" width="60" height="34" rx="12" fill="#dc2626"/>
    <path d="M128 86 H190" stroke-width="12"/><path d="M128 86 H190" stroke="#4b5563" stroke-width="6"/>
    <path d="M60 118 h80" stroke="#7f1d1d" stroke-width="5"/>
    <path d="M30 186 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0" fill="none" stroke="#f97316" stroke-width="6"/>
    <path d="M110 186 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0" fill="none" stroke="#fde047" stroke-width="6"/>`,
  nave: () => `
    <path d="M100 18 Q140 60 140 128 L60 128 Q60 60 100 18 Z" fill="#e5e7eb"/>
    <circle cx="100" cy="74" r="16" fill="#38bdf8"/><circle cx="95" cy="69" r="5" fill="#fff" stroke="none" opacity="0.8"/>
    <path d="M60 104 L30 146 L62 136 Z M140 104 L170 146 L138 136 Z" fill="#7c3aed"/>
    <rect x="76" y="128" width="48" height="12" rx="4" fill="#6b7280"/>
    <path d="M82 140 Q100 196 118 140 Z" fill="#f97316"/><path d="M90 140 Q100 176 110 140 Z" fill="#fde047" stroke="none"/>
    <circle cx="36" cy="40" r="3" fill="#fde047" stroke="none"/><circle cx="168" cy="30" r="4" fill="#fde047" stroke="none"/><circle cx="160" cy="80" r="2.5" fill="#fde047" stroke="none"/>`,
};

export function svgDoVeiculo(id) {
  const desenho = DESENHOS[id] || DESENHOS.barco;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 212 212" width="424" height="424"><g stroke="#1f2937" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${desenho()}</g></svg>`;
}
export const urlDoVeiculo = (id) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoVeiculo(id))}`;
