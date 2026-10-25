// A estante virtual da Biblioteca (pedido de 25/10/2026): "uma estante virtual com livros 3D,
// com lombadas". Aqui moram as contas: o tamanho de cada livro, a cor e o estilo da lombada, e como
// os livros se arrumam nas prateleiras. Quem desenha é src/componentes/biblioteca/Estante.js.
//
// Tudo sai do livro de forma estável (o id ou o título passam por um hash): o mesmo livro tem
// sempre a mesma altura, a mesma cor e os mesmos filetes, em qualquer visita e em qualquer aparelho.
//
// Puro: sem DOM.

/** Cores de encadernação: vinho, marinho, verde-garrafa, mostarda, ameixa, petróleo, grafite, couro… */
export const CORES_DE_LOMBADA = [
  "#7B1E22", "#1F3A5F", "#2E5E3A", "#B5852A", "#5B2A4A", "#235E63",
  "#3B3B3B", "#6B3E26", "#8C2F1B", "#2C2E6B", "#4F5D2F", "#A04A2C",
];

/** Um hash curto e estável (FNV-1a) de um texto. */
export function hashDoTexto(texto) {
  let h = 2166136261;
  for (const c of String(texto ?? "")) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * O tamanho do livro em px (antes da escala da tela): a espessura vem do número de páginas
 * (livro de 12 páginas é fininho, de 600 é grosso), a altura varia um pouco de livro para livro
 * (como numa estante de verdade) e a largura da capa acompanha a altura.
 */
export function dimensoesDoLivro({ id, titulo, paginas }, escala = 1) {
  const h = hashDoTexto(id || titulo);
  const altura = 196 + (h % 5) * 10; // 196 a 236
  const largura = Math.round(altura * 0.7);
  const espessura = Math.round(Math.min(78, Math.max(24, 16 + (Number(paginas) || 1) * 0.085)));
  return {
    altura: Math.round(altura * escala),
    largura: Math.round(largura * escala),
    espessura: Math.round(espessura * escala),
  };
}

/** A cor da lombada quando a capa não ajuda (capa branca, sem capa): sai da paleta, pelo hash. */
export function corDaLombada(chave) {
  return CORES_DE_LOMBADA[hashDoTexto(chave) % CORES_DE_LOMBADA.length];
}

/** Os filetes e a letra da lombada, também pelo hash — a estante fica variada sem ninguém escolher. */
export function estiloDaLombada(chave) {
  const h = hashDoTexto(`${chave}#estilo`);
  return {
    filetes: ["dourados", "escuros", "nenhum", "um"][h % 4],
    fonte: h % 3 === 0 ? "sans" : "serif",
  };
}

const paraRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const paraHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Luminância relativa (WCAG) de uma cor #rrggbb, de 0 a 1. */
export function luminancia(hex) {
  const rgb = paraRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre duas cores. */
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** O texto da lombada: creme ou quase preto, o que tiver mais contraste com a cor dela. */
export function corDoTextoDaLombada(fundo) {
  const claro = "#F6F0E4";
  const escuro = "#1E1A16";
  return contraste(fundo, claro) >= contraste(fundo, escuro) ? claro : escuro;
}

/** Escurece (fator > 0) ou clareia (fator < 0) uma cor. */
export function tonalizar(hex, fator) {
  const rgb = paraRgb(hex);
  if (!rgb) return hex;
  return paraHex(rgb.map((v) => (fator >= 0 ? v * (1 - fator) : v + (255 - v) * -fator)));
}

/**
 * A cor média da capa (os pixels da miniatura), ou null quando a capa é quase toda branca ou preta
 * — aí a lombada fica com a cor da paleta. `pixels` é o RGBA de um canvas pequeno.
 */
export function corMediaDosPixels(pixels) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [pr, pg, pb, pa] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    if (pa < 200) continue;
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    if (min > 225 || max < 30) continue; // papel e tinta: não dizem a cor do livro
    r += pr; g += pg; b += pb; n++;
  }
  const total = pixels.length / 4;
  if (!total || n / total < 0.18) return null;
  // a lombada costuma ser um tom mais escuro que a capa
  return tonalizar(paraHex([r / n, g / n, b / n]), 0.18);
}

/**
 * Os livros nas prateleiras: enche cada prateleira da esquerda para a direita até não caber o
 * próximo (`vao` entre um livro e outro). Devolve as prateleiras, cada uma com os itens dela, na
 * mesma ordem da lista. Livro mais grosso que a prateleira fica sozinho numa.
 */
export function arrumarPrateleiras(itens, larguraUtil, { vao = 3 } = {}) {
  const prateleiras = [];
  let atual = [];
  let usado = 0;
  for (const item of itens || []) {
    const largura = item.espessura + (atual.length ? vao : 0);
    if (atual.length && usado + largura > larguraUtil) {
      prateleiras.push(atual);
      atual = [];
      usado = 0;
    }
    usado += item.espessura + (atual.length ? vao : 0);
    atual.push(item);
  }
  if (atual.length) prateleiras.push(atual);
  return prateleiras;
}

/** O que a lombada conta do livro: lendo (o marcador aparece), lido (selo), virou curso (🎓). */
export function situacaoNaLombada({ status, progresso = 0, ultimaPagina = 1, paginas = 1, cursos = 0 }) {
  const lido = paginas > 1 && ultimaPagina >= paginas;
  return {
    preparando: status !== "pronto",
    lendo: !lido && progresso > 1,
    lido,
    curso: cursos > 0,
  };
}

/** O texto que um leitor de tela ouve ao passar pelo livro. */
export function descricaoDoLivro({ titulo, autor, paginas, progresso = 0, marcacoes = 0, cursos = 0 }) {
  return [
    titulo,
    autor ? `de ${autor}` : null,
    `${paginas} páginas`,
    progresso > 1 ? `${progresso}% lido` : "ainda não aberto",
    marcacoes ? `${marcacoes} marcaç${marcacoes === 1 ? "ão" : "ões"}` : null,
    cursos ? `${cursos} curso${cursos === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");
}
