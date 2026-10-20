// Testa as regras puras da Lisa_Proof: datas, ofensiva, plano da trilha e metas.
// Uso:  npm run dominio-check

import assert from "node:assert/strict";
import { diaDe, somarDias, diaDaSemana, inicioDaSemana, fimDoMes, diaValido, formatarDia } from "../src/dominio/datas.js";
import { calcularOfensiva } from "../src/dominio/ofensiva.js";
import { ehQuadroDeEstudo, temaDo } from "../src/dominio/estudo.js";
import {
  validarPlano, planoPadrao, agendar, montarEtapas, planoDoReplanejamento,
  normalizarDiasDeEstudo, diasEstimados,
} from "../src/dominio/plano.js";
import { resumoDasMetas, tarefasDoDia } from "../src/dominio/metas.js";
import { nivelPorPontos } from "../src/dominio/pontos.js";
import {
  periodoDe, periodoPermitido, pontosDoQuiz, pontosDaNota, validarQuiz, quizParaTela,
  separarCodigoDaPergunta, perguntaPedeCodigo, textoDeCodigo, podeReenviar, entregaConcluida,
  validarAvaliacao, assuntoAtual, mapaDaTrilha, TENTATIVAS, RODADAS_POR_DIA, podeAbrirRodada, fatorDaRodada, comFatorDaRodada,
} from "../src/dominio/pratica.js";
import { nomePublico, apelidoValido, posicionar, ANONIMO } from "../src/dominio/ranking.js";
import {
  podeMelhorar, podeSubirNeuro, poderDo, producaoAcumulada, podeInvadir, batalha, saldoDe, somarTrofeus,
  faixaDeDefesa, estagioDoNeuro, ATAQUES_POR_DIA, TETO_DO_SAQUE, TROFEUS,
  rivalSimulado, chanceDeVitoria, simularBatalha, fatorDaSorte,
} from "../src/dominio/reino.js";
import { estatisticas, conquistasNovas, desbloqueadasDe, vitrine } from "../src/dominio/conquistas.js";
import { conferirChamado, tituloDoChamado, descricaoDoChamado } from "../src/dominio/chamado.js";
import { montarRaioX, acertosDoQuiz, horaEmSaoPaulo } from "../src/dominio/raioX.js";
import { assuntosParaODuracao, nomeDoQuadro, validarCurso, assuntosEmOrdem, resumoDoCurso } from "../src/dominio/curso.js";
import { montarAgenda, itensDoDia, gradeDoMes, mesVizinho } from "../src/dominio/agenda.js";

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

console.log("\ndatas");
caso("23h de segunda em São Paulo ainda é segunda (o Worker roda em UTC)", () => {
  assert.equal(diaDe(new Date("2026-10-06T02:30:00Z")), "2026-10-05");
});
caso("somar dias atravessa mês e ano", () => {
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
});
caso("semana começa na segunda", () => {
  assert.equal(diaDaSemana("2026-10-06"), 2); // terça
  assert.equal(inicioDaSemana("2026-10-06"), "2026-10-05");
  assert.equal(inicioDaSemana("2026-10-11"), "2026-10-05"); // domingo fecha a semana
});
caso("fim do mês e dia válido", () => {
  assert.equal(fimDoMes("2028-02-10"), "2028-02-29");
  assert.equal(diaValido("2026-02-31"), false);
  assert.equal(diaValido("2026-10-06"), true);
  assert.equal(formatarDia("2026-10-06", { comSemana: true }), "ter, 06/10");
});

console.log("\nofensiva");
caso("hoje sem estudo não quebra a sequência — deixa em risco", () => {
  const o = calcularOfensiva(["2026-10-04", "2026-10-05"], "2026-10-06");
  assert.deepEqual(o, { atual: 2, recorde: 2, estudouHoje: false, emRisco: true });
});
caso("estudou hoje soma o dia", () => {
  const o = calcularOfensiva(["2026-10-04", "2026-10-05", "2026-10-06"], "2026-10-06");
  assert.equal(o.atual, 3);
  assert.equal(o.emRisco, false);
});
caso("um dia vazio zera; o recorde fica", () => {
  const o = calcularOfensiva(["2026-09-01", "2026-09-02", "2026-09-03", "2026-10-04"], "2026-10-06");
  assert.equal(o.atual, 0);
  assert.equal(o.recorde, 3);
});

console.log("\nquadros de estudo");
caso("prefixo STUDY", () => {
  for (const n of ["STUDY JavaScript", "study - Java", "STUDY: SQL", "STUDY_Python", "  STUDY"]) assert.ok(ehQuadroDeEstudo(n), n);
  for (const n of ["STUDYING", "Meu STUDY", "Estudos"]) assert.ok(!ehQuadroDeEstudo(n), n);
});
caso("tema sem o prefixo", () => {
  assert.equal(temaDo("STUDY - Java Script"), "Java Script");
  assert.equal(temaDo("STUDY: SQL"), "SQL");
  assert.equal(temaDo("STUDY"), "STUDY");
});

const cards = [
  { id: "c", colunaPosicao: 2, posicao: 1, totalItens: 0 },
  { id: "a", colunaPosicao: 1, posicao: 2, totalItens: 9 },
  { id: "b", colunaPosicao: 1, posicao: 1, totalItens: 4 },
];

console.log("\nplano");
caso("sem IA, segue a ordem visual do quadro e o nível sobe", () => {
  const p = planoPadrao(cards);
  assert.deepEqual(p.etapas.map((e) => e.cardId), ["b", "a", "c"]);
  assert.deepEqual(p.etapas.map((e) => e.nivel), ["basico", "intermediario", "avancado"]);
});
caso("dias estimados pelo tamanho da checklist", () => {
  assert.equal(diasEstimados({ totalItens: 0 }), 1);
  assert.equal(diasEstimados({ totalItens: 9 }), 3);
  assert.equal(diasEstimados({ totalItens: 100 }), 5);
});
caso("plano da IA: id inventado sai, repetido vale uma vez, esquecido entra no fim", () => {
  const p = validarPlano({
    resumo: "ok",
    etapas: [
      { cardId: "a", dias: 9, nivel: "avancado", objetivo: "x" },
      { cardId: "inventado", dias: 1 },
      { cardId: "a", dias: 1 },
      { cardId: "c", dias: "2", nivel: "nivel-que-nao-existe" },
    ],
  }, cards);
  assert.deepEqual(p.etapas.map((e) => e.cardId), ["a", "c", "b"]);
  assert.equal(p.etapas[0].dias, 5);
  assert.equal(p.etapas[1].nivel, "basico");
  assert.equal(p.esquecidos, 1);
});
caso("dias de estudo inválidos viram segunda a sexta", () => {
  assert.deepEqual(normalizarDiasDeEstudo([]), [1, 2, 3, 4, 5]);
  assert.deepEqual(normalizarDiasDeEstudo([6, 0, 6, 9]), [0, 6]);
});
caso("agenda pula o fim de semana e numera as semanas", () => {
  // sexta 09/10: etapa de 2 dias = sexta e segunda; a próxima começa na terça
  const a = agendar([{ cardId: "x", dias: 2 }, { cardId: "y", dias: 1 }], {
    aPartirDe: "2026-10-09", diasDeEstudo: [1, 2, 3, 4, 5],
  });
  assert.deepEqual([a[0].inicio, a[0].fim, a[0].semana], ["2026-10-09", "2026-10-12", 1]);
  assert.deepEqual([a[1].inicio, a[1].semana], ["2026-10-13", 2]);
});
caso("começar num sábado com estudo só em dia útil cai na segunda", () => {
  const [e] = agendar([{ cardId: "x", dias: 1 }], { aPartirDe: "2026-10-10", diasDeEstudo: [1, 2, 3, 4, 5] });
  assert.equal(e.inicio, "2026-10-12");
});
caso("concluído não ocupa agenda; com data antiga, mantém a data", () => {
  const plano = [{ cardId: "a", dias: 1 }, { cardId: "b", dias: 1 }, { cardId: "c", dias: 1 }];
  const etapas = montarEtapas({
    plano,
    concluidos: new Set(["a", "b"]),
    antigas: [{ cardId: "b", inicio: "2026-10-01", fim: "2026-10-01", semana: 1 }],
    aPartirDe: "2026-10-06",
    diasDeEstudo: [1, 2, 3, 4, 5],
    base: "2026-10-01",
  });
  assert.equal(etapas[0].inicio, null);
  assert.equal(etapas[1].inicio, "2026-10-01");
  assert.deepEqual([etapas[2].inicio, etapas[2].semana, etapas[2].ordem], ["2026-10-06", 2, 3]);
});
caso("replanejar mantém a ordem antiga, põe card novo no fim e tira o que sumiu", () => {
  const antigas = [{ cardId: "c", ordem: 1, dias: 2 }, { cardId: "sumiu", ordem: 2 }, { cardId: "a", ordem: 3 }];
  assert.deepEqual(planoDoReplanejamento(antigas, cards).map((e) => e.cardId), ["c", "a", "b"]);
});

console.log("\nmetas e tarefas do dia");
const hoje = "2026-10-07"; // quarta
const etapas = [
  { trilhaId: "t", ordem: 1, inicio: "2026-09-28", fim: "2026-09-30", concluido: false },  // atrasada (semana passada)
  { trilhaId: "t", ordem: 2, inicio: "2026-10-05", fim: "2026-10-06", concluido: true, concluidoHoje: true },
  { trilhaId: "t", ordem: 3, inicio: "2026-10-07", fim: "2026-10-08", concluido: false },
  { trilhaId: "t", ordem: 4, inicio: "2026-10-12", fim: "2026-10-12", concluido: false },
];
caso("semana conta o planejado nela e o atraso de antes", () => {
  const m = resumoDasMetas(etapas, hoje);
  assert.deepEqual([m.semana.feitas, m.semana.total, m.semana.atrasadas], [1, 3, 1]);
  // outubro: 3 planejadas + a atrasada de setembro, que o mês herda
  assert.deepEqual([m.mes.feitas, m.mes.total, m.mes.atrasadas], [1, 4, 1]);
});
caso("hoje: atrasada primeiro, depois a do dia, depois a feita hoje", () => {
  const t = tarefasDoDia(etapas, hoje);
  assert.deepEqual(t.map((e) => [e.ordem, e.situacao]), [[1, "atrasada"], [3, "hoje"], [2, "feita"]]);
});
caso("sem nada para hoje, oferece adiantar o próximo", () => {
  const t = tarefasDoDia([{ trilhaId: "t", ordem: 1, inicio: "2026-10-12", fim: "2026-10-12", concluido: false }], "2026-10-10");
  assert.deepEqual(t.map((e) => e.situacao), ["adiantar"]);
});
caso("nível a cada 200 pontos", () => {
  assert.deepEqual(nivelPorPontos(450), { nivel: 3, noNivel: 50, proximo: 200 });
});

console.log("\nprática");
caso("períodos: dia, segunda da semana, dia 1 do mês", () => {
  assert.equal(periodoDe("quiz", "2026-10-07"), "2026-10-07");
  assert.equal(periodoDe("projeto_semanal", "2026-10-07"), "2026-10-05");
  assert.equal(periodoDe("projeto_mensal", "2026-10-07"), "2026-10-01");
});
caso("período futuro ou torto fica trancado", () => {
  assert.ok(periodoPermitido("projeto_semanal", "2026-09-28", "2026-10-07"));
  assert.ok(!periodoPermitido("projeto_semanal", "2026-10-12", "2026-10-07")); // semana que vem
  assert.ok(!periodoPermitido("projeto_semanal", "2026-10-06", "2026-10-07")); // não é segunda
  assert.ok(!periodoPermitido("quiz", "2026-10-06", "2026-10-07"));            // quiz é só de hoje
  assert.ok(!periodoPermitido("projeto_mensal", "2026-11-01", "2026-10-07"));
});
caso("pontos do quiz e da nota", () => {
  assert.equal(pontosDoQuiz(5, 5), 35);
  assert.equal(pontosDoQuiz(3, 5), 15);
  assert.equal(pontosDaNota("projeto_semanal", 80), 120);
  assert.equal(pontosDaNota("exercicio", 150), 40);
});
caso("quiz: pergunta torta sai; menos de 3 boas derruba", () => {
  const boa = { pergunta: "?", opcoes: ["a", "b", "c", "d"], correta: 2, explicacao: "x" };
  const q = validarQuiz({ perguntas: [boa, boa, { ...boa, correta: 7 }, { ...boa, opcoes: ["a", "a", "b", "c"] }, boa] });
  assert.equal(q.perguntas.length, 3);
  assert.throws(() => validarQuiz({ perguntas: [boa, boa] }));
});
caso("quiz: o código vai para o campo próprio, mesmo grudado numa linha (20/10/2026)", () => {
  const s = separarCodigoDaPergunta("Analise o código a seguir: ```javascript let pontos = 10; console.log(pontos);``` Qual será o resultado?");
  assert.deepEqual([s.linguagem, s.codigo], ["javascript", "let pontos = 10; console.log(pontos);"]);
  assert.equal(s.texto, "Analise o código a seguir: Qual será o resultado?");
  const m = separarCodigoDaPergunta("O que imprime?\n```c\n#include <stdio.h>\nint main() {\n    printf(\"10\");\n}\n```");
  assert.equal(m.codigo, "#include <stdio.h>\nint main() {\n    printf(\"10\");\n}");
  assert.equal(separarCodigoDaPergunta("```let x = 1;``` e então?").codigo, "let x = 1;");
  assert.equal(textoDeCodigo("```python\n  print(1)\n```", 100), "  print(1)");
});
caso("quiz: pergunta que pede código e não traz código é descartada", () => {
  const boa = { opcoes: ["a", "b", "c", "d"], correta: 2, explicacao: "x" };
  assert.ok(perguntaPedeCodigo("Observe o bloco de código C abaixo. O que será impresso?"));
  assert.ok(perguntaPedeCodigo("Analise o trecho a seguir e diga o resultado"));
  assert.ok(!perguntaPedeCodigo("Qual das seguintes opções é um tipo primitivo?"));
  const q = validarQuiz({ perguntas: [
    { ...boa, pergunta: "Observe o bloco de código C abaixo. O que será impresso?" },
    { ...boa, pergunta: "Observe o bloco de código C abaixo. O que será impresso?", codigo: "int main(){ return 0; }", linguagem: "c" },
    { ...boa, pergunta: "Qual tipo é primitivo?" },
    { ...boa, pergunta: "Qual laço repete enquanto a condição for verdadeira?" },
  ] });
  assert.equal(q.perguntas.length, 3);
  assert.equal(q.perguntas[0].codigo, "int main(){ return 0; }");
});
caso("quiz salvo antes da correção: a tela recebe o código separado, ou o aviso de que faltou", () => {
  const t = quizParaTela({ perguntas: [
    { pergunta: "Veja: ```sql SELECT 1;``` o que faz?", opcoes: ["a", "b", "c", "d"], correta: 0, explicacao: "" },
    { pergunta: "Observe o código abaixo. O que sai?", opcoes: ["a", "b", "c", "d"], correta: 0, explicacao: "" },
  ] }, {});
  assert.deepEqual([t[0].codigo, t[0].linguagem, t[0].faltouCodigo], ["SELECT 1;", "sql", false]);
  assert.equal(t[1].faltouCodigo, true);
});
caso("exercício: aprovado ainda pode ser reenviado até a 5ª tentativa (20/10/2026)", () => {
  assert.equal(podeReenviar({ tipo: "exercicio", tentativas: 1, status: "concluido" }), true);
  assert.equal(podeReenviar({ tipo: "exercicio", tentativas: 4, status: "concluido" }), true);
  assert.equal(podeReenviar({ tipo: "exercicio", tentativas: 5, status: "concluido" }), false);
  assert.equal(podeReenviar({ tipo: "exercicio", tentativas: 0, status: null }), true);
});
caso("projeto: aprovado encerra; reprovado segue até as 5 tentativas", () => {
  assert.equal(podeReenviar({ tipo: "projeto_semanal", tentativas: 1, status: "concluido" }), false);
  assert.equal(podeReenviar({ tipo: "projeto_semanal", tentativas: 4, status: "em_andamento" }), true);
  assert.equal(podeReenviar({ tipo: "projeto_mensal", tentativas: 5, status: "em_andamento" }), false);
});
caso("concluído vale pela melhor nota: reenviar e ir pior não desfaz o feito", () => {
  assert.equal(entregaConcluida({ tipo: "exercicio", melhorNota: 70, tentativas: 2 }), true);
  assert.equal(entregaConcluida({ tipo: "exercicio", melhorNota: 40, tentativas: 2 }), false);
  assert.equal(entregaConcluida({ tipo: "exercicio", melhorNota: 40, tentativas: 4 }), false);
  assert.equal(entregaConcluida({ tipo: "exercicio", melhorNota: 40, tentativas: 5 }), true);
});
caso("gabarito só aparece depois de responder", () => {
  const t = quizParaTela({ perguntas: [{ pergunta: "p", opcoes: ["a", "b", "c", "d"], correta: 1, explicacao: "e" }, { pergunta: "q", opcoes: ["a", "b", "c", "d"], correta: 3, explicacao: "f" }] }, { escolhas: { 0: 2 } });
  assert.deepEqual([t[0].correta, t[0].escolha, t[1].correta, t[1].explicacao], [1, 2, null, null]);
});
caso("aprovação sai da nota, não do que a IA disse", () => {
  assert.equal(validarAvaliacao({ nota: 40, aprovado: true }).aprovado, false);
  assert.equal(validarAvaliacao({ nota: "75" }).aprovado, true);
});
caso("assunto atual: atrasado primeiro; trilha acabada devolve o último", () => {
  assert.equal(assuntoAtual(etapas.map((e) => ({ ...e, cardId: `c${e.ordem}` })), hoje).cardId, "c1");
  assert.equal(assuntoAtual([{ cardId: "x", ordem: 1, concluido: true }, { cardId: "y", ordem: 2, concluido: true }], hoje).cardId, "y");
});
caso("mapa: unidades por semana, baú da semana, troféu na virada do mês, chegada", () => {
  const nos = mapaDaTrilha({
    hoje: "2026-10-07",
    base: "2026-09-28",
    etapas: [
      { cardId: "a", ordem: 1, semana: 1, inicio: "2026-09-29", fim: "2026-09-29", concluido: true },
      { cardId: "b", ordem: 2, semana: 2, inicio: "2026-10-06", fim: "2026-10-08", concluido: false },
      { cardId: "c", ordem: 3, semana: 3, inicio: "2026-10-13", fim: "2026-10-13", concluido: false },
    ],
    desafios: [{ tipo: "projeto_semanal", periodo: "2026-09-28", status: "concluido", nota: 90 }],
  });
  // A semana 28/09–04/10 termina em outubro: conta para outubro, e setembro não ganha troféu.
  assert.deepEqual(nos.map((n) => `${n.tipo}:${n.estado || ""}`), [
    "unidade:", "assunto:feito", "projeto_semanal:feito",
    "unidade:", "assunto:atual", "projeto_semanal:disponivel",
    "unidade:", "assunto:bloqueado", "projeto_semanal:bloqueado", "projeto_mensal:disponivel",
    "chegada:bloqueado",
  ]);
});

console.log("\nconquistas");
const eventosDeTeste = [
  { tipo: "item", chave: "item:1", dia: "2026-10-04", pontos: 10 },
  { tipo: "item", chave: "item:2", dia: "2026-10-05", pontos: 10 },
  { tipo: "meta_diaria", chave: "meta:2026-10-05", dia: "2026-10-05", pontos: 20 },
  { tipo: "quiz", chave: "pratica:q", dia: "2026-10-06", pontos: 35, detalhe: { acertos: 5, total: 5 } },
  { tipo: "exercicio", chave: "pratica:e", dia: "2026-10-06", pontos: 20, detalhe: { nota: 50 } },
  { tipo: "conquista", chave: "conquista:tarefas-1", dia: "2026-10-04", pontos: 10 },
  { tipo: "conquista", chave: "conquista:trilha:t1", dia: "2026-10-06", pontos: 300, detalhe: { nome: "Trilha concluída: JS" } },
];
caso("estatísticas saem dos eventos (exercício reprovado não conta)", () => {
  const s = estatisticas(eventosDeTeste, "2026-10-06");
  assert.deepEqual(
    [s.tarefas, s.metas, s.quizzes, s.quizzesPerfeitos, s.exercicios, s.trilhas, s.diasEstudados, s.ofensiva, s.maiorOfensiva],
    [2, 1, 1, 1, 0, 1, 3, 3, 3]
  );
});
caso("só desbloqueia o que alcançou e ainda não tem", () => {
  const s = estatisticas(eventosDeTeste, "2026-10-06");
  const novas = conquistasNovas(s, desbloqueadasDe(eventosDeTeste)).map((x) => x.codigo);
  assert.deepEqual(novas.sort(), ["meta-1", "ofensiva-3", "quiz-1", "quiz-perfeito-1"].sort());
});
caso("vitrine traz o progresso e as trilhas concluídas", () => {
  const v = vitrine(estatisticas(eventosDeTeste, "2026-10-06"), eventosDeTeste);
  const sete = v.find((x) => x.codigo === "ofensiva-7");
  assert.deepEqual([sete.atual, sete.alvo, sete.desbloqueada], [3, 7, false]);
  assert.ok(v.some((x) => x.codigo === "trilha:t1" && x.desbloqueada));
});

console.log("\ncurso criado pela Lisa");
caso("quantos assuntos cabem na duração", () => {
  assert.equal(assuntosParaODuracao(4, 5), 13);
  assert.equal(assuntosParaODuracao(12, 7), 40); // teto
  assert.equal(assuntosParaODuracao(1, 1), 4);   // piso
});
caso("nome do quadro sempre começa com STUDY, sem duplicar o prefixo", () => {
  assert.equal(nomeDoQuadro("STUDY: SQL para dados", "SQL"), "STUDY SQL para dados");
  assert.equal(nomeDoQuadro("", "React"), "STUDY React");
  assert.ok(ehQuadroDeEstudo(nomeDoQuadro("Java do zero", "Java")));
});
caso("proposta: corrige dias e nível, descarta vazio, renomeia módulo repetido", () => {
  const r = validarCurso({
    tema: "JavaScript", nivel: "nivel-inventado",
    modulos: [
      { nome: "Base", assuntos: [{ titulo: "Variáveis", dias: 9, nivel: "x", tarefas: ["ler", "", "fazer"] }, { titulo: "" }] },
      { nome: "Vazio", assuntos: [] },
      { nome: "base", assuntos: [{ titulo: "Funções", dias: 2 }, { titulo: "Arrays" }] },
    ],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.proposta.modulos.map((m) => m.nome), ["Base", "base (2)"]);
  assert.deepEqual([r.proposta.modulos[0].assuntos[0].dias, r.proposta.modulos[0].assuntos[0].nivel], [5, "basico"]);
  assert.deepEqual(r.proposta.modulos[0].assuntos[0].tarefas, ["ler", "fazer"]);
  assert.equal(r.proposta.nivel, "iniciante");
  assert.deepEqual(resumoDoCurso(r.proposta), { modulos: 2, assuntos: 3, tarefas: 2, dias: 8 });
});
caso("proposta com quase nada é recusada", () => {
  const r = validarCurso({ tema: "X", modulos: [{ nome: "A", assuntos: [{ titulo: "um" }] }] });
  assert.equal(r.ok, false);
});
caso("teto de 40 assuntos", () => {
  const muitos = Array.from({ length: 60 }, (_, i) => ({ titulo: `a${i}` }));
  const r = validarCurso({ tema: "X", modulos: [{ nome: "A", assuntos: muitos }] });
  assert.equal(assuntosEmOrdem(r.proposta).length, 40);
});

console.log("\nagenda");
const agendaBase = {
  trilhas: [{ id: "t", tema: "JS" }],
  etapas: new Map([["t", [
    { cardId: "a", titulo: "Antigo atrasado", inicio: "2026-09-21", fim: "2026-09-22", concluido: false },
    { cardId: "b", titulo: "De três dias", inicio: "2026-10-06", fim: "2026-10-08", concluido: false },
    { cardId: "c", titulo: "Feito", inicio: "2026-10-05", fim: "2026-10-05", concluido: true },
  ]]]),
  desafios: [
    { id: "q1", trilhaId: "t", tipo: "quiz", periodo: "2026-10-05", status: "concluido", nota: 80 },
    { id: "p1", trilhaId: "t", tipo: "projeto_semanal", periodo: "2026-09-21", status: "concluido", nota: 90 },
  ],
  hoje: "2026-10-07",
};
caso("agenda: atrasado de fora do período entra; assunto de 3 dias aparece em cada dia", () => {
  const itens = montarAgenda({ ...agendaBase, de: "2026-10-05", ate: "2026-10-11" });
  assert.ok(itens.some((x) => x.chave === "a-a" && x.situacao === "atrasado"));
  for (const d of ["2026-10-06", "2026-10-07", "2026-10-08"]) assert.ok(itensDoDia(itens, d).some((x) => x.chave === "a-b"), d);
  assert.ok(!itensDoDia(itens, "2026-10-09").some((x) => x.chave === "a-b"));
});
caso("agenda: projeto aparece só no dia da entrega, com a situação certa", () => {
  const itens = montarAgenda({ ...agendaBase, de: "2026-09-21", ate: "2026-10-11" });
  const semanais = itens.filter((x) => x.tipo === "projeto_semanal");
  assert.deepEqual(semanais.map((x) => [x.fim, x.situacao]), [
    ["2026-09-27", "feito"], ["2026-10-04", "atrasado"], ["2026-10-11", "agora"],
  ]);
  assert.equal(itensDoDia(itens, "2026-10-10").filter((x) => x.tipo === "projeto_semanal").length, 0);
});
caso("agenda: quiz de hoje aparece mesmo antes de ser gerado; o de outro dia vem do desafio", () => {
  const itens = montarAgenda({ ...agendaBase, de: "2026-10-05", ate: "2026-10-11" });
  assert.ok(itensDoDia(itens, "2026-10-07").some((x) => x.tipo === "quiz" && x.situacao === "agora" && x.href === "/pratica"));
  assert.ok(itensDoDia(itens, "2026-10-05").some((x) => x.tipo === "quiz" && x.situacao === "feito"));
});
caso("agenda: o mais urgente primeiro no dia", () => {
  const itens = montarAgenda({ ...agendaBase, de: "2026-10-05", ate: "2026-10-11" });
  assert.equal(itensDoDia(itens, "2026-10-07")[0].situacao, "agora");
});
caso("grade do mês vai de segunda a domingo", () => {
  const g = gradeDoMes("2026-10-15");
  assert.deepEqual([g.de, g.ate, g.dias.length], ["2026-09-28", "2026-11-01", 35]);
  assert.equal(mesVizinho("2026-12-10", 1), "2027-01-01");
  assert.equal(mesVizinho("2026-01-10", -1), "2025-12-01");
});

caso("chamado: relato curto, longo demais ou print de tipo errado é recusado", () => {
  assert.equal(conferirChamado({ texto: "oi" }).ok, false);
  assert.equal(conferirChamado({ texto: "x".repeat(4001) }).ok, false);
  assert.equal(conferirChamado({ texto: "deu erro no quiz", imagem: { tipo: "image/gif", tamanho: 10 } }).ok, false);
  assert.equal(conferirChamado({ texto: "deu erro no quiz", imagem: { tipo: "image/jpeg", tamanho: 7 * 1024 * 1024 } }).ok, false);
  assert.equal(conferirChamado({ texto: "deu erro no quiz", imagem: { tipo: "image/jpeg", tamanho: 1000 } }).ok, true);
});
caso("chamado: a página vai sem parâmetros e só se for caminho do próprio app", () => {
  assert.equal(conferirChamado({ texto: "deu erro aqui", pagina: "/pratica/abc?token=123#x" }).pagina, "/pratica/abc");
  assert.equal(conferirChamado({ texto: "deu erro aqui", pagina: "https://outro.site/x" }).pagina, "");
});
caso("chamado: título curto da primeira frase e descrição com quem, onde e quando", () => {
  assert.equal(tituloDoChamado("A pergunta 5 veio sem código. O resto ok."), "🐞 A pergunta 5 veio sem código.");
  assert.ok(tituloDoChamado("x ".repeat(100)).length <= 84);
  const d = descricaoDoChamado({
    texto: "a pergunta 5 veio sem código", pagina: "/pratica/1",
    contexto: { navegador: "Edge", tela: "1600×1000", tema: "escuro", idioma: "pt-BR" },
    usuario: { nome: "Ana", email: "ana@exemplo.invalid" }, instante: new Date("2026-10-20T18:42:00Z"), versao: "0.3.0",
  });
  assert.ok(d.includes("Reportado por: Ana <ana@exemplo.invalid>"));
  assert.ok(d.includes("Quando: 20/10/2026 15:42 (Brasília)"));
  assert.ok(d.includes("Tela: /pratica/1") && d.includes("janela 1600×1000 · tema escuro · pt-BR") && d.endsWith("a pergunta 5 veio sem código"));
});

caso("raio-x: acertos do quiz pelo gabarito guardado", () => {
  const d = { conteudo: { perguntas: [{ correta: 1 }, { correta: 2 }, { correta: 0 }] }, resposta: { escolhas: { 0: 1, 1: 3 } } };
  assert.deepEqual(acertosDoQuiz(d), { total: 3, respondidas: 2, acertos: 1 });
});
caso("raio-x: hora em São Paulo, não em UTC", () => {
  assert.equal(horaEmSaoPaulo("2026-10-20T01:30:00Z"), 22);
});
caso("raio-x: pontos por origem, por trilha, constância e entregas pela melhor nota", () => {
  const eventos = [
    { tipo: "item", pontos: 10, dia: "2026-10-19", trilha_id: "t1", criado_em: "2026-10-19T13:00:00Z" },
    { tipo: "item", pontos: 10, dia: "2026-10-19", trilha_id: "t1", criado_em: "2026-10-19T13:05:00Z" },
    { tipo: "exercicio", pontos: 32, dia: "2026-10-20", trilha_id: "t1", criado_em: "2026-10-20T14:00:00Z", detalhe: { titulo: "Média" } },
    { tipo: "meta_diaria", pontos: 15, dia: "2026-10-20", trilha_id: null, criado_em: "2026-10-20T14:00:01Z" },
  ];
  const desafios = [
    { id: "e1", tipo: "exercicio", periodo: "2026-10-20", nota: 80, tentativas: 2, pontos: 32, trilha_id: "t1", titulo: "Média" },
    { id: "e2", tipo: "exercicio", periodo: "2026-10-21", nota: null, tentativas: 0, trilha_id: "t1" },
    { id: "q1", tipo: "quiz", periodo: "2026-10-20", trilha_id: "t1", conteudo: { perguntas: [{ correta: 0 }, { correta: 1 }] }, resposta: { escolhas: { 0: 0, 1: 1 } } },
  ];
  const trilhas = [{ id: "t1", tema: "Python", status: "ativa", inicio_em: "2026-10-01", etapas: [{ concluido: true }, { concluido: false }] }];
  const r = montarRaioX({ eventos, desafios, trilhas, metaDiaria: 30, hoje: "2026-10-20" });
  assert.equal(r.resumo.pontos, 67);
  assert.equal(r.resumo.diasEstudados, 2);
  assert.equal(r.resumo.constancia, 100);
  assert.equal(r.resumo.metasBatidas, 1);
  assert.deepEqual(r.porOrigem.map((o) => o.tipo), ["exercicio", "item", "meta_diaria"]);
  assert.equal(r.exercicios.feitos, 1); // o sem envio não conta
  assert.equal(r.exercicios.notaMedia, 80);
  assert.equal(r.quiz.gabaritos, 1);
  assert.equal(r.porTrilha[0].progresso, 50);
  assert.equal(r.porTrilha[0].pontos, 52);
  assert.equal(r.historico[0].tipo, "meta_diaria");
  assert.equal(r.semanas.length, 12);
  assert.equal(r.semanas.at(-1).pontos, 67);
});

// ---------------------------------------------------------------- rodadas extras (20/10/2026)
caso("rodadas: até 3 por dia, só depois de terminar a anterior, valendo metade", () => {
  assert.deepEqual(podeAbrirRodada("quiz", []), { ok: true, rodada: 1 });
  assert.equal(podeAbrirRodada("quiz", [{ rodada: 1, status: "pendente" }]).ok, false);
  assert.deepEqual(podeAbrirRodada("quiz", [{ rodada: 1, status: "concluido" }]), { ok: true, rodada: 2 });
  assert.deepEqual(podeAbrirRodada("exercicio", [{ rodada: 2, status: "concluido" }, { rodada: 1, status: "concluido" }]), { ok: true, rodada: 3 });
  assert.equal(podeAbrirRodada("quiz", [{ rodada: 3, status: "concluido" }]).ok, false);
  assert.equal(podeAbrirRodada("projeto_semanal", [{ rodada: 1, status: "concluido" }]).ok, false);
  assert.equal(RODADAS_POR_DIA.quiz, 3);
  assert.equal(TENTATIVAS.exercicio, 5);
  assert.equal(fatorDaRodada(1), 1);
  assert.equal(fatorDaRodada(2), 0.5);
  assert.equal(comFatorDaRodada(25, 1), 25);
  assert.equal(comFatorDaRodada(25, 3), 13);
});
caso("agenda: 3 rodadas do mesmo dia viram um item só, o concluído", () => {
  const r = montarAgenda({
    trilhas: [{ id: "t1", tema: "Python" }],
    etapas: new Map([["t1", [{ cardId: "c1", titulo: "A", inicio: "2026-10-20", fim: "2026-10-22", concluido: false }]]]),
    desafios: [
      { id: "d1", trilhaId: "t1", tipo: "quiz", periodo: "2026-10-20", rodada: 1, status: "concluido" },
      { id: "d2", trilhaId: "t1", tipo: "quiz", periodo: "2026-10-20", rodada: 2, status: "pendente" },
    ],
    hoje: "2026-10-20", de: "2026-10-20", ate: "2026-10-20",
  });
  const quizzes = r.filter((i) => i.tipo === "quiz");
  assert.equal(quizzes.length, 1);
  assert.equal(quizzes[0].situacao, "feito");
});

// ---------------------------------------------------------------- ranking
caso("ranking: nome público nunca é o nome completo", () => {
  assert.equal(nomePublico({ nome: "Marina Alves Souza" }), "Marina S.");
  assert.equal(nomePublico({ nome: "Rafael" }), "Rafael");
  assert.equal(nomePublico({ nome: "Marina Alves", apelido: "Dev Noturna" }), "Dev Noturna");
  assert.equal(nomePublico({ nome: "Marina Alves", apelido: "Dev Noturna", noRanking: false }), ANONIMO);
  assert.equal(nomePublico({ nome: "" }), ANONIMO);
});
caso("ranking: apelido sem e-mail, sem link, de 3 a 24", () => {
  assert.deepEqual(apelidoValido("  Dev   da Madrugada "), { ok: true, apelido: "Dev da Madrugada" });
  assert.deepEqual(apelidoValido(""), { ok: true, apelido: "" });
  assert.equal(apelidoValido("ab").ok, false);
  assert.equal(apelidoValido("x".repeat(25)).ok, false);
  assert.equal(apelidoValido("eu@empresa.com").ok, false);
  assert.equal(apelidoValido("www.meusite").ok, false);
  assert.equal(apelidoValido("<script>").ok, false);
});
caso("ranking: empate divide a posição e eu apareço mesmo fora do topo", () => {
  const linhas = [
    { usuarioId: "a", valor: 50 }, { usuarioId: "b", valor: 80 }, { usuarioId: "c", valor: 50 },
    { usuarioId: "d", valor: 10 }, { usuarioId: "z", valor: 0 }, { usuarioId: "eu", valor: 0 },
  ];
  const r = posicionar(linhas, "eu", 3);
  assert.deepEqual(r.topo.map((l) => l.posicao), [1, 2, 2]);
  assert.equal(r.total, 5); // quem tem zero fica de fora, menos eu
  assert.equal(r.eu.posicao, 5);
  assert.equal(r.eu.souEu, true);
});

// ---------------------------------------------------------------- Reino do Neuro
const reinoBase = (extra = {}) => ({
  usuario_id: "eu", neuro_nivel: 1, trofeus: 0, construcoes: { castelo: 1, mina: 1 }, coletado_em: "2026-10-20T00:00:00Z", ...extra,
});
caso("reino: nenhuma construção passa do nível da torre", () => {
  const r = reinoBase();
  assert.deepEqual(podeMelhorar(r, "cofre", 1000), { ok: true, custo: 80 });
  assert.equal(podeMelhorar(r, "mina", 1000).ok, false); // mina 1 → 2 pede torre 2
  assert.match(podeMelhorar(r, "mina", 1000).motivo, /Torre do Neuro para o nível 2/);
  assert.deepEqual(podeMelhorar(r, "castelo", 300), { ok: true, custo: 300 });
  assert.match(podeMelhorar(r, "castelo", 299).motivo, /faltam 1 moeda/);
  assert.equal(podeMelhorar(reinoBase({ construcoes: { castelo: 5 } }), "castelo", 99999).ok, false);
  assert.equal(podeMelhorar(r, "dragao", 99999).ok, false);
});
caso("reino: o Neuro vai até o dobro da torre e custa 100 × nível", () => {
  assert.deepEqual(podeSubirNeuro(reinoBase(), 100), { ok: true, custo: 100 });
  assert.equal(podeSubirNeuro(reinoBase({ neuro_nivel: 2 }), 1000).ok, false);
  assert.deepEqual(podeSubirNeuro(reinoBase({ neuro_nivel: 2, construcoes: { castelo: 2 } }), 200), { ok: true, custo: 200 });
  assert.equal(estagioDoNeuro(1), "Filhote");
  assert.equal(estagioDoNeuro(3), "Aprendiz");
  assert.equal(estagioDoNeuro(10), "Lendário");
});
caso("reino: força sai das construções e do Neuro", () => {
  assert.deepEqual(poderDo(reinoBase()), { ataque: 18, defesa: 16 });
  assert.deepEqual(poderDo(reinoBase({ neuro_nivel: 3, construcoes: { castelo: 3, quartel: 2, muralha: 1, torre: 3 } })), { ataque: 62, defesa: 70 });
});
caso("reino: a mina produz por hora e para quando enche", () => {
  const r = reinoBase({ construcoes: { castelo: 2, mina: 2 }, coletado_em: "2026-10-20T00:00:00Z" });
  assert.equal(producaoAcumulada(r, new Date("2026-10-20T03:30:00Z")), 7);
  assert.equal(producaoAcumulada(r, new Date("2026-10-22T00:00:00Z")), 24); // teto: 2/h × 12 h
  assert.equal(producaoAcumulada(r, new Date("2026-10-19T00:00:00Z")), 0);
});
caso("reino: invasão — limites do dia, por alvo, escudo e o próprio reino", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  const alvo = reinoBase({ usuario_id: "outro" });
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: alvo, ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, true);
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: alvo, ataquesHoje: ATAQUES_POR_DIA, jaAtacouHoje: false, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: alvo, ataquesHoje: 1, jaAtacouHoje: true, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: { ...alvo, escudo_ate: "2026-10-20T13:00:00Z" }, ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: { ...alvo, escudo_ate: "2026-10-20T11:00:00Z" }, ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, true);
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: reinoBase(), ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", defensor: null, ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, false);
});
caso("reino: batalha — sorte de ±15%, empate é da defesa, saque com cofre e teto", () => {
  const forte = reinoBase({ neuro_nivel: 4, construcoes: { castelo: 3, quartel: 3 } }); // ataque 10+42+32 = 84
  const fraco = reinoBase({ usuario_id: "outro", construcoes: { castelo: 1, cofre: 1 } }); // defesa 16, cofre 150
  const v = batalha({ atacante: forte, defensor: fraco, saldoDoDefensor: 1150, sorteA: 0, sorteD: 0.999 });
  assert.equal(v.venceu, true);
  assert.equal(v.ataque, Math.round(84 * 0.85));
  assert.equal(v.protegido, 150);
  assert.equal(v.saque, 150); // 15% de 1000 expostos
  assert.equal(v.trofeusAtacante, TROFEUS.vitoriaAtacante);
  assert.equal(v.escudoDoDefensorHoras, 8);
  assert.equal(batalha({ atacante: forte, defensor: fraco, saldoDoDefensor: 99999, sorteA: 0.5, sorteD: 0.5 }).saque, TETO_DO_SAQUE);
  assert.equal(batalha({ atacante: forte, defensor: fraco, saldoDoDefensor: 100, sorteA: 0.5, sorteD: 0.5 }).saque, 0); // tudo no cofre
  // defesa maior com a mesma sorte: a defesa segura
  const segura = batalha({ atacante: reinoBase(), defensor: reinoBase({ usuario_id: "outro", neuro_nivel: 2 }), saldoDoDefensor: 0, sorteA: 0.5, sorteD: 0.5 });
  assert.equal(segura.ataque, 18);
  assert.equal(segura.defesa, 22);
  assert.equal(segura.venceu, false);
  assert.equal(segura.trofeusDefensor, TROFEUS.defesaVencida);
  assert.equal(segura.escudoDoDefensorHoras, 0);
  // empate exato: a defesa vence
  const atacante = reinoBase({ construcoes: { castelo: 1, quartel: 0 } }); // ataque 18
  const defensor = reinoBase({ usuario_id: "outro", construcoes: { castelo: 1 } }); // defesa 16
  const empate = batalha({ atacante, defensor, saldoDoDefensor: 0, sorteA: 0, sorteD: 0.5 + (18 * 0.85 / 16 - 1) / 0.3 });
  assert.equal(empate.ataque, empate.defesa);
  assert.equal(empate.venceu, false);
});
caso("reino: saldo = pontos + livro-caixa, e troféus nunca negativos", () => {
  assert.equal(saldoDe({ pontosDeEstudo: 500, movimentos: [{ valor: -300 }, { valor: 24 }, { valor: -50 }] }), 174);
  assert.equal(saldoDe({ pontosDeEstudo: 0, movimentos: [] }), 0);
  assert.equal(somarTrofeus(2, -5), 0);
  assert.equal(somarTrofeus(10, 10), 20);
  assert.equal(faixaDeDefesa(16), "fraca");
  assert.equal(faixaDeDefesa(150), "fortíssima");
});

// ---------------------------------------------------------------- modo simulação
caso("simulação: rival tirado do meu reino, um nível abaixo ou acima", () => {
  const base = { construcoes: { castelo: 2, quartel: 2, muralha: 1, torre: 0, cofre: 1 }, neuro_nivel: 3 };
  const fraco = rivalSimulado(base, "fraco");
  assert.deepEqual([fraco.construcoes.quartel, fraco.construcoes.muralha, fraco.construcoes.torre, fraco.construcoes.cofre, fraco.neuro_nivel], [1, 0, 0, 0, 1]);
  const forte = rivalSimulado(base, "forte");
  assert.deepEqual([forte.construcoes.quartel, forte.construcoes.muralha, forte.construcoes.torre, forte.construcoes.cofre, forte.neuro_nivel], [3, 2, 1, 2, 5]);
  assert.deepEqual(rivalSimulado(base, "parelho").construcoes, { ...base.construcoes, mina: 1 }); // a mina já nasce no nível 1
  const teto = rivalSimulado({ construcoes: { quartel: 5 }, neuro_nivel: 10 }, "forte");
  assert.equal(teto.construcoes.quartel, 5);
  assert.equal(teto.neuro_nivel, 10);
});
caso("simulação: chance de vitória sai da mesma batalha de verdade", () => {
  const forte = { construcoes: { quartel: 5 }, neuro_nivel: 10 };
  const fraco = { construcoes: {}, neuro_nivel: 1 };
  let i = 0;
  const sequencia = () => [0.1, 0.9, 0.5, 0.3][i++ % 4];
  assert.equal(chanceDeVitoria(forte, fraco, 100, sequencia), 100);
  assert.equal(chanceDeVitoria(fraco, forte, 100, sequencia), 0);
  assert.equal(fatorDaSorte(0), 0.85);
  assert.equal(fatorDaSorte(0.5), 1);
});
caso("simulação: o passo a passo do lado de quem joga", () => {
  const forte = { construcoes: { castelo: 3, quartel: 3 }, neuro_nivel: 4 };
  const fraco = { construcoes: { castelo: 1 }, neuro_nivel: 1 };
  const atk = simularBatalha({ tipo: "atacar", eu: forte, rival: fraco, meuSaldo: 50, saldoDoRival: 500, sorteA: 0.5, sorteD: 0.5 });
  assert.equal(atk.euVenci, true);
  assert.equal(atk.minhasMoedas, 75); // 15% de 500, rival sem cofre
  assert.equal(atk.meusTrofeus, TROFEUS.vitoriaAtacante);
  assert.equal(atk.saldoDoDefensor, 500);
  const def = simularBatalha({ tipo: "defender", eu: fraco, rival: forte, meuSaldo: 1000, saldoDoRival: 500, sorteA: 0.5, sorteD: 0.5 });
  assert.equal(def.euVenci, false);
  assert.equal(def.minhasMoedas, -150); // o MEU saldo é que conta na defesa
  assert.equal(def.meusTrofeus, TROFEUS.derrotaDefensor);
  assert.equal(def.poderAtacante.ataque, 84);
  const segura = simularBatalha({ tipo: "defender", eu: forte, rival: fraco, meuSaldo: 1000, sorteA: 0.5, sorteD: 0.5 });
  assert.equal(segura.euVenci, true);
  assert.equal(segura.minhasMoedas, 0);
  assert.equal(segura.meusTrofeus, TROFEUS.defesaVencida);
});

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
