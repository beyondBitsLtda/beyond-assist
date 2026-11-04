// Os ícones do tesouro da Mina de Ouro (23/10/2026: "troque o símbolo da pepita para algo que
// lembre mais ouro"): uma barra de ouro com brilho e um diamante lapidado, em SVG — o emoji 🟡 não
// parecia ouro, e não há emoji de barra de ouro que apareça igual em todo aparelho.

export function Ouro({ tamanho = 18, titulo }) {
  return (
    <svg className="rn-icone-ouro" width={tamanho} height={tamanho} viewBox="0 0 24 24" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <path d="M4.5 9.5 L19.5 9.5 L22.5 18.5 L1.5 18.5 Z" fill="#E8A317" stroke="#8A5A00" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M4.5 9.5 L19.5 9.5 L18 12 L6 12 Z" fill="#FFE07A" stroke="#8A5A00" strokeWidth="1" strokeLinejoin="round" />
      <path d="M6.5 15.5 h7" stroke="#FFF3BF" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M19 3.5 l.7 1.6 1.6.7 -1.6.7 -.7 1.6 -.7 -1.6 -1.6 -.7 1.6 -.7 z" fill="#FFD43B" />
    </svg>
  );
}

export function Diamante({ tamanho = 18, titulo }) {
  return (
    <svg className="rn-icone-diamante" width={tamanho} height={tamanho} viewBox="0 0 24 24" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <path d="M7 3.5 H17 L21.5 9 L12 21 L2.5 9 Z" fill="#7DD3FC" stroke="#0E5A8A" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.5 9 H21.5 M7 3.5 L9.5 9 L12 21 L14.5 9 L17 3.5 M9.5 9 L12 3.5 L14.5 9" fill="none" stroke="#0E5A8A" strokeWidth="1" strokeLinejoin="round" />
      <path d="M8.2 5 L9.6 8.2" stroke="#E0F7FF" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
