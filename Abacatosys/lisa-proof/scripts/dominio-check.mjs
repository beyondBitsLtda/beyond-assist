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
  validarAvaliacao, assuntoAtual, mapaDaTrilha,
} from "../src/dominio/pratica.js";
import { estatisticas, conquistasNovas, desbloqueadasDe, vitrine } from "../src/dominio/conquistas.js";
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

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
