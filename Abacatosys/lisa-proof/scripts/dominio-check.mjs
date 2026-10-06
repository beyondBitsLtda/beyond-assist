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

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
