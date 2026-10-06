// Ícones em SVG inline: três desenhos não justificam uma biblioteca, e herdar `currentColor`
// é o que deixa o item ativo da navegação ficar verde só com CSS.

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export const IconeHoje = () => (
  <svg {...base}><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 3 3 3.5-.5-3 0-6 0-9z" /></svg>
);

export const IconeTrilhas = () => (
  <svg {...base}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></svg>
);

export const IconePratica = () => (
  <svg {...base}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
);

export const IconeProgresso = () => (
  <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
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
