// O Markdown da prévia do caderno: transforma o texto em blocos e pedaços de linha, e quem desenha é
// src/componentes/caderno/Previa.js, montando os elementos à mão — nada do texto vira HTML de
// verdade na página (mesma ideia de src/componentes/Explicacao.js).
//
// Cobre o que se usa para anotar: títulos, parágrafos, listas (com tarefas "- [ ]" e um nível de
// recuo), citação, código em bloco com a linguagem, linha divisória, tabela, negrito, itálico,
// riscado, código em linha e links. Link só sai clicável se for http(s), e-mail ou um caminho do
// próprio Proof ("/biblioteca/…") — `javascript:` e companhia viram texto.
//
// Puro: sem React, sem DOM.

const CERCA = /^\s*(```+|~~~+)\s*([\w#+.-]*)\s*$/;
const TITULO = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const DIVISORIA = /^\s*([-*_])(\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const CITACAO = /^\s*>\s?(.*)$/;
const SEPARADOR_DE_TABELA = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** Um link que pode virar <a>: http(s), mailto, ou caminho interno (não "//", que é outro site). */
export function enderecoSeguro(href) {
  const h = String(href || "").trim();
  if (/^https?:\/\/[^\s]+$/i.test(h)) return h;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return h;
  if (/^\/(?!\/)[^\s]*$/.test(h)) return h;
  if (/^#[\w-]+$/.test(h)) return h;
  return null;
}

const celulas = (linha) => linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** O texto em blocos: [{ tipo: "titulo"|"paragrafo"|"lista"|"citacao"|"codigo"|"divisoria"|"tabela", … }]. */
export function blocosDoMarkdown(texto) {
  const linhas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim()) { i++; continue; }

    const cerca = CERCA.exec(linha);
    if (cerca) {
      const fecho = cerca[1][0];
      const corpo = [];
      i++;
      while (i < linhas.length && !new RegExp(`^\\s*\\${fecho}{3,}\\s*$`).test(linhas[i])) corpo.push(linhas[i++]);
      i++; // a cerca que fecha (ou o fim do texto)
      blocos.push({ tipo: "codigo", linguagem: cerca[2] || "", texto: corpo.join("\n") });
      continue;
    }

    const titulo = TITULO.exec(linha);
    if (titulo) {
      blocos.push({ tipo: "titulo", nivel: titulo[1].length, linha: emLinha(titulo[2]) });
      i++;
      continue;
    }

    if (DIVISORIA.test(linha)) { blocos.push({ tipo: "divisoria" }); i++; continue; }

    if (linha.includes("|") && i + 1 < linhas.length && SEPARADOR_DE_TABELA.test(linhas[i + 1])) {
      const cabecalho = celulas(linha);
      const corpo = [];
      i += 2;
      while (i < linhas.length && linhas[i].includes("|") && linhas[i].trim()) corpo.push(celulas(linhas[i++]));
      blocos.push({
        tipo: "tabela",
        cabecalho: cabecalho.map(emLinha),
        linhas: corpo.map((l) => cabecalho.map((_, c) => emLinha(l[c] || ""))),
      });
      continue;
    }

    if (CITACAO.test(linha)) {
      const corpo = [];
      while (i < linhas.length && CITACAO.test(linhas[i])) corpo.push(CITACAO.exec(linhas[i++])[1]);
      blocos.push({ tipo: "citacao", linhas: corpo.map(emLinha) });
      continue;
    }

    if (ITEM.test(linha)) {
      const itens = [];
      const ordenada = /\d/.test(ITEM.exec(linha)[2]);
      while (i < linhas.length) {
        const m = ITEM.exec(linhas[i]);
        if (!m) {
          // linha recuada logo abaixo de um item continua o item
          if (itens.length && /^\s{2,}\S/.test(linhas[i])) { itens.at(-1).textoBruto += ` ${linhas[i].trim()}`; i++; continue; }
          break;
        }
        const recuo = m[1].replace(/\t/g, "  ").length >= 2 ? 1 : 0;
        let corpo = m[3];
        let tarefa = null;
        const t = /^\[( |x|X)\]\s+(.*)$/.exec(corpo);
        if (t) { tarefa = t[1].toLowerCase() === "x"; corpo = t[2]; }
        itens.push({ recuo, tarefa, textoBruto: corpo });
        i++;
      }
      blocos.push({ tipo: "lista", ordenada, itens: itens.map(({ textoBruto, ...x }) => ({ ...x, linha: emLinha(textoBruto) })) });
      continue;
    }

    const corpo = [];
    while (i < linhas.length && linhas[i].trim() && !CERCA.test(linhas[i]) && !TITULO.test(linhas[i]) && !ITEM.test(linhas[i]) && !CITACAO.test(linhas[i]) && !DIVISORIA.test(linhas[i])) {
      corpo.push(linhas[i++]);
    }
    if (!corpo.length) { corpo.push(linhas[i++]); }
    blocos.push({ tipo: "paragrafo", linhas: corpo.map(emLinha) });
  }
  return blocos;
}

// os pedaços de uma linha, na ordem de prioridade: código, link, negrito, riscado, itálico, endereço solto
const PEDACOS = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__|~~(?=\S)([\s\S]*?\S)~~|\*(?=\S)([^*]*?\S)\*|(?<![\w])_(?=\S)([^_]*?\S)_(?![\w])|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;

/** Uma linha em pedaços: [{ t: "texto"|"codigo"|"negrito"|"italico"|"riscado"|"link", … }]. */
export function emLinha(texto) {
  const s = String(texto ?? "");
  const saida = [];
  let ultimo = 0;
  for (const m of s.matchAll(PEDACOS)) {
    if (m.index > ultimo) saida.push({ t: "texto", v: s.slice(ultimo, m.index) });
    if (m[1]) saida.push({ t: "codigo", v: m[2] });
    else if (m[3] !== undefined) {
      const href = enderecoSeguro(m[4]);
      saida.push(href ? { t: "link", href, filhos: emLinha(m[3]) } : { t: "texto", v: m[0] });
    } else if (m[5] !== undefined || m[6] !== undefined) saida.push({ t: "negrito", filhos: emLinha(m[5] ?? m[6]) });
    else if (m[7] !== undefined) saida.push({ t: "riscado", filhos: emLinha(m[7]) });
    else if (m[8] !== undefined || m[9] !== undefined) saida.push({ t: "italico", filhos: emLinha(m[8] ?? m[9]) });
    else if (m[10]) saida.push({ t: "link", href: m[10], filhos: [{ t: "texto", v: m[10] }] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) saida.push({ t: "texto", v: s.slice(ultimo) });
  return saida;
}

/** Os títulos do texto, para o índice ao lado da prévia: [{ nivel, texto, linha }]. */
export function titulosDoMarkdown(texto) {
  const saida = [];
  let dentroDeCodigo = false;
  String(texto || "").split("\n").forEach((linha, n) => {
    if (CERCA.test(linha)) { dentroDeCodigo = !dentroDeCodigo; return; }
    if (dentroDeCodigo) return;
    const m = TITULO.exec(linha);
    if (m) saida.push({ nivel: m[1].length, texto: m[2].replace(/[*_`~]/g, ""), linha: n + 1 });
  });
  return saida;
}
