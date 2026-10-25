// A biblioteca (pedido de 25/10/2026): "subir PDF e ler com um leitor com opção de marcação, igual
// aos melhores leitores" — e, daí, gerar cursos a partir dos livros (src/dominio/cursoDoLivro.js).
//
// O PDF mora no Storage (bucket privado proof-biblioteca). O navegador lê o arquivo com o pdf.js ao
// subir: tira o número de páginas, o sumário, a capa e o TEXTO de cada página — que vai para o
// banco, para a busca, os cursos e a Lisa não precisarem abrir o PDF de novo.
//
// Puro: sem banco, sem rede.

export const LIMITES_DA_BIBLIOTECA = {
  arquivo: 50 * 1024 * 1024, // o mesmo do bucket (e do Storage do iMac)
  total: 2 * 1024 * 1024 * 1024, // por pessoa: o disco é o da casa
  livros: 300,
  paginas: 5000,
  textoPorPagina: 30_000,
  paginasPorLote: 40, // páginas de texto por envio (cada envio fica bem abaixo de 1 MB)
  capa: 160_000, // caracteres do data URL da capa
  itensDoSumario: 800,
  retangulos: 80,
  textoDaMarcacao: 4000,
  nota: 4000,
};

/** As cores do marca-texto (o nome é o que fica no banco; a cor de verdade é do CSS). */
export const CORES_DE_MARCACAO = ["amarelo", "verde", "azul", "rosa", "laranja"];
export const TIPOS_DE_MARCACAO = ["destaque", "sublinhado", "area", "marcador"];

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const inteiro = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
export function textoCurto(valor, limite) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
}

/** "12,4 MB" */
export function formatarTamanho(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** O título do livro: o que veio do PDF, ou o nome do arquivo sem ".pdf" e sem sublinhados. */
export function tituloDoArquivo(nomeDoArquivo, tituloDoPdf) {
  const doPdf = textoCurto(tituloDoPdf, 200);
  // muito PDF vem com título lixo ("Microsoft Word - doc1.docx", "untitled")
  if (doPdf && !/^(untitled|sem t[ií]tulo|microsoft word|document\d*|doc\d*)\b/i.test(doPdf) && !/\.(docx?|pdf|tex)$/i.test(doPdf)) return doPdf;
  return textoCurto(String(nomeDoArquivo || "").replace(/\.pdf$/i, "").replace(/[_]+/g, " "), 200) || "Livro sem nome";
}

/**
 * O sumário que vem do PDF (já achatado pelo navegador: { titulo, pagina, nivel }), conferido:
 * páginas dentro do livro, nível de 1 a 6, títulos curtos, no máximo 800 itens.
 */
export function validarSumario(bruto, paginas) {
  const total = limitar(inteiro(paginas) || 1, 1, LIMITES_DA_BIBLIOTECA.paginas);
  const saida = [];
  for (const item of Array.isArray(bruto) ? bruto : []) {
    if (saida.length >= LIMITES_DA_BIBLIOTECA.itensDoSumario) break;
    const titulo = textoCurto(item?.titulo, 200);
    const pagina = inteiro(item?.pagina);
    if (!titulo || pagina == null || pagina < 1 || pagina > total) continue;
    saida.push({ titulo, pagina, nivel: limitar(inteiro(item?.nivel) || 1, 1, 6) });
  }
  return saida;
}

/** Confere o livro que o navegador quer subir. `usado`: quantos bytes a pessoa já ocupa. */
export function validarLivroNovo(bruto, { usado = 0, quantos = 0 } = {}) {
  const erros = [];
  const tamanho = inteiro(bruto?.tamanho);
  const paginas = inteiro(bruto?.paginas);
  if (!tamanho || tamanho <= 0) erros.push("o arquivo veio vazio");
  else if (tamanho > LIMITES_DA_BIBLIOTECA.arquivo) erros.push(`o PDF tem ${formatarTamanho(tamanho)} — o limite é ${formatarTamanho(LIMITES_DA_BIBLIOTECA.arquivo)} por arquivo`);
  else if (usado + tamanho > LIMITES_DA_BIBLIOTECA.total) erros.push(`não cabe: a sua biblioteca usa ${formatarTamanho(usado)} de ${formatarTamanho(LIMITES_DA_BIBLIOTECA.total)}. Apague um livro que não usa mais.`);
  if (!paginas || paginas < 1) erros.push("não consegui ler as páginas do PDF");
  else if (paginas > LIMITES_DA_BIBLIOTECA.paginas) erros.push(`o PDF tem ${paginas} páginas — o limite é ${LIMITES_DA_BIBLIOTECA.paginas}`);
  if (quantos >= LIMITES_DA_BIBLIOTECA.livros) erros.push(`a biblioteca chegou a ${LIMITES_DA_BIBLIOTECA.livros} livros`);
  const titulo = textoCurto(bruto?.titulo, 200) || "Livro sem nome";
  const capa = typeof bruto?.capa === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(bruto.capa) && bruto.capa.length <= LIMITES_DA_BIBLIOTECA.capa
    ? bruto.capa : null;
  return {
    ok: erros.length === 0,
    erros,
    livro: {
      titulo,
      autor: textoCurto(bruto?.autor, 160),
      tamanho: tamanho || 0,
      paginas: paginas || 0,
      sumario: validarSumario(bruto?.sumario, paginas),
      capa,
    },
  };
}

/** O texto de uma página, como vai para o banco: sem espaço sobrando, sem caractere de controle, no limite. */
export function limparTextoDaPagina(texto) {
  return String(texto || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITES_DA_BIBLIOTECA.textoPorPagina);
}

/** Um lote de páginas de texto vindo do navegador: números dentro do livro, sem repetir. */
export function validarLoteDeTexto(bruto, paginas) {
  const vistos = new Set();
  const saida = [];
  for (const p of Array.isArray(bruto) ? bruto : []) {
    if (saida.length >= LIMITES_DA_BIBLIOTECA.paginasPorLote) break;
    const numero = inteiro(p?.numero);
    if (numero == null || numero < 1 || numero > paginas || vistos.has(numero)) continue;
    vistos.add(numero);
    saida.push({ numero, texto: limparTextoDaPagina(p?.texto) });
  }
  return saida;
}

/**
 * As seções do livro com a faixa de páginas de cada uma: um item do sumário vai da página dele
 * até a página antes do próximo item de nível igual ou mais alto. Só até `nivelMaximo` (capítulo
 * e seção — sub-sub-seção vira detalhe dentro da seção).
 *
 * Sem sumário (muito PDF não tem), o livro é fatiado em blocos de ~`porBloco` páginas.
 */
export function secoesDoLivro(sumario, paginas, { nivelMaximo = 2, porBloco = 15 } = {}) {
  const total = limitar(inteiro(paginas) || 1, 1, LIMITES_DA_BIBLIOTECA.paginas);
  const itens = (Array.isArray(sumario) ? sumario : []).filter((s) => s.nivel <= nivelMaximo);
  if (!itens.length) {
    const saida = [];
    for (let de = 1; de <= total; de += porBloco) {
      const ate = Math.min(total, de + porBloco - 1);
      saida.push({ titulo: `Páginas ${de}–${ate}`, nivel: 1, de, ate });
    }
    return saida;
  }
  const saida = [];
  // o que vem antes do primeiro capítulo (capa, prefácio, sumário) só entra se for grande
  if (itens[0].pagina > 3) saida.push({ titulo: "Início do livro", nivel: 1, de: 1, ate: itens[0].pagina - 1 });
  itens.forEach((s, i) => {
    const proximo = itens.slice(i + 1).find((x) => x.nivel <= s.nivel);
    const ate = proximo ? Math.max(s.pagina, proximo.pagina - 1) : total;
    saida.push({ titulo: s.titulo, nivel: s.nivel, de: s.pagina, ate: Math.min(ate, total) });
  });
  return saida;
}

/** Os capítulos (nível de cima) com as seções dentro: o que a tela de criar curso mostra para escolher. */
export function capitulosDoLivro(sumario, paginas) {
  const secoes = secoesDoLivro(sumario, paginas);
  const nivelDeCima = Math.min(...secoes.map((s) => s.nivel));
  const capitulos = [];
  for (const s of secoes) {
    if (s.nivel === nivelDeCima || !capitulos.length) capitulos.push({ ...s, secoes: [] });
    else capitulos.at(-1).secoes.push(s);
  }
  return capitulos;
}

/** Junta faixas de páginas que se tocam ou se cruzam: [[1,10],[8,20],[30,40]] → [[1,20],[30,40]]. */
export function juntarFaixas(faixas, paginas) {
  const total = limitar(inteiro(paginas) || 1, 1, LIMITES_DA_BIBLIOTECA.paginas);
  const lista = (Array.isArray(faixas) ? faixas : [])
    .map((f) => ({ de: limitar(inteiro(f?.de) || 1, 1, total), ate: limitar(inteiro(f?.ate) || 1, 1, total) }))
    .map((f) => (f.ate < f.de ? { de: f.ate, ate: f.de } : f))
    .sort((a, b) => a.de - b.de);
  const saida = [];
  for (const f of lista) {
    const ultima = saida.at(-1);
    if (ultima && f.de <= ultima.ate + 1) ultima.ate = Math.max(ultima.ate, f.ate);
    else saida.push({ ...f });
  }
  return saida;
}

/**
 * Os retângulos de uma marcação, em fração da página (0 a 1): é o que deixa o destaque no lugar
 * certo em qualquer zoom e em qualquer tela. Joga fora o que é minúsculo ou cai fora da página.
 */
export function validarRetangulos(bruto) {
  const saida = [];
  for (const r of Array.isArray(bruto) ? bruto : []) {
    if (saida.length >= LIMITES_DA_BIBLIOTECA.retangulos) break;
    if (!Array.isArray(r) || r.length !== 4) continue;
    let [x, y, l, a] = r.map(Number);
    if (![x, y, l, a].every(Number.isFinite)) continue;
    x = limitar(x, 0, 1); y = limitar(y, 0, 1);
    l = limitar(l, 0, 1 - x); a = limitar(a, 0, 1 - y);
    if (l < 0.002 || a < 0.002) continue;
    saida.push([x, y, l, a].map((v) => Math.round(v * 10000) / 10000));
  }
  return saida;
}

/**
 * Os retângulos da seleção, do jeito que o navegador dá (um por pedaço de texto), juntados por
 * linha: pedaços na mesma altura que se tocam viram uma faixa só — senão o destaque sai picotado.
 */
export function juntarRetangulosPorLinha(rets, { folga = 0.004 } = {}) {
  const lista = validarRetangulos(rets).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const saida = [];
  for (const r of lista) {
    const ultimo = saida.at(-1);
    const mesmaLinha = ultimo && Math.abs(ultimo[1] - r[1]) < Math.max(ultimo[3], r[3]) * 0.5;
    if (mesmaLinha && r[0] <= ultimo[0] + ultimo[2] + folga) {
      const fim = Math.max(ultimo[0] + ultimo[2], r[0] + r[2]);
      const topo = Math.min(ultimo[1], r[1]);
      const baixo = Math.max(ultimo[1] + ultimo[3], r[1] + r[3]);
      ultimo[2] = fim - ultimo[0];
      ultimo[1] = topo;
      ultimo[3] = baixo - topo;
    } else {
      saida.push([...r]);
    }
  }
  return saida.map((r) => r.map((v) => Math.round(v * 10000) / 10000));
}

/** Confere uma marcação nova ou editada. */
export function validarMarcacao(bruto, { paginas, parcial = false } = {}) {
  const erros = [];
  const m = {};
  if (!parcial || bruto?.pagina !== undefined) {
    const pagina = inteiro(bruto?.pagina);
    if (pagina == null || pagina < 1 || pagina > paginas) erros.push("página fora do livro");
    else m.pagina = pagina;
  }
  if (!parcial || bruto?.tipo !== undefined) m.tipo = TIPOS_DE_MARCACAO.includes(bruto?.tipo) ? bruto.tipo : "destaque";
  if (!parcial || bruto?.cor !== undefined) m.cor = CORES_DE_MARCACAO.includes(bruto?.cor) ? bruto.cor : CORES_DE_MARCACAO[0];
  if (!parcial || bruto?.texto !== undefined) m.texto = String(bruto?.texto ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITES_DA_BIBLIOTECA.textoDaMarcacao);
  if (!parcial || bruto?.nota !== undefined) m.nota = String(bruto?.nota ?? "").trim().slice(0, LIMITES_DA_BIBLIOTECA.nota);
  if (!parcial || bruto?.retangulos !== undefined) m.retangulos = validarRetangulos(bruto?.retangulos);
  const tipo = m.tipo;
  if (!parcial && tipo !== "marcador" && !m.retangulos.length) erros.push("a marcação ficou sem área na página");
  if (!parcial && tipo === "marcador") m.retangulos = [];
  return { ok: erros.length === 0, erros, marcacao: m };
}

/** "37%": até onde a pessoa leu. */
export function progressoDaLeitura(ultimaPagina, paginas) {
  const total = Math.max(1, inteiro(paginas) || 1);
  return Math.round((limitar(inteiro(ultimaPagina) || 1, 1, total) / total) * 100);
}

/** O termo de busca, limpo; null se curto demais para valer a pena. */
export function termoDeBusca(bruto) {
  const t = String(bruto || "").replace(/\s+/g, " ").trim().slice(0, 120);
  return t.length >= 2 ? t : null;
}
