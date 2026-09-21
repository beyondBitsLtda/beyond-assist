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

const TINTA_CLARA = "#FFFFFF";
const TINTA_ESCURA = "#1F2937";

/** A luminância relativa de uma cor, como a especificação de acessibilidade a define.
 *  A correção de gama existe porque o valor gravado no arquivo não é proporcional ao brilho
 *  que o olho enxerga — 50% de verde não parece metade do brilho. */
function luminancia(hex) {
  const canal = (inicio) => {
    const v = parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

function contraste(a, b) {
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Que cor de texto se lê em cima desta cor.
 *
 * A etiqueta aberta mostra o NOME dentro da própria cor, e branco não serve para todas: sobre
 * o amarelo `#EAB308` o texto branco tem contraste 1,9 — some.
 *
 * A regra NÃO é um corte de luminância. Eu tinha escrito assim e a medição desmentiu: com
 * corte em 0,55 o amarelo (luminância 0,498) continuava recebendo branco, que é exatamente o
 * caso que a função existia para resolver.
 *
 * O certo é comparar os DOIS contrastes e usar o maior — que é o que a especificação pede, e
 * o que continua valendo na próxima cor que alguém acrescentar à paleta, sem ninguém precisar
 * reajustar número nenhum.
 *
 * Nem toda cor da paleta chega a 4,5:1 em qualquer das duas tintas (o roxo para em 3,96). Por
 * isso o nome também vai no `title` do elemento, e a cor nunca é a única portadora da
 * informação.
 */
export function tintaSobre(cor) {
  const hex = String(cor || "").replace("#", "");
  if (hex.length !== 6) return TINTA_CLARA;

  const l = luminancia(hex);
  const comClara = contraste(l, luminancia("FFFFFF"));
  const comEscura = contraste(l, luminancia("1F2937"));
  return comEscura > comClara ? TINTA_ESCURA : TINTA_CLARA;
}
