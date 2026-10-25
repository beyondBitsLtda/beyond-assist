// Um curso a partir de um livro da biblioteca (pedido de 25/10/2026): "quero poder gerar cursos com
// base nesses livros em PDF, estruture da melhor forma possível".
//
// A estrutura segue o LIVRO, não a imaginação do modelo:
//   - cada módulo é um capítulo (ou parte) do livro, na ordem do livro;
//   - cada assunto cobre um trecho contínuo de páginas e já nasce com a leitura dele como a primeira
//     tarefa ("Ler as págs. 45–60 de …", que abre o leitor na página);
//   - as outras tarefas são sobre o que ESTÁ no trecho (o modelo recebe o texto das páginas);
//   - o quiz, o exercício e a explicação do assunto depois também leem esse trecho
//     (src/lib/leituras.js), então a prática cobra o que o livro ensina.
//
// Puro: sem banco, sem rede.

import { validarCurso, LIMITES_DO_CURSO } from "./curso.js";

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const curto = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Quanto texto do livro vai para a IA montar o curso: o bastante para entender cada seção, sem virar um livro inteiro. */
export const ORCAMENTO_DO_MATERIAL = 160_000; // caracteres (~40 mil tokens)
const MINIMO_POR_SECAO = 700;

/**
 * Quanto texto pedir de cada seção escolhida: o orçamento dividido pelo tamanho das seções (seção
 * de 40 páginas leva mais que uma de 4), com um mínimo para nenhuma sumir.
 */
export function cotasDoMaterial(secoes, orcamento = ORCAMENTO_DO_MATERIAL) {
  const lista = Array.isArray(secoes) ? secoes : [];
  if (!lista.length) return [];
  const paginas = lista.map((s) => Math.max(1, s.ate - s.de + 1));
  const total = paginas.reduce((a, b) => a + b, 0);
  return lista.map((s, i) => ({ ...s, cota: Math.max(MINIMO_POR_SECAO, Math.floor((orcamento * paginas[i]) / total)) }));
}

/**
 * O material que a IA lê: o sumário escolhido e, de cada seção, o começo do texto dela (com as
 * marcas [p. N] que vêm do banco, para a IA saber em que página cada coisa está).
 */
export function materialDoCurso({ livro, secoes, trechos, sumario = secoes }) {
  const porFaixa = new Map((trechos || []).map((t) => [`${t.de}-${t.ate}`, t]));
  const partes = [
    `LIVRO: "${curto(livro.titulo, 200)}"${livro.autor ? ` — ${curto(livro.autor, 160)}` : ""} (${livro.paginas} páginas)`,
    "",
    "SUMÁRIO ESCOLHIDO (seção: páginas):",
    ...sumario.map((s) => `${"  ".repeat(Math.max(0, s.nivel - 1))}- ${s.titulo}: págs. ${s.de}–${s.ate}`),
    "",
    "TEXTO DE CADA SEÇÃO (o começo dela; [p. N] marca a página):",
  ];
  let semTexto = 0;
  for (const s of secoes) {
    const t = porFaixa.get(`${s.de}-${s.ate}`);
    const texto = String(t?.trecho || "").trim();
    if (!texto) semTexto++;
    partes.push("", `### ${s.titulo} (págs. ${s.de}–${s.ate})`, texto || "(sem texto nestas páginas — talvez sejam imagens)");
  }
  return { texto: partes.join("\n"), semTexto };
}

/** A tarefa de leitura que abre cada assunto. */
export function tarefaDeLeitura(livroTitulo, de, ate) {
  const titulo = curto(livroTitulo, 70);
  const paginas = de === ate ? `a pág. ${de}` : `as págs. ${de}–${ate}`;
  return curto(`Ler ${paginas} de “${titulo}”`, 200);
}

/** Quantos assuntos pedir: o que a duração pede, sem passar de ~1 por 3 páginas escolhidas (livro curto não rende 40 assuntos). */
export function assuntosParaOLivro(assuntosDaDuracao, paginasEscolhidas) {
  const peloTamanho = Math.max(LIMITES_DO_CURSO.minimoDeAssuntos, Math.ceil((Number(paginasEscolhidas) || 1) / 3));
  return limitar(Math.min(assuntosDaDuracao, peloTamanho), LIMITES_DO_CURSO.minimoDeAssuntos, LIMITES_DO_CURSO.assuntos);
}

/**
 * Confere a proposta que a IA fez a partir do livro. Além do que `validarCurso` confere:
 *   - as páginas de cada assunto ficam dentro das faixas escolhidas (o modelo às vezes inventa a
 *     página 900 num livro de 300); assunto sem página válida herda a página seguinte à do anterior;
 *   - a primeira tarefa é sempre a leitura das páginas (tirando uma leitura parecida que o modelo
 *     tenha posto por conta própria, para não ficar repetida);
 *   - o curso guarda o livro de onde saiu.
 */
export function validarCursoDoLivro(bruto, { livro, faixas }) {
  const r = validarCurso({ ...bruto, livro: { id: livro.id, titulo: livro.titulo } });
  if (!r.proposta) return r;
  const lista = (faixas || []).length ? faixas : [{ de: 1, ate: livro.paginas }];
  const minimo = Math.min(...lista.map((f) => f.de));
  const maximo = Math.max(...lista.map((f) => f.ate));
  const dentro = (p) => lista.some((f) => p >= f.de && p <= f.ate);

  let ultimaPagina = minimo - 1;
  for (const m of r.proposta.modulos) {
    for (const a of m.assuntos) {
      let de = a.paginas?.de;
      let ate = a.paginas?.ate;
      if (!Number.isFinite(de) || !dentro(de)) {
        // começo inventado: o fim também não merece confiança — fica a página seguinte à do anterior
        de = limitar(ultimaPagina + 1, minimo, maximo);
        ate = de;
      } else {
        if (!Number.isFinite(ate) || ate < de) ate = de;
        if (!dentro(ate)) ate = lista.find((f) => de >= f.de && de <= f.ate).ate;
      }
      ate = limitar(ate, de, maximo);
      // não deixa um assunto engolir o livro todo por um erro do modelo
      if (ate - de > 120) ate = de + 120;
      a.paginas = { de, ate };
      a.secao = a.secao || "";
      ultimaPagina = Math.max(ultimaPagina, ate);
      const leitura = tarefaDeLeitura(livro.titulo, de, ate);
      const outras = a.tarefas.filter((t) => !/^ler (as |a )?p[áa]g/i.test(t));
      a.tarefas = [leitura, ...outras].slice(0, LIMITES_DO_CURSO.tarefas);
    }
  }
  return r;
}

/** As linhas de leitura (proof_leituras) do curso criado: cada card com as páginas dele. */
export function leiturasDoCurso(assuntos, cardIds, livroId) {
  return assuntos
    .map((a, i) => (a.paginas && cardIds[i] ? { card_id: cardIds[i], livro_id: livroId, de: a.paginas.de, ate: a.paginas.ate, secao: curto(a.secao, 200) } : null))
    .filter(Boolean);
}

/**
 * A página do caderno do curso para um assunto: o objetivo, a leitura (com o link que abre o
 * leitor na página) e um roteiro de anotação. É um ponto de partida; a pessoa escreve por cima.
 */
export function paginaDoAssunto({ assunto, livro }) {
  const linhas = [`# ${assunto.titulo}`, ""];
  if (assunto.objetivo) linhas.push(`**Objetivo:** ${assunto.objetivo}`, "");
  if (livro && assunto.paginas) {
    const { de, ate } = assunto.paginas;
    linhas.push(`📖 [${curto(livro.titulo, 100)}, ${de === ate ? `p. ${de}` : `págs. ${de}–${ate}`}](/biblioteca/${livro.id}?pagina=${de})`, "");
  }
  linhas.push("## Ideias principais", "", "- ", "", "## Exemplos e código", "", "```", "", "```", "", "## Dúvidas para levar à Lisa", "", "- ");
  return linhas.join("\n");
}
