// A paleta das etiquetas e das capas.
//
// Lista fechada, e não um seletor de cor livre: com paleta aberta cada pessoa inventa o
// próprio verde, e dois meses depois o quadro tem onze verdes que ninguém distingue no meio de
// trinta cards. Cor de etiqueta é código visual, e código visual só funciona enquanto for
// pequeno o bastante para caber na cabeça.
//
// Mora no domínio porque o servidor precisa dela para RECUSAR uma cor inventada e a tela
// precisa dela para DESENHAR as opções. Duas listas dessas divergem no primeiro dia em que
// alguém acrescenta uma cor num lado só.

export const CORES = [
  { cor: "#22C55E", nome: "verde" },
  { cor: "#10B981", nome: "esmeralda" },
  { cor: "#2362D3", nome: "azul" },
  { cor: "#6366F1", nome: "índigo" },
  { cor: "#A855F7", nome: "roxo" },
  { cor: "#EC4899", nome: "rosa" },
  { cor: "#EF4444", nome: "vermelho" },
  { cor: "#F97316", nome: "laranja" },
  { cor: "#EAB308", nome: "amarelo" },
  { cor: "#6B7280", nome: "cinza" },
];

export const VALORES_DE_COR = CORES.map((c) => c.cor);

export function corValida(cor) {
  return VALORES_DE_COR.includes(cor);
}
