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
  perguntaRepetida, perguntasNovas, exercicioRepetido,
} from "../src/dominio/pratica.js";
import { PERSONAGENS, personagensDe, podeEscolherPersonagem } from "../src/dominio/personagens.js";
import { nomePublico, apelidoValido, posicionar, ANONIMO } from "../src/dominio/ranking.js";
import {
  podeMelhorar, podeSubirNeuro, producaoAcumulada, podeInvadir, batalha, saldoDe, somarTrofeus,
  faixaDeDefesa, estagioDoNeuro, ATAQUES_POR_DIA, TETO_DO_SAQUE, saqueDo, trofeusDoCombate,
  rivalSimulado, simularBatalha, exercitoDeTreino, previsaoDeEstrelas, combateDe, taxaDeProducao,
} from "../src/dominio/reino.js";
import { montarCombate, passo as passoDoCombate, resultadoDo, resolverCombate, raioDaIlha } from "../src/dominio/combate.js";
import {
  capacidadeDoExercito, capacidadeDaGuarnicao, podeTreinar, espacoUsado, somarTropas, contagens, totalDeTropas,
} from "../src/dominio/tropas.js";
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
  assert.deepEqual(podeMelhorar(r, "canhao", 1000), { ok: true, custo: 100 });
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
  assert.equal(estagioDoNeuro(10), "Lendário");
});
caso("reino: a mina produz por hora e para quando enche", () => {
  const r = reinoBase({ construcoes: { castelo: 2, mina: 2 }, coletado_em: "2026-10-20T00:00:00Z" });
  assert.equal(producaoAcumulada(r, new Date("2026-10-20T03:30:00Z")), 7);
  assert.equal(producaoAcumulada(r, new Date("2026-10-22T00:00:00Z")), 24);
});
caso("reino: invasão — sem exército não vai; limites do dia, alvo, escudo", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  const alvo = reinoBase({ usuario_id: "outro" });
  const comTropas = { exercito: { guerreiro: 5 } };
  assert.equal(podeInvadir({ atacanteId: "eu", atacante: comTropas, defensor: alvo, ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, true);
  assert.match(podeInvadir({ atacanteId: "eu", atacante: { exercito: {} }, defensor: alvo, ataquesHoje: 0, jaAtacouHoje: false, agora }).motivo, /treine tropas/);
  assert.equal(podeInvadir({ atacanteId: "eu", atacante: comTropas, defensor: alvo, ataquesHoje: ATAQUES_POR_DIA, jaAtacouHoje: false, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", atacante: comTropas, defensor: alvo, ataquesHoje: 1, jaAtacouHoje: true, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", atacante: comTropas, defensor: { ...alvo, escudo_ate: "2026-10-20T13:00:00Z" }, ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, false);
  assert.equal(podeInvadir({ atacanteId: "eu", atacante: comTropas, defensor: reinoBase(), ataquesHoje: 0, jaAtacouHoje: false, agora }).ok, false);
});
caso("reino: saldo = pontos + livro-caixa, e troféus nunca negativos", () => {
  assert.equal(saldoDe({ pontosDeEstudo: 500, movimentos: [{ valor: -300 }, { valor: 24 }, { valor: -50 }] }), 174);
  assert.equal(somarTrofeus(2, -5), 0);
  assert.equal(faixaDeDefesa(10), "fraca");
  assert.equal(faixaDeDefesa(200), "fortíssima");
});

// ---------------------------------------------------------------- tropas
caso("tropas: capacidade, liberação por nível e custo", () => {
  assert.equal(capacidadeDoExercito(0), 0);
  assert.equal(capacidadeDoExercito(2), 30);
  assert.equal(capacidadeDaGuarnicao(1), 8);
  const niveis = { quartel: 1, castelo: 1 };
  assert.deepEqual(podeTreinar({ tropa: "guerreiro", quantidade: 5, destino: "exercito", niveis, reservas: {}, saldo: 100 }), { ok: true, custo: 50, quantidade: 5 });
  assert.match(podeTreinar({ tropa: "gigante", quantidade: 1, destino: "exercito", niveis, reservas: {}, saldo: 999 }).motivo, /Quartel no nível 2/);
  assert.match(podeTreinar({ tropa: "guerreiro", quantidade: 1, destino: "exercito", niveis: { quartel: 0, castelo: 1 }, reservas: {}, saldo: 999 }).motivo, /construa o Quartel/);
  assert.match(podeTreinar({ tropa: "guerreiro", quantidade: 1, destino: "exercito", niveis, reservas: { exercito: { guerreiro: 20 } }, saldo: 999 }).motivo, /cheia/);
  assert.match(podeTreinar({ tropa: "arqueira", quantidade: 3, destino: "guarnicao", niveis, reservas: { guarnicao: { guerreiro: 6 } }, saldo: 999 }).motivo, /só cabe mais 2/);
  assert.match(podeTreinar({ tropa: "guerreiro", quantidade: 5, destino: "exercito", niveis, reservas: {}, saldo: 40 }).motivo, /faltam 10/);
  assert.equal(podeTreinar({ tropa: "tanque", quantidade: 1, destino: "exercito", niveis, reservas: {}, saldo: 999 }).ok, false);
  assert.equal(espacoUsado({ guerreiro: 3, gigante: 2, dragao: 1 }), 3 + 10 + 15);
  assert.deepEqual(somarTropas({ guerreiro: 3, arqueira: 2 }, { guerreiro: 3 }, -1), { arqueira: 2 });
  assert.deepEqual(contagens({ guerreiro: "4", inventado: 9, arqueira: -2 }), { guerreiro: 4 });
});

// ---------------------------------------------------------------- combate
const baseMedia = { castelo: 2, mina: 2, cofre: 1, quartel: 2, torre: 2, canhao: 1, muralha: 2 };
caso("combate: determinístico — mesma semente, mesma batalha; semente diferente pode mudar", () => {
  const entrada = { atacante: { exercito: { guerreiro: 12, arqueira: 8 }, neuro_nivel: 2 }, defensor: { construcoes: baseMedia, neuro_nivel: 2, guarnicao: { guerreiro: 3 } }, semente: 99 };
  assert.deepEqual(resolverCombate(entrada), resolverCombate(entrada));
  // passo a passo (como a tela faz) chega no mesmo resultado que de uma vez (como o servidor)
  const e = montarCombate(entrada);
  while (!e.fim) passoDoCombate(e);
  assert.deepEqual(resultadoDo(e), resolverCombate(entrada));
});
caso("combate: estrelas pela destruição — 50%, a Torre e 100%", () => {
  const novato = resolverCombate({ atacante: { exercito: { guerreiro: 10 }, neuro_nivel: 1 }, defensor: { construcoes: { castelo: 1, mina: 1 }, neuro_nivel: 1 }, semente: 1 });
  assert.equal(novato.estrelas, 3);
  assert.equal(novato.destruicao, 100);
  assert.equal(novato.casteloCaiu, true);
  const fraco = resolverCombate({ atacante: { exercito: { guerreiro: 20 }, neuro_nivel: 2 }, defensor: { construcoes: baseMedia, neuro_nivel: 3, guarnicao: { guerreiro: 4, arqueira: 4 } }, semente: 1 });
  assert.equal(fraco.estrelas, 0);
  assert.ok(fraco.destruicao < 50);
  const vazio = resolverCombate({ atacante: { exercito: {}, neuro_nivel: 5 }, defensor: { construcoes: baseMedia }, semente: 1 });
  assert.deepEqual([vazio.estrelas, vazio.destruicao], [0, 0]);
});
caso("combate: a muralha segura quem bate de perto; a guarnição sai e pode cair", () => {
  const e = montarCombate({ atacante: { exercito: { guerreiro: 30 }, neuro_nivel: 1 }, defensor: { construcoes: { castelo: 3, muralha: 3 }, neuro_nivel: 1, guarnicao: { guerreiro: 6 } }, semente: 3 });
  let saiu = false, muroAntesDaTorre = null;
  while (!e.fim) {
    for (const ev of passoDoCombate(e)) {
      if (ev.tipo === "guarnicao") saiu = true;
      if (ev.tipo === "destruido" && muroAntesDaTorre == null) muroAntesDaTorre = ev.id === "p-muralha";
    }
  }
  assert.equal(saiu, true);
  assert.equal(muroAntesDaTorre, true);
  assert.ok((resultadoDo(e).perdasDaGuarnicao.guerreiro || 0) > 0);
});
caso("combate: canhão não acerta quem voa; flecha acerta", () => {
  const soCanhao = montarCombate({ atacante: { exercito: { dragao: 1 }, neuro_nivel: 1 }, defensor: { construcoes: { castelo: 1, canhao: 5 }, neuro_nivel: 1 }, semente: 2 });
  let tirosDoCanhao = 0;
  while (!soCanhao.fim) for (const ev of passoDoCombate(soCanhao)) if (ev.tipo === "tiro" && ev.de === "p-canhao" && soCanhao.unidades.find((u) => u.id === ev.para)?.tipo === "dragao") tirosDoCanhao++;
  assert.equal(tirosDoCanhao, 0); // o dragão passa por cima do canhão
  assert.ok(soCanhao.predios.find((p) => p.chave === "canhao").vida < soCanhao.predios.find((p) => p.chave === "canhao").vidaMax);
  const comArqueiros = montarCombate({ atacante: { exercito: { dragao: 1 }, neuro_nivel: 1 }, defensor: { construcoes: { castelo: 1, torre: 5 }, neuro_nivel: 1 }, semente: 2 });
  let flechasNoDragao = 0;
  while (!comArqueiros.fim) for (const ev of passoDoCombate(comArqueiros)) if (ev.tipo === "tiro" && ev.de === "p-torre") flechasNoDragao++;
  assert.ok(flechasNoDragao > 0);
});
caso("batalha: saque segue a destruição, com cofre e teto; troféus pelas estrelas", () => {
  assert.deepEqual(saqueDo({ destruicao: 100, saldoDoDefensor: 1150, nivelDoCofre: 1 }), { protegido: 150, exposto: 1000, saque: 200 });
  assert.equal(saqueDo({ destruicao: 50, saldoDoDefensor: 1150, nivelDoCofre: 1 }).saque, 100);
  assert.equal(saqueDo({ destruicao: 100, saldoDoDefensor: 99999, nivelDoCofre: 0 }).saque, TETO_DO_SAQUE);
  assert.deepEqual(trofeusDoCombate(0), { atacante: -3, defensor: 5 });
  assert.deepEqual(trofeusDoCombate(3), { atacante: 14, defensor: -7 });
  const b = batalha({ atacante: { exercito: { guerreiro: 10 }, neuro_nivel: 1 }, defensor: reinoBase({ usuario_id: "outro" }), saldoDoDefensor: 600, semente: 5 });
  assert.equal(b.venceu, true);
  assert.equal(b.estrelas, 3);
  assert.equal(b.saque, 120); // 20% de 600, sem cofre
  assert.equal(b.escudoDoDefensorHoras, 8);
  assert.equal(b.entrada.semente, 5);
});

// ---------------------------------------------------------------- modo simulação
caso("simulação: rival tirado do meu reino, com exército e defesa", () => {
  const base = { construcoes: { castelo: 2, quartel: 2, muralha: 1, torre: 1, cofre: 1 }, neuro_nivel: 3 };
  const fraco = rivalSimulado(base, "fraco");
  assert.deepEqual([fraco.construcoes.quartel, fraco.construcoes.torre, fraco.construcoes.castelo, fraco.neuro_nivel], [1, 0, 1, 1]);
  const forte = rivalSimulado(base, "forte");
  assert.deepEqual([forte.construcoes.quartel, forte.construcoes.torre, forte.construcoes.canhao, forte.neuro_nivel], [3, 2, 1, 5]);
  assert.ok(espacoUsado(forte.exercito) <= capacidadeDoExercito(3));
  assert.ok(espacoUsado(forte.exercito) > espacoUsado(fraco.exercito));
  assert.ok(totalDeTropas(forte.guarnicao) > 0);
  assert.ok(espacoUsado(exercitoDeTreino(4)) <= capacidadeDoExercito(4));
  assert.equal(exercitoDeTreino(4).dragao, 1);
});
caso("simulação: do lado de quem joga — atacar e defender", () => {
  const meu = { construcoes: { castelo: 1, mina: 1, quartel: 1 }, neuro_nivel: 1, exercito: {}, guarnicao: {} };
  const rival = rivalSimulado(meu, "fraco");
  const atk = simularBatalha({ tipo: "atacar", eu: meu, rival, meuSaldo: 50, saldoDoRival: 500, semente: 7 });
  assert.equal(atk.exercitoDeTreino, true); // exército vazio: vai um de exemplo
  assert.equal(atk.minhasMoedas, atk.saque);
  const def = simularBatalha({ tipo: "defender", eu: meu, rival: rivalSimulado(meu, "forte"), meuSaldo: 1000, semente: 7 });
  assert.equal(def.saldoDoDefensor, 1000);
  assert.equal(def.euVenci, def.estrelas === 0);
  assert.equal(def.minhasMoedas, def.saque ? -def.saque : 0);
  const p = previsaoDeEstrelas(combateDe({ atacante: { exercito: { guerreiro: 10 } }, defensor: { construcoes: { castelo: 1 } } }), 4);
  assert.equal(p, 3);
});

// ---------------------------------------------------------------- terreno e construções novas (21/10/2026)
caso("terreno: a ilha cresce e libera construções novas", () => {
  const r = reinoBase({ construcoes: { castelo: 3, mina: 1 } });
  assert.match(podeMelhorar(r, "defesaAerea", 99999).motivo, /expansão 1 do Terreno/);
  assert.deepEqual(podeMelhorar(r, "terreno", 600), { ok: true, custo: 600 });
  assert.equal(podeMelhorar(reinoBase({ construcoes: { castelo: 1, terreno: 1 } }), "terreno", 99999).ok, false); // teto da torre
  const comTerra = reinoBase({ construcoes: { castelo: 3, terreno: 2 } });
  assert.equal(podeMelhorar(comTerra, "morteiro", 99999).ok, true);
  assert.match(podeMelhorar(comTerra, "torreRaio", 99999).motivo, /expansão 3/);
  assert.equal(raioDaIlha(0), 7);
  assert.equal(raioDaIlha(3), 10.6);
});
caso("biblioteca: produz junto com a mina", () => {
  assert.equal(taxaDeProducao({ mina: 2, biblioteca: 3 }), 8);
  const r = reinoBase({ construcoes: { castelo: 3, mina: 2, biblioteca: 3 }, coletado_em: "2026-10-20T00:00:00Z" });
  assert.equal(producaoAcumulada(r, new Date("2026-10-20T02:00:00Z")), 16);
  assert.equal(producaoAcumulada(r, new Date("2026-10-23T00:00:00Z")), 96); // teto: 8/h × 12 h
});
caso("tropas novas: liberação, guarnição só com quem defende", () => {
  const niveis = { quartel: 5, castelo: 5 };
  assert.equal(podeTreinar({ tropa: "curandeira", quantidade: 1, destino: "exercito", niveis, reservas: {}, saldo: 9999 }).ok, true);
  assert.match(podeTreinar({ tropa: "curandeira", quantidade: 1, destino: "guarnicao", niveis, reservas: {}, saldo: 9999 }).motivo, /não serve para defesa/);
  assert.match(podeTreinar({ tropa: "bombardeiro", quantidade: 1, destino: "exercito", niveis: { quartel: 2 }, reservas: {}, saldo: 9999 }).motivo, /nível 3/);
  assert.equal(podeTreinar({ tropa: "mago", quantidade: 1, destino: "guarnicao", niveis, reservas: {}, saldo: 9999 }).ok, true);
});
caso("combate: bombardeiro explode na muralha; curandeira cura", () => {
  const b = montarCombate({ atacante: { exercito: { bombardeiro: 2 }, neuro_nivel: 0 }, defensor: { construcoes: { castelo: 2, muralha: 2 } }, semente: 1 }); // sem o herói, só os bombardeiros batem
  let explosoes = 0;
  while (!b.fim) for (const ev of passoDoCombate(b)) if (ev.explodiu) explosoes++;
  assert.equal(explosoes, 2);
  assert.equal(b.muralha.vida, b.muralha.vidaMax - 2 * 30 * 12); // 12× contra a muralha
  const c = montarCombate({ atacante: { exercito: { guerreiro: 10, curandeira: 1 }, neuro_nivel: 1 }, defensor: { construcoes: { castelo: 1, torre: 3 } }, semente: 1 });
  let curas = 0;
  while (!c.fim) for (const ev of passoDoCombate(c)) if (ev.tipo === "cura") curas++;
  assert.ok(curas > 0);
  // só curandeira não segura a batalha aberta
  const so = resolverCombate({ atacante: { exercito: { curandeira: 1 }, neuro_nivel: 0 }, defensor: { construcoes: { castelo: 1 } }, semente: 1 });
  assert.ok(so.duracao < 1);
});
caso("combate: defesa aérea só no ar, morteiro tem alcance mínimo e dano em área", () => {
  const aerea = montarCombate({ atacante: { exercito: { guerreiro: 4, balao: 2 }, neuro_nivel: 1 }, defensor: { construcoes: { castelo: 2, terreno: 1, defesaAerea: 2 } }, semente: 1 });
  const voam = new Set();
  let tirosNoChao = 0, tirosNoAr = 0;
  while (!aerea.fim) {
    for (const u of aerea.unidades) if (u.voa) voam.add(u.id);
    for (const ev of passoDoCombate(aerea)) if (ev.tipo === "tiro" && ev.de === "p-defesaAerea") (voam.has(ev.para) ? tirosNoAr++ : tirosNoChao++);
  }
  assert.ok(tirosNoAr > 0);
  assert.equal(tirosNoChao, 0);
  const mort = montarCombate({ atacante: { exercito: { guerreiro: 12 }, neuro_nivel: 0 }, defensor: { construcoes: { castelo: 3, terreno: 2, morteiro: 3 } }, semente: 2 });
  const morteiro = mort.predios.find((p) => p.chave === "morteiro");
  let perto = 0, atingidosNumTiro = 0;
  while (!mort.fim) {
    const vidas = new Map(mort.unidades.map((u) => [u.id, u.vida]));
    const ev = passoDoCombate(mort);
    for (const x of ev) {
      if (x.tipo !== "tiro" || x.de !== "p-morteiro") continue;
      const alvo = mort.unidades.find((u) => u.id === x.para);
      if (Math.sqrt((alvo.x - morteiro.x) ** 2 + (alvo.z - morteiro.z) ** 2) < 1.6) perto++;
      atingidosNumTiro = Math.max(atingidosNumTiro, mort.unidades.filter((u) => vidas.has(u.id) && u.vida < vidas.get(u.id)).length);
    }
  }
  assert.equal(perto, 0);
  assert.ok(atingidosNumTiro >= 2); // pegou mais de um de uma vez
});
caso("combate: ilha maior estica o desembarque até a beirada nova", () => {
  const pequena = montarCombate({ atacante: { exercito: { guerreiro: 1 } }, defensor: { construcoes: { castelo: 1 } }, semente: 1 });
  const grande = montarCombate({ atacante: { exercito: { guerreiro: 1 } }, defensor: { construcoes: { castelo: 3, terreno: 3 } }, semente: 1 });
  assert.equal(pequena.entradas[0].ponto[0], 6.525);
  assert.ok(grande.entradas[0].ponto[0] > 9.5);
});
caso("simulação: rival sem Terreno não ganha construção da terra nova", () => {
  const base = { construcoes: { castelo: 3, terreno: 1, defesaAerea: 1, morteiro: 0 }, neuro_nivel: 3 };
  const forte = rivalSimulado(base, "forte");
  assert.equal(forte.construcoes.terreno, 2);
  assert.equal(forte.construcoes.morteiro, 1);
  const fraco = rivalSimulado(base, "fraco");
  assert.equal(fraco.construcoes.terreno, 0);
  assert.equal(fraco.construcoes.defesaAerea, 0);
});


// ---------------------------------------------------------------- chamados de 20/10/2026
// as perguntas reais do chamado: a rodada 2 reformulava a 1, e a rodada 3 saiu IGUAL à 2
const rodada1 = [
  "Quem é considerado o criador da linguagem de programação C?",
  "Qual é a principal função do compilador GCC no desenvolvimento em C?",
  "Qual das seguintes etapas NÃO faz parte do ciclo padrão de execução de um programa em C?",
  "Analise o código abaixo. Qual é a função da biblioteca #include <stdio.h>?",
  "Observe o bloco de código C abaixo. O que será impresso no terminal após a compilação e execução?",
].map((pergunta) => ({ pergunta }));
const rodada2 = [
  "Em que década a linguagem C foi desenvolvida por Dennis Ritchie nos laboratórios da Bell?",
  "Qual é a principal função do compilador GCC no desenvolvimento em C?",
  "Qual das seguintes etapas NÃO faz parte do ciclo padrão de compilação e execução de um programa em C?",
  "Analise o código abaixo. Qual é o papel principal da biblioteca incluída na primeira linha?",
  "Observe o bloco de código C abaixo. O que será impresso no terminal após a execução?",
].map((pergunta) => ({ pergunta }));
caso("quiz do dia: rodada copiada ou reformulada é barrada; pergunta nova passa", () => {
  assert.equal(perguntasNovas(rodada2, [...rodada1, ...rodada2]).length, 0); // a rodada 3 do chamado
  assert.equal(perguntaRepetida(rodada2[1], rodada1[1]), true);              // idêntica
  assert.equal(perguntaRepetida(rodada2[2], rodada1[2]), true);              // só trocou palavras
  const codigo = '#include <stdio.h>\nint main() {\n  printf("Ola");\n  return 0;\n}';
  assert.equal(perguntaRepetida({ ...rodada1[3], codigo }, { ...rodada2[3], codigo }), true); // mesmo código
  const novas = [
    "Qual a diferença entre usar %d e %f dentro de um printf?",
    "O que acontece se você esquecer o ponto e vírgula no fim de uma instrução em C?",
    "Para que serve o comando return 0 no final da função main?",
  ].map((pergunta) => ({ pergunta }));
  assert.equal(perguntasNovas(novas, [...rodada1, ...rodada2]).length, 3);
  // e dentro do mesmo quiz também não repete
  assert.equal(perguntasNovas([novas[0], novas[0], novas[1]]).length, 2);
});
caso("exercício do dia: o mesmo exercício de novo é barrado", () => {
  const antes = [{ titulo: "Calculadora de média", enunciado: "Escreva uma função que recebe três notas e devolve a média." }];
  assert.equal(exercicioRepetido({ titulo: "Calculadora de média", enunciado: "Escreva uma função que recebe três notas e devolve a média aritmética." }, antes), true);
  assert.equal(exercicioRepetido({ titulo: "Contador de vogais", enunciado: "Conte quantas vogais existem numa palavra digitada." }, antes), false);
});
caso("personagens: o Clássico é de todos; comprar cobra, vestir o que já tem é de graça", () => {
  assert.equal(Object.keys(PERSONAGENS).length, 6);
  assert.deepEqual(personagensDe([]), ["neuro"]);
  assert.deepEqual(personagensDe(["ninja", "inventado", "ninja"]), ["neuro", "ninja"]);
  assert.deepEqual(podeEscolherPersonagem({ id: "ninja", possui: [], saldo: 300 }), { ok: true, compra: true, custo: 300 });
  assert.match(podeEscolherPersonagem({ id: "robo", possui: [], saldo: 100 }).motivo, /faltam 1900/);
  assert.deepEqual(podeEscolherPersonagem({ id: "ninja", possui: ["ninja"], saldo: 0 }), { ok: true, compra: false, custo: 0 });
  assert.deepEqual(podeEscolherPersonagem({ id: "neuro", possui: [], saldo: 0 }), { ok: true, compra: false, custo: 0 });
  assert.equal(podeEscolherPersonagem({ id: "dragao", possui: [], saldo: 9999 }).ok, false);
});

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
