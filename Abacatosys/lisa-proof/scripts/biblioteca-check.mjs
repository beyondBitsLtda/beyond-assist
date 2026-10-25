// Testa as regras puras dos Cadernos, da Biblioteca, do Markdown da prévia e do curso a partir de um
// livro (pedido de 25/10/2026).
// Uso:  npm run biblioteca-check

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validarCaderno, validarPagina, linguagemDoTitulo, montarArvore, paginasEmOrdem, ordemNoFim, moverEntreIrmaos,
  estatisticasDoTexto, normalizarAlvo, enderecoDoAlvo, rotuloDoAlvo, tituloDaAnotacao, citacaoDoLivro, anexarAoConteudo,
  LINGUAGENS_DO_CADERNO, alvoNaoEncontrado,
} from "../src/dominio/cadernos.js";
import {
  validarLivroNovo, validarSumario, secoesDoLivro, capitulosDoLivro, juntarFaixas, validarRetangulos, juntarRetangulosPorLinha,
  validarMarcacao, limparTextoDaPagina, validarLoteDeTexto, tituloDoArquivo, progressoDaLeitura, termoDeBusca, formatarTamanho,
  LIMITES_DA_BIBLIOTECA,
} from "../src/dominio/biblioteca.js";
import { blocosDoMarkdown, emLinha, enderecoSeguro, titulosDoMarkdown } from "../src/dominio/markdown.js";
import {
  cotasDoMaterial, materialDoCurso, tarefaDeLeitura, assuntosParaOLivro, validarCursoDoLivro, leiturasDoCurso, paginaDoAssunto,
} from "../src/dominio/cursoDoLivro.js";
import { validarCurso, assuntosEmOrdem } from "../src/dominio/curso.js";

let passou = 0;
function caso(nome, fn) {
  try {
    fn();
    passou++;
    console.log(`  ok    ${nome}`);
  } catch (e) {
    console.error(`  FALHOU ${nome}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

const ID = "11111111-2222-4333-8444-555555555555";

console.log("\ncadernos");
caso("caderno sem nome é recusado; cor e ícone desconhecidos voltam ao padrão", () => {
  assert.equal(validarCaderno({ titulo: "  " }).ok, false);
  const r = validarCaderno({ titulo: "  Estudos   de JS ", cor: "roxo-neon", icone: "🦄" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.caderno, { titulo: "Estudos de JS", descricao: "", cor: "vermelho", icone: "📓" });
});
caso("edição parcial só mexe no que veio", () => {
  assert.deepEqual(validarCaderno({ cor: "azul" }, { parcial: true }).caderno, { cor: "azul" });
});
caso("a linguagem sai da extensão do título", () => {
  assert.equal(linguagemDoTitulo("closures.js"), "javascript");
  assert.equal(linguagemDoTitulo("rotas.PY"), "python");
  assert.equal(linguagemDoTitulo("consulta.sql"), "sql");
  assert.equal(linguagemDoTitulo("Anotações gerais"), null);
  assert.equal(validarPagina({ titulo: "build.sh" }).pagina.linguagem, "shell");
  assert.equal(validarPagina({ titulo: "Resumo do cap. 3" }).pagina.linguagem, "markdown");
  assert.equal(validarPagina({ titulo: "x", linguagem: "brainfuck" }).pagina.linguagem, "markdown");
});
caso("renomear com extensão troca a linguagem; sem extensão, não mexe", () => {
  assert.equal(validarPagina({ titulo: "rotas.py" }, { parcial: true }).pagina.linguagem, "python");
  assert.equal(validarPagina({ titulo: "Resumo" }, { parcial: true }).pagina.linguagem, undefined);
  assert.equal(validarPagina({ titulo: "a.py", linguagem: "sql" }, { parcial: true }).pagina.linguagem, "sql");
  assert.equal(validarPagina({ conteudo: "x" }, { parcial: true }).pagina.linguagem, undefined);
});
caso("toda linguagem do caderno tem rótulo e extensão", () => {
  for (const l of LINGUAGENS_DO_CADERNO) assert.ok(l.rotulo && l.extensoes.length, l.chave);
});
caso("página grande demais é recusada", () => {
  const r = validarPagina({ titulo: "x", conteudo: "a".repeat(1_000_001) });
  assert.equal(r.ok, false);
});
caso("árvore: módulos com as páginas dentro, página órfã volta para a raiz, tudo em ordem", () => {
  const arvore = montarArvore([
    { id: "p3", tipo: "pagina", titulo: "solta", ordem: 3000, moduloId: null },
    { id: "m1", tipo: "modulo", titulo: "Módulo 1", ordem: 1000 },
    { id: "p2", tipo: "pagina", titulo: "b", ordem: 2000, moduloId: "m1" },
    { id: "p1", tipo: "pagina", titulo: "a", ordem: 1000, moduloId: "m1" },
    { id: "p4", tipo: "pagina", titulo: "órfã", ordem: 500, moduloId: "sumiu" },
  ]);
  assert.deepEqual(arvore.map((i) => i.id), ["p4", "m1", "p3"]);
  assert.deepEqual(arvore[1].paginas.map((p) => p.id), ["p1", "p2"]);
  assert.equal(arvore[0].moduloId, null);
  assert.deepEqual(paginasEmOrdem(arvore).map((p) => p.id), ["p4", "p1", "p2", "p3"]);
});
caso("ordem no fim e mover entre irmãos", () => {
  assert.equal(ordemNoFim([]), 1024);
  assert.equal(ordemNoFim([{ ordem: 2048 }, { ordem: 1024 }]), 3072);
  const irmaos = [{ id: "a", ordem: 1024 }, { id: "b", ordem: 2048 }, { id: "c", ordem: 3072 }];
  assert.deepEqual(moverEntreIrmaos(irmaos, "c", "cima"), [{ id: "c", ordem: 2048 }, { id: "b", ordem: 3072 }]);
  assert.deepEqual(moverEntreIrmaos(irmaos, "a", "cima"), []);
});
caso("estatísticas da barra de status", () => {
  assert.deepEqual(estatisticasDoTexto("olá mundo\nsegunda_linha 42"), { linhas: 2, palavras: 4, caracteres: 26 });
  assert.deepEqual(estatisticasDoTexto(""), { linhas: 1, palavras: 0, caracteres: 0 });
});

console.log("\nvínculos");
caso("o alvo precisa de tipo, id e, no andar, do número", () => {
  assert.equal(normalizarAlvo({ tipo: "planeta", id: ID }).ok, false);
  assert.equal(normalizarAlvo({ tipo: "trilha", id: "x" }).ok, false);
  assert.equal(normalizarAlvo({ tipo: "andar", id: ID }).ok, false);
  assert.deepEqual(normalizarAlvo({ tipo: "andar", id: ID, numero: "7" }).alvo, { tipo: "andar", id: ID, numero: 7 });
  assert.equal(normalizarAlvo({ tipo: "trilha", id: ID, numero: 3 }).alvo.numero, null);
  assert.equal(normalizarAlvo({ tipo: "livro", id: ID }).alvo.numero, null);
  assert.equal(normalizarAlvo({ tipo: "livro", id: ID, numero: 45 }).alvo.numero, 45);
});
caso("endereço e rótulo de cada alvo", () => {
  assert.equal(enderecoDoAlvo({ tipo: "andar", id: ID, numero: 7 }), `/dominio/${ID}?andar=7`);
  assert.equal(enderecoDoAlvo({ tipo: "livro", id: ID, numero: 45 }), `/biblioteca/${ID}?pagina=45`);
  assert.equal(enderecoDoAlvo({ tipo: "assunto", id: ID, trilhaId: "t1" }), `/trilhas/t1?assunto=${ID}`);
  assert.equal(enderecoDoAlvo({ tipo: "assunto", id: ID }), null);
  assert.equal(rotuloDoAlvo({ tipo: "andar", numero: 7, nome: "Golem do Callback" }), "Andar 7 · Golem do Callback");
  assert.equal(rotuloDoAlvo({ tipo: "livro", numero: 45, nome: "Clean Code" }), "Clean Code · p. 45");
});
caso("alvo que não existe: a mensagem concorda com o tipo", () => {
  assert.equal(alvoNaoEncontrado("torre"), "não achei a torre entre as suas");
  assert.equal(alvoNaoEncontrado("livro"), "não achei o livro entre os seus");
});
caso("título da página criada por 'Anotar aqui'", () => {
  assert.equal(tituloDaAnotacao({ tipo: "assunto", nome: "Closures" }), "Notas — Closures");
  assert.equal(tituloDaAnotacao({ tipo: "andar", numero: 3, nome: "Rotas" }), "Andar 3 — Rotas");
  assert.equal(tituloDaAnotacao({ tipo: "livro", numero: 12, nome: "SICP" }), "SICP — p. 12");
});
caso("a citação do livro vai com o link de volta e a nota", () => {
  const c = citacaoDoLivro({ livroId: ID, livroTitulo: "Clean Code", pagina: 45, texto: "funções  pequenas\nfazem uma coisa", nota: "rever" });
  assert.equal(c, `> funções pequenas fazem uma coisa\n> — [Clean Code, p. 45](/biblioteca/${ID}?pagina=45)\n\nrever`);
  assert.equal(anexarAoConteudo("# Notas\n\n\n", "x"), "# Notas\n\nx\n");
  assert.equal(anexarAoConteudo("", "x"), "x\n");
});

console.log("\nbiblioteca");
caso("livro novo: tamanho, páginas, espaço da conta e capa conferidos", () => {
  assert.equal(validarLivroNovo({ tamanho: 0, paginas: 10 }).ok, false);
  assert.equal(validarLivroNovo({ tamanho: LIMITES_DA_BIBLIOTECA.arquivo + 1, paginas: 10 }).ok, false);
  assert.match(validarLivroNovo({ tamanho: 1000, paginas: 10 }, { usado: LIMITES_DA_BIBLIOTECA.total }).erros[0], /não cabe/);
  assert.equal(validarLivroNovo({ tamanho: 1000, paginas: 6000 }).ok, false);
  const r = validarLivroNovo({ titulo: "SICP", tamanho: 1000, paginas: 10, capa: "javascript:alert(1)" });
  assert.equal(r.ok, true);
  assert.equal(r.livro.capa, null);
  assert.equal(validarLivroNovo({ tamanho: 1, paginas: 1, capa: "data:image/jpeg;base64,AAAA" }).livro.capa, "data:image/jpeg;base64,AAAA");
});
caso("título do arquivo quando o do PDF é lixo", () => {
  assert.equal(tituloDoArquivo("clean_code.pdf", "Microsoft Word - cc.docx"), "clean code");
  assert.equal(tituloDoArquivo("x.pdf", "Estruturas de Dados"), "Estruturas de Dados");
  assert.equal(tituloDoArquivo("", ""), "Livro sem nome");
});
caso("sumário: página fora do livro e título vazio saem", () => {
  assert.deepEqual(validarSumario([{ titulo: "Cap 1", pagina: 3, nivel: 1 }, { titulo: "", pagina: 4 }, { titulo: "Cap 9", pagina: 999 }, { titulo: "1.1", pagina: 5, nivel: 9 }], 100),
    [{ titulo: "Cap 1", pagina: 3, nivel: 1 }, { titulo: "1.1", pagina: 5, nivel: 6 }]);
});
caso("seções: cada item vai até antes do próximo de nível igual ou maior", () => {
  const sumario = [
    { titulo: "Cap 1", pagina: 5, nivel: 1 }, { titulo: "1.1", pagina: 5, nivel: 2 }, { titulo: "1.2", pagina: 12, nivel: 2 },
    { titulo: "Cap 2", pagina: 20, nivel: 1 }, { titulo: "2.1.1", pagina: 22, nivel: 3 },
  ];
  assert.deepEqual(secoesDoLivro(sumario, 40).map((s) => [s.titulo, s.de, s.ate]), [
    ["Início do livro", 1, 4], ["Cap 1", 5, 19], ["1.1", 5, 11], ["1.2", 12, 19], ["Cap 2", 20, 40],
  ]);
  const caps = capitulosDoLivro(sumario, 40);
  assert.deepEqual(caps.map((c) => [c.titulo, c.secoes.length]), [["Início do livro", 0], ["Cap 1", 2], ["Cap 2", 0]]);
});
caso("sem sumário, o livro vira blocos de páginas", () => {
  assert.deepEqual(secoesDoLivro([], 32).map((s) => [s.de, s.ate]), [[1, 15], [16, 30], [31, 32]]);
});
caso("faixas que se tocam viram uma", () => {
  assert.deepEqual(juntarFaixas([{ de: 30, ate: 40 }, { de: 1, ate: 10 }, { de: 8, ate: 20 }, { de: 21, ate: 22 }], 100), [{ de: 1, ate: 22 }, { de: 30, ate: 40 }]);
  assert.deepEqual(juntarFaixas([{ de: 90, ate: 500 }], 100), [{ de: 90, ate: 100 }]);
});
caso("retângulos: dentro da página, sem migalha", () => {
  assert.deepEqual(validarRetangulos([[0.1, 0.2, 0.3, 0.02], [0.9, 0.9, 0.5, 0.5], [0, 0, 0.0001, 0.1], ["x", 0, 1, 1], [1, 2]]),
    [[0.1, 0.2, 0.3, 0.02], [0.9, 0.9, 0.1, 0.1]]);
});
caso("pedaços da seleção na mesma linha viram uma faixa", () => {
  const r = juntarRetangulosPorLinha([[0.1, 0.2, 0.1, 0.02], [0.2, 0.2005, 0.15, 0.02], [0.1, 0.25, 0.2, 0.02]]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], [0.1, 0.2, 0.25, 0.0205]);
});
caso("marcação: página do livro, cor conhecida, área obrigatória (menos no marcador)", () => {
  assert.equal(validarMarcacao({ pagina: 0, retangulos: [[0.1, 0.1, 0.2, 0.2]] }, { paginas: 10 }).ok, false);
  assert.equal(validarMarcacao({ pagina: 2, retangulos: [] }, { paginas: 10 }).ok, false);
  const m = validarMarcacao({ pagina: 2, tipo: "marcador", cor: "neon" }, { paginas: 10 });
  assert.equal(m.ok, true);
  assert.equal(m.marcacao.cor, "amarelo");
  assert.deepEqual(validarMarcacao({ nota: "  ok " }, { paginas: 10, parcial: true }).marcacao, { nota: "ok" });
});
caso("texto da página limpo; lote sem repetir e dentro do livro", () => {
  assert.equal(limparTextoDaPagina("a\u0000b   c \n\n\n\n d"), "ab c\n\nd");
  const lote = validarLoteDeTexto([{ numero: 1, texto: "x" }, { numero: 1, texto: "y" }, { numero: 99, texto: "z" }, { numero: "2", texto: "w" }], 10);
  assert.deepEqual(lote, [{ numero: 1, texto: "x" }, { numero: 2, texto: "w" }]);
});
caso("progresso, busca e tamanho", () => {
  assert.equal(progressoDaLeitura(50, 200), 25);
  assert.equal(progressoDaLeitura(999, 200), 100);
  assert.equal(termoDeBusca(" a "), null);
  assert.equal(termoDeBusca("  closure   lexical "), "closure lexical");
  assert.equal(formatarTamanho(52428800), "50 MB");
});

console.log("\nmarkdown da prévia");
caso("títulos, listas com tarefas, código e tabela", () => {
  const b = blocosDoMarkdown("# Título\n\nTexto **forte**.\n\n- [x] feito\n- [ ] falta\n  - recuado\n\n```js\nconst a = 1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n---\n> citação");
  assert.deepEqual(b.map((x) => x.tipo), ["titulo", "paragrafo", "lista", "codigo", "tabela", "divisoria", "citacao"]);
  assert.deepEqual(b[2].itens.map((i) => [i.tarefa, i.recuo]), [[true, 0], [false, 0], [null, 1]]);
  assert.equal(b[3].linguagem, "js");
  assert.equal(b[3].texto, "const a = 1;");
  assert.equal(b[4].linhas[0].length, 2);
});
caso("código sem fecho vai até o fim; Markdown dentro do código fica cru", () => {
  const b = blocosDoMarkdown("```\n# não é título\n**nem negrito**");
  assert.equal(b.length, 1);
  assert.equal(b[0].texto, "# não é título\n**nem negrito**");
});
caso("pedaços de linha: negrito, itálico, riscado, código, link", () => {
  const p = emLinha("a **b** _c_ ~~d~~ `e*f*` [g](https://x.dev) h");
  assert.deepEqual(p.map((x) => x.t), ["texto", "negrito", "texto", "italico", "texto", "riscado", "texto", "codigo", "texto", "link", "texto"]);
  assert.equal(p[7].v, "e*f*");
});
caso("link perigoso vira texto; caminho interno e e-mail passam", () => {
  assert.equal(enderecoSeguro("javascript:alert(1)"), null);
  assert.equal(enderecoSeguro("//evil.com/x"), null);
  assert.equal(enderecoSeguro("/biblioteca/abc?pagina=3"), "/biblioteca/abc?pagina=3");
  assert.equal(enderecoSeguro("mailto:a@b.com"), "mailto:a@b.com");
  assert.deepEqual(emLinha("[x](javascript:alert(1))")[0].t, "texto");
});
caso("palavra_com_sublinhado não vira itálico; endereço solto vira link", () => {
  assert.deepEqual(emLinha("minha_variavel_aqui").map((x) => x.t), ["texto"]);
  const p = emLinha("veja https://mdn.dev/x.");
  assert.equal(p[1].t, "link");
  assert.equal(p[1].href, "https://mdn.dev/x");
});
caso("índice de títulos ignora o que está dentro de código", () => {
  assert.deepEqual(titulosDoMarkdown("# A\n```\n# não\n```\n## B").map((t) => [t.nivel, t.texto, t.linha]), [[1, "A", 1], [2, "B", 5]]);
});

console.log("\ncurso a partir de um livro");
const LIVRO = { id: ID, titulo: "JavaScript Eloquente", autor: "Marijn", paginas: 300 };
caso("a cota de texto acompanha o tamanho da seção, com mínimo", () => {
  const c = cotasDoMaterial([{ de: 1, ate: 30 }, { de: 31, ate: 33 }], 10000);
  assert.ok(c[0].cota > c[1].cota);
  assert.equal(c[1].cota, 909);
  assert.ok(c[1].cota >= 700);
});
caso("material: sumário escolhido e o texto de cada seção, avisando seção sem texto", () => {
  const secoes = [{ titulo: "Cap 1", nivel: 1, de: 1, ate: 10 }, { titulo: "Cap 2", nivel: 1, de: 11, ate: 20 }];
  const m = materialDoCurso({ livro: LIVRO, secoes, trechos: [{ de: 1, ate: 10, trecho: "[p. 1] Valores e tipos" }] });
  assert.match(m.texto, /Cap 1: págs\. 1–10/);
  assert.match(m.texto, /\[p\. 1\] Valores e tipos/);
  assert.equal(m.semTexto, 1);
});
caso("tarefa de leitura", () => {
  assert.equal(tarefaDeLeitura("SICP", 5, 5), "Ler a pág. 5 de “SICP”");
  assert.equal(tarefaDeLeitura("SICP", 5, 9), "Ler as págs. 5–9 de “SICP”");
});
caso("livro curto não rende 40 assuntos", () => {
  assert.equal(assuntosParaOLivro(40, 30), 10);
  assert.equal(assuntosParaOLivro(12, 600), 12);
  assert.equal(assuntosParaOLivro(40, 2), 3);
});
caso("proposta do livro: páginas dentro das faixas, leitura primeiro, livro guardado", () => {
  const bruto = {
    nome: "JS Eloquente", descricao: "d", resumo: "r", tema: "JavaScript",
    modulos: [
      { nome: "Cap 1", assuntos: [
        { titulo: "Valores", dias: 1, nivel: "basico", tarefas: ["Ler as págs. 1-5", "Resumir os tipos no caderno"], paginas: { de: 1, ate: 6 } },
        { titulo: "Operadores", dias: 1, nivel: "basico", tarefas: ["Refazer o exemplo da pág. 8"], paginas: { de: 900, ate: 950 } },
      ] },
      { nome: "Cap 2", assuntos: [
        { titulo: "Funções", dias: 2, nivel: "basico", tarefas: [], paginas: { de: 40, ate: 30 } },
      ] },
    ],
  };
  const r = validarCursoDoLivro(bruto, { livro: LIVRO, faixas: [{ de: 1, ate: 60 }] });
  assert.equal(r.ok, true);
  const a = assuntosEmOrdem(r.proposta);
  assert.deepEqual(a.map((x) => [x.paginas.de, x.paginas.ate]), [[1, 6], [7, 7], [30, 40]]);
  assert.equal(a[0].tarefas[0], "Ler as págs. 1–6 de “JavaScript Eloquente”");
  assert.equal(a[0].tarefas.length, 2, "a leitura que o modelo pôs não fica repetida");
  assert.equal(a[1].tarefas[0], "Ler a pág. 7 de “JavaScript Eloquente”");
  assert.deepEqual(r.proposta.livro, { id: ID, titulo: "JavaScript Eloquente" });
});
caso("curso comum continua igual (sem páginas, sem livro)", () => {
  const r = validarCurso({ tema: "SQL", modulos: [{ nome: "M", assuntos: [{ titulo: "a" }, { titulo: "b" }, { titulo: "c" }] }] });
  assert.equal(r.ok, true);
  assert.equal(r.proposta.livro, undefined);
  assert.equal(assuntosEmOrdem(r.proposta)[0].paginas, undefined);
});
caso("leituras e página do caderno do curso", () => {
  const assuntos = [{ titulo: "A", paginas: { de: 1, ate: 4 }, secao: "Cap 1" }, { titulo: "B" }];
  assert.deepEqual(leiturasDoCurso(assuntos, ["c1", "c2"], ID), [{ card_id: "c1", livro_id: ID, de: 1, ate: 4, secao: "Cap 1" }]);
  const pagina = paginaDoAssunto({ assunto: { titulo: "Closures", objetivo: "entender escopo", paginas: { de: 50, ate: 58 } }, livro: LIVRO });
  assert.match(pagina, /^# Closures/);
  assert.match(pagina, new RegExp(`\\(/biblioteca/${ID}\\?pagina=50\\)`));
});

console.log("\nmigração");
caso("a 019 só acrescenta e fecha as funções para a chave anônima", () => {
  const sql = fs.readFileSync(new URL("../db/019-cadernos-e-biblioteca.sql", import.meta.url), "utf8");
  assert.ok(!/\bdrop\s+table\b/i.test(sql), "sem drop table");
  assert.ok(!/\bdelete\s+from\b/i.test(sql), "sem delete");
  for (const f of ["proof_trechos_do_livro", "proof_busca_no_livro"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`));
  }
  for (const t of ["proof_cadernos", "proof_caderno_paginas", "proof_vinculos", "proof_livros", "proof_livro_paginas", "proof_marcacoes", "proof_leituras"]) {
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`));
  }
  assert.match(sql, /'proof-biblioteca', 'proof-biblioteca', false/);
});

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
