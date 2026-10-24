// Ícones em SVG inline: três desenhos não justificam uma biblioteca, e herdar `currentColor`
// é o que deixa o item ativo da navegação ficar verde só com CSS.

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export const IconeHoje = () => (
  <svg {...base}><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 3 3 3.5-.5-3 0-6 0-9z" /></svg>
);

export const IconeTrilhas = () => (
  <svg {...base}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></svg>
);

export const IconeAgenda = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2" /></svg>
);

export const IconePratica = () => (
  <svg {...base}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
);

export const IconeProgresso = () => (
  <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);

// Raio-X: a silhueta de uma pessoa dentro do quadro de uma chapa
export const IconeRaioX = () => (
  <svg {...base}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="12" cy="9" r="2.5" /><path d="M7.5 17.5c.8-2.4 2.5-3.5 4.5-3.5s3.7 1.1 4.5 3.5" /></svg>
);

// Ranking: o pódio
export const IconeRanking = () => (
  <svg {...base}><path d="M9 21V10h6v11M3 21v-6h6M15 21v-8h6v8M2 21h20M12 3l1 2 2 .3-1.5 1.4.4 2.1L12 7.8l-1.9 1 .4-2.1L9 5.3 11 5z" /></svg>
);

// Bolsa: as velas de um gráfico de cotações
export const IconeBolsa = () => (
  <svg {...base}><path d="M3 3v18h18M7 14v3M7 9v2M12 7v9M12 4v2M17 11v4M17 6v3" /><rect x="5.5" y="11" width="3" height="3" rx=".5" /><rect x="10.5" y="6" width="3" height="5" rx=".5" /><rect x="15.5" y="9" width="3" height="3" rx=".5" /></svg>
);

// Reino: o castelo
export const IconeReino = () => (
  <svg {...base}><path d="M4 21V9l2-1V5h2v2l2-1V4h4v2l2 1V5h2v3l2 1v12zM10 21v-4a2 2 0 0 1 4 0v4M2 21h20" /></svg>
);

// Mais: três pontos
// Domínio (24/10/2026): a torre a escalar, com ameias e a porta embaixo
export const IconeDominio = () => (
  <svg {...base}><path d="M6 21V10h12v11M6 10V5h2.5v2h2V5h3v2h2V5H18v5M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21M4 21h16" /></svg>
);

export const IconeMais = () => (
  <svg {...base}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
);

export const IconeCerto = () => (
  <svg {...base} strokeWidth={3.5}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
);

export const Marca = ({ className = "pf-marca__icone" }) => (
  <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#17201A" />
    <path d="M18 33.5l9 9 19-21" fill="none" stroke="#22C55E" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
