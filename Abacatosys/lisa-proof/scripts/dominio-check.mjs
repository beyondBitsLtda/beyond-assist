// Testa as regras puras da Lisa_Proof: datas, ofensiva, plano da trilha e metas.
// Uso:  npm run dominio-check

import assert from "node:assert/strict";
import fs from "node:fs";
import { diaDe, somarDias, diaDaSemana, inicioDaSemana, fimDoMes, diaValido, formatarDia } from "../src/dominio/datas.js";
import { calcularOfensiva } from "../src/dominio/ofensiva.js";
import { ehQuadroDeEstudo, temaDo } from "../src/dominio/estudo.js";
import {
  validarPlano, planoPadrao, agendar, montarEtapas, planoDoReplanejamento,
  normalizarDiasDeEstudo, diasEstimados,
} from "../src/dominio/plano.js";
import { resumoDasMetas, tarefasDoDia } from "../src/dominio/metas.js";
import { nivelPorPontos, MULTIPLICADOR_DE_RECOMPENSAS, PONTOS } from "../src/dominio/pontos.js";
import {
  periodoDe, periodoPermitido, pontosDoQuiz, pontosDaNota, validarQuiz, quizParaTela,
  separarCodigoDaPergunta, perguntaPedeCodigo, textoDeCodigo, podeReenviar, entregaConcluida,
  validarAvaliacao, assuntoAtual, TENTATIVAS, RODADAS_POR_DIA, podeAbrirRodada, fatorDaRodada, comFatorDaRodada,
  perguntaRepetida, perguntasNovas, exercicioRepetido, validarGuia,
  tabelaDePontos, cumpridosNaAvaliacao, juntarCumpridos, pontosDoProjeto, projetoCompleto, podeTrocarComplexidade,
  validarProjeto, podeTrocarProjeto, projetoAntigo, TROCAS_DE_PROJETO,
} from "../src/dominio/pratica.js";
import { execucaoDoExercicio, prepararParaCompilador, resultadoDoServidor } from "../src/dominio/execucao.js";
import { PERSONAGENS, ORDEM_DOS_PERSONAGENS, ORDEM_DOS_CHEFOES, personagensDe, podeEscolherPersonagem } from "../src/dominio/personagens.js";
import { nomePublico, apelidoValido, posicionar, ANONIMO } from "../src/dominio/ranking.js";
import {
  podeMelhorar, podeSubirNeuro, producaoAcumulada, podeInvadir, batalha, saldoDe, somarTrofeus,
  faixaDeDefesa, estagioDoNeuro, ATAQUES_POR_DIA, TETO_DO_SAQUE, saqueDo, trofeusDoCombate,
  rivalSimulado, simularBatalha, exercitoDeTreino, previsaoDeEstrelas, combateDe, taxaDeProducao, guarnicaoDeTreino,
  proximoAtaqueAoReino, esperaAte, HORAS_ENTRE_ATAQUES_AO_MESMO_REINO, batalhaDeExpedicao, CONSTRUCOES, exercitoDaExpedicao, caidasNoAtaque,
  NIVEIS_INICIAIS, producaoPorHora, ORDEM_DAS_CONSTRUCOES, poderDo,
} from "../src/dominio/reino.js";
import {
  RIVAIS_DE_TESTE, FERRAMENTAS_DE_TESTE, reinoDoRival, reinoLiberado, reinoNovoDeTeste, urlNoMundo, ehRivalDeTeste,
} from "../src/dominio/mundoDeTeste.js";
import {
  DIAS_DE_PAZ, termosDaPaz, pazVigente, votacaoAberta, podeProporPaz, podeVotar, resultadoDaVotacao, periodoDaPaz,
  OFENSIVA_PARA_VOTAR, podeVotarComOfensiva, eleitoresDaVotacao,
  fatorDaMinaNaPaz, parteDaExpedicao,
} from "../src/dominio/paz.js";
import {
  VEICULOS, veiculosDe, podeComprarVeiculo, precoDaCarga, tanqueDoDia, podeAbastecer, CARGAS_POR_DIA, EXTRAS_POR_DIA,
  ORDEM_DOS_VEICULOS,
} from "../src/dominio/veiculos.js";
import {
  planetoideDa, sementeDoPlanetoide, ORDEM_DAS_RACAS, FORCA_MINIMA, FORCA_MAXIMA, RECOMPENSA_MINIMA, RECOMPENSA_MAXIMA,
} from "../src/dominio/planetoides.js";
import {
  OPERARIOS_INICIAIS, vagasDaMina, ouroAcumulado, horasTrabalhadas, equipeDeAgora, precoDoOperario, podeComprarOperario,
  podeOfertar, podeAlugar, periodoDoAluguel, moedasPorOperarioPorDia,
  diamantesEntre, chanceDeDiamante, sementeDaMina, VALOR_DO_DIAMANTE, VALOR_DA_PEPITA,
} from "../src/dominio/ouro.js";
import {
  precoDepois, variacaoReal, corretagem, podeComprarAcao, podeVenderAcao, posicaoDepois, resumoDaCarteira, validarPregao,
  pregaoDeReserva, saidasDaBolsa, PRECO_MINIMO, PRECO_INICIAL, VARIACAO_MAXIMA, SETORES, NOVAS_POR_DIA, ACOES_DO_PRIMEIRO_DIA,
  MAXIMO_DE_ACOES, MAXIMO_POR_ORDEM, caminhoDoDia, velaDe, sementeDaAcao, PASSOS_DO_DIA, valorDaCompra, valorDaVenda,
  ABRE_AS, FECHA_AS, pregaoAberto, passosAte, precoNaHora, horaDoPasso, proximaVirada,
} from "../src/dominio/bolsa.js";
import { CONSULTORES, IDS_DOS_CONSULTORES, consultorPorId } from "../src/dominio/consultores.js";
import { projetar, humorDoDia, avaliar, relatorioDaMesa, notaPeloErro, pctDaFala, rumoDaFala } from "../src/dominio/projecoes.js";
import { svgDoConsultor } from "../src/componentes/bolsa/consultoresDePapel.js";
import { centavos, formatarMoedas, faltam } from "../src/dominio/moedas.js";
import {
  semanasDoPlano, avancoDaTrilha, mapaDaTrilha, valorDoProjetoFinal, podeGerarProjeto, semanaDoProjeto, periodoDaSemana, PROJETOS_POR_SEMANA,
  semanaDoDesafio, pedidoDoProjeto, projetosOpcionais,
} from "../src/dominio/avanco.js";
import {
  MONSTROS, EXPEDICOES, EXPEDICOES_POR_DIA, podeExpedicionar, saqueDaExpedicao, defensorDaExpedicao, expedicaoPorId, contagensDeMonstros,
  veiculoDa,
} from "../src/dominio/monstros.js";
import { montarCombate, passo as passoDoCombate, resultadoDo, resolverCombate, raioDaIlha } from "../src/dominio/combate.js";
import {
  capacidadeDoExercito, capacidadeDaGuarnicao, podeTreinar, espacoUsado, somarTropas, contagens, totalDeTropas, lotacaoDoAcampamento,
} from "../src/dominio/tropas.js";
import { estatisticas, conquistasNovas, desbloqueadasDe, vitrine } from "../src/dominio/conquistas.js";
import { conferirChamado, tituloDoChamado, descricaoDoChamado } from "../src/dominio/chamado.js";
import { montarRaioX, acertosDoQuiz, horaEmSaoPaulo } from "../src/dominio/raioX.js";
import { assuntosParaODuracao, nomeDoQuadro, validarCurso, assuntosEmOrdem, resumoDoCurso } from "../src/dominio/curso.js";
import { montarAgenda, itensDoDia, gradeDoMes, mesVizinho } from "../src/dominio/agenda.js";
import {
  MIN_ANDARES, NOTA_PARA_VENCER, CHEFOES, CHEFOES_FINAIS, ATRIBUTOS, andaresPermitidos, andaresEscolhidos, dificuldadeEsperada,
  chefoesDaTorre, nomeDoChefao, sementeDe, pontosDoAndar, pontosDoTopo, atributosDoNeuro, roteiroDaLuta, marcosDaTorre,
  premiosDaTorre, premiosDoAndar, premiosDoMarco, encaixarTropas, veiculoDoPremio, valorDasTropas, MOEDAS_NO_LUGAR, blocosDaTorre,
  assuntosDoBloco, mediaDasNotas, branchSugerida, branchValida, codigoDoCertificado, codigoValido, validarAnalise,
  validarTorre, validarDesafio, validarAvaliacaoDoAndar, personagemDoChefao, chefaoDoPersonagem, dificuldadeSempreSobe,
} from "../src/dominio/modoDominio.js";
import { lerEnderecoDoRepo, linkDoCommit } from "../src/dominio/enderecoDoRepo.js";
import { pdfDeJpeg } from "../src/dominio/pdf.js";
import { ehLivre } from "../src/lib/auth.js";

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
  // o triplo desde 26/10/2026: 15 por acerto, 30 de bônus, exercício 120, projeto da semana 450
  assert.equal(pontosDoQuiz(5, 5), 105);
  assert.equal(pontosDoQuiz(3, 5), 45);
  assert.equal(pontosDaNota("projeto_semanal", 80), 360);
  assert.equal(pontosDaNota("exercicio", 150), 120);
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
caso("projeto: completo encerra; incompleto segue (entrega em partes) até as 5 tentativas", () => {
  // projetos entregam em partes (21/10/2026): aprovado e incompleto ainda pode mandar o resto
  assert.equal(podeReenviar({ tipo: "projeto_semanal", tentativas: 1, status: "concluido", completo: true }), false);
  assert.equal(podeReenviar({ tipo: "projeto_semanal", tentativas: 1, status: "concluido", completo: false }), true);
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
// ---- a trilha amarrada (23/10/2026): src/dominio/avanco.js
const BASE = "2026-10-05";
const et = (cardId, ordem, dias, inicio, extra = {}) => ({ cardId, ordem, dias, inicio, fim: inicio, titulo: cardId, teoria: false, ...extra });
caso("avanço: as semanas do plano são as semanas do curso (as do mapa e da agenda)", () => {
  // a semana gravada no agendamento manda (é a "Semana N" que a pessoa vê)
  const lista = [et("a", 1, 2, "2026-10-05", { semana: 1 }), et("b", 2, 2, "2026-10-07", { semana: 1 }), et("c", 3, 1, "2026-10-09", { semana: 1 }),
    et("d", 4, 3, "2026-10-12", { semana: 2 }), et("e", 5, 1, "2026-10-15", { semana: 2 }), et("f", 6, 2, "2026-10-16", { semana: 2 }), et("g", 7, 2, "2026-10-26", { semana: 4 })];
  assert.deepEqual(semanasDoPlano(lista, BASE).map((u) => `${u.numero}:${u.etapas.map((e) => e.cardId).join("")}`), ["1:abc", "2:def", "4:g"]);
  // sem a semana gravada: conta pela data, a partir da semana em que a trilha começou
  const semGravar = lista.map(({ semana, ...e }) => e);
  assert.deepEqual(semanasDoPlano(semGravar, BASE).map((u) => u.numero), [1, 2, 4]);
  const av = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-09" });
  assert.deepEqual(av.unidades.map((u) => [u.numero, u.tipo, u.seguinte, u.anterior]), [[1, "projeto_semanal", 2, null], [2, "projeto_semanal", 4, 1], [4, "projeto_final", null, 2]]);
  // o projeto da semana N cobre os assuntos da semana N do curso; a chave é a segunda-feira dela
  assert.deepEqual(av.unidades[1].cardIds, ["d", "e", "f"]);
  assert.equal(av.unidades[1].periodo, "2026-10-12");
  assert.equal(periodoDaSemana("2026-10-07", 1), "2026-10-05", "trilha que começou numa quarta: a semana 1 é a da segunda 05/10");
  // o projeto com a data (chave) de uma semana é só dela: não "empresta" para outra pelos assuntos
  const daSemana4 = { id: "p4", tipo: "projeto_semanal", periodo: periodoDaSemana(BASE, 4), status: "em_andamento", card_ids: ["d", "e", "g"] };
  const comProjeto = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-09", projetos: [daSemana4] });
  assert.equal(comProjeto.unidades[1].projeto, null);
  // um plano de 5 dias (de segunda a sexta) é UMA semana do curso — e ela termina no projeto final
  const curto = ["a", "b", "c", "d", "e"].map((id, i) => et(id, i + 1, 1, `2026-10-0${5 + i}`));
  const so = avancoDaTrilha({ etapas: curto, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-05" });
  assert.equal(so.unidades.length, 1);
  assert.equal(so.unidades[0].tipo, "projeto_final");
  assert.equal(valorDoProjetoFinal(1), 750);
  assert.equal(valorDoProjetoFinal(3), 1350);
  assert.equal(valorDoProjetoFinal(9), 1800);
  // o projeto final gerado antes do triplo (sem escala gravada) passa a valer o triplo; o novo não conta duas vezes
  assert.equal(tabelaDePontos("projeto_final", { requisitos: ["x", "y"], extras: [], valor: 250 }).base, 750);
  assert.equal(tabelaDePontos("projeto_final", { requisitos: ["x", "y"], extras: [], valor: 750, escalaDoValor: 3 }).base, 750);
});
caso("projeto da semana: sai dos assuntos DA semana do curso, sabe o que veio antes e o que ainda não pode cair", () => {
  // pedido de 23/10/2026: "o projeto da semana 1 não tem nada a ver com a semana 1"
  const lista = [et("a", 1, 2, "2026-10-05", { semana: 1 }), et("b", 2, 2, "2026-10-07", { semana: 1 }),
    et("c", 3, 2, "2026-10-12", { semana: 2 }), et("d", 4, 2, "2026-10-14", { semana: 2 }), et("e", 5, 2, "2026-10-19", { semana: 3 })];
  const antigo = { id: "p1", tipo: "projeto_semanal", periodo: periodoDaSemana(BASE, 1), status: "pendente", card_ids: ["a", "b"] };
  const av = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-08", projetos: [antigo] });
  const [s1, s2] = av.unidades;
  // a semana 2: os assuntos dela; a 1 pode ser usada; a 3 (o final) ainda não
  assert.deepEqual(pedidoDoProjeto(av, "projeto_semanal", s2).assuntos.map((e) => e.cardId), ["c", "d"]);
  assert.deepEqual(pedidoDoProjeto(av, "projeto_semanal", s2).antes, ["a", "b"]);
  assert.deepEqual(pedidoDoProjeto(av, "projeto_semanal", s2).depois, ["e"]);
  assert.deepEqual(pedidoDoProjeto(av, "projeto_semanal", s1).antes, []);
  // o final junta a trilha inteira
  assert.deepEqual(pedidoDoProjeto(av, "projeto_final", av.unidades[2]).assuntos.map((e) => e.cardId), ["a", "b", "c", "d", "e"]);
  // a semana de um projeto que já existe: a que o tem como projeto, ou a da chave dele
  assert.equal(semanaDoDesafio(av, antigo)?.numero, 1);
  assert.equal(semanaDoDesafio(av, { id: "outro", tipo: "projeto_semanal", periodo: periodoDaSemana(BASE, 2) })?.numero, 2);
  assert.equal(semanaDoDesafio(av, { id: "x", tipo: "projeto_mensal", periodo: "2026-10-01" }), null);
});
caso("projeto começado numa semana dispensada não some: fica opcional (vale pontos, não trava nada)", () => {
  // a semana 1 foi concluída antes das regras novas (dispensada); o projeto dela estava em andamento
  const lista = [et("a", 1, 1, "2026-10-05", { semana: 1, teoria: true, dispensa: true }), et("b", 2, 1, "2026-10-06", { semana: 1, teoria: true, dispensa: true }),
    et("c", 3, 1, "2026-10-12", { semana: 2 }), et("d", 4, 1, "2026-10-19", { semana: 3 })];
  const comecado = { id: "p1", tipo: "projeto_semanal", periodo: periodoDaSemana(BASE, 1), status: "pendente", card_ids: ["a", "b"] };
  const av = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-13", projetos: [comecado] });
  assert.equal(av.unidades[0].dispensada, true);
  assert.equal(av.semanaDaVez.numero, 2, "a semana dispensada não trava: a da vez é a 2");
  assert.deepEqual(projetosOpcionais(av).map((u) => [u.numero, u.projeto.id]), [[1, "p1"]]);
  // terminado, ou numa semana que não foi dispensada: não é "opcional"
  const terminado = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-13", projetos: [{ ...comecado, status: "concluido", nota: 80 }] });
  assert.deepEqual(projetosOpcionais(terminado), []);
  const naoDispensada = lista.map((e) => ({ ...e, dispensa: false, teoria: false }));
  assert.deepEqual(projetosOpcionais(avancoDaTrilha({ etapas: naoDispensada, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-13", projetos: [comecado] })), []);
});
caso("projeto da semana: cada requisito diz o assunto que pratica; dá para trocar o projeto antes da 1ª entrega", () => {
  const bruto = { titulo: "T", contexto: "C", requisitos: ["r1", "", "r2", "r3"], assuntoDeCada: [1, 9, 2, 1], extras: [], entrega: "", criterios: [] };
  // o requisito vazio sai junto com o número dele: o mapa continua alinhado
  assert.deepEqual(validarProjeto(bruto, 2).assuntoDeCada, [1, 2, 1]);
  assert.deepEqual(validarProjeto(bruto, 2).requisitos, ["r1", "r2", "r3"]);
  // número fora da lista, faltando, ou sem a lista de assuntos: o mapa fica de fora (o projeto vale igual)
  assert.equal(validarProjeto({ ...bruto, assuntoDeCada: [1, 9, 3, 1] }, 2).assuntoDeCada, undefined);
  assert.equal(validarProjeto({ ...bruto, assuntoDeCada: [1] }, 2).assuntoDeCada, undefined);
  assert.equal(validarProjeto(bruto).assuntoDeCada, undefined);
  // trocar o projeto: só o da semana e o final, antes da primeira entrega, até TROCAS_DE_PROJETO vezes
  assert.deepEqual(podeTrocarProjeto({ tipo: "projeto_semanal", tentativas: 0, conteudo: {} }), { ok: true, restantes: TROCAS_DE_PROJETO });
  assert.equal(podeTrocarProjeto({ tipo: "projeto_final", tentativas: 0, conteudo: { novos: 1 } }).restantes, TROCAS_DE_PROJETO - 1);
  assert.equal(podeTrocarProjeto({ tipo: "projeto_semanal", tentativas: 1, conteudo: {} }).ok, false);
  assert.equal(podeTrocarProjeto({ tipo: "projeto_semanal", tentativas: 0, conteudo: { novos: TROCAS_DE_PROJETO } }).ok, false);
  assert.equal(podeTrocarProjeto({ tipo: "projeto_mensal", tentativas: 0, conteudo: {} }).ok, false);
  assert.equal(podeTrocarProjeto({ tipo: "quiz", tentativas: 0, conteudo: {} }).ok, false);
  // o projeto de antes das semanas do curso não guarda os assuntos
  assert.equal(projetoAntigo({ titulo: "T", requisitos: [] }), true);
  assert.equal(projetoAntigo({ titulo: "T", requisitos: [], assuntos: ["a"] }), false);
});
caso("avanço: o assunto só conclui com a teoria E um quiz dele aprovado (60%+); o de antes das regras, dispensado", () => {
  const lista = [
    et("a", 1, 1, "2026-10-05", { teoria: true }),
    et("b", 2, 1, "2026-10-06", { teoria: true }),
    et("c", 3, 1, "2026-10-07", { teoria: true, dispensa: true }),
    et("d", 4, 1, "2026-10-08"),
    et("z", 0, 1, null, { teoria: true }), // concluído antes de a trilha existir
  ];
  const quizzes = [
    { card_ids: ["a"], status: "concluido", nota: 80 },
    { card_ids: ["b"], status: "concluido", nota: 40 },   // reprovado
    { card_ids: ["d"], status: "em_andamento", nota: 100 }, // ainda não terminou
  ];
  const av = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-08", quizzes });
  const por = Object.fromEntries(av.etapas.map((e) => [e.cardId, e]));
  assert.deepEqual([por.a.concluido, por.b.concluido, por.c.concluido, por.d.concluido, por.z.concluido], [true, false, true, false, true]);
  assert.equal(por.b.faltaQuiz, true);
  assert.equal(av.assuntoAtual.cardId, "b", "o assunto de agora é o primeiro pendente: o que só falta o quiz");
  assert.deepEqual(av.antes.map((e) => e.cardId), ["z"]);
  assert.deepEqual(av.progresso, { feitos: 3, total: 5 });
});
caso("avanço: o projeto da semana aprovado abre a semana seguinte; até lá a prática fica na semana aberta", () => {
  const lista = [
    et("a", 1, 3, "2026-10-05", { teoria: true }), et("b", 2, 2, "2026-10-08", { teoria: true }), // semana 1
    et("c", 3, 3, "2026-10-12"), et("d", 4, 2, "2026-10-15"),                                      // semana 2 (a final)
  ];
  const quizzes = [{ card_ids: ["a"], status: "concluido", nota: 100 }, { card_ids: ["b"], status: "concluido", nota: 60 }];
  const sem = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-13", quizzes });
  assert.deepEqual(sem.unidades.map((u) => [u.numero, u.tipo, u.aberta]), [[1, "projeto_semanal", true], [2, "projeto_final", false]]);
  assert.ok(sem.etapas.find((e) => e.cardId === "c").bloqueada, "a semana 2 fica trancada sem o projeto da 1");
  assert.match(sem.etapas.find((e) => e.cardId === "c").motivo, /projeto da semana 1/);
  assert.equal(sem.assuntoAtual, null, "nada pendente nas semanas abertas");
  assert.ok(["a", "b"].includes(sem.assuntoDaPratica.cardId), "a prática revisa um assunto da semana aberta");
  assert.equal(sem.semanaDaVez.numero, 1);
  assert.equal(sem.unidades[0].periodo, periodoDaSemana(BASE, 1));
  assert.ok(podeGerarProjeto(sem.unidades[0], "2026-10-13").ok);
  assert.ok(!podeGerarProjeto(sem.unidades[1], "2026-10-13").ok);

  const projetos = [{ id: "p1", tipo: "projeto_semanal", periodo: BASE, rodada: 1, status: "concluido", nota: 75, card_ids: ["a", "b"] }];
  const com = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-13", quizzes, projetos });
  assert.ok(com.unidades[1].aberta, "aprovado: a semana 2 abre");
  assert.equal(com.assuntoAtual.cardId, "c");
  assert.equal(com.concluida, false);
  assert.equal(semanaDoProjeto(com, "projeto_final", BASE).numero, 2);
});
caso("avanço: a trilha só termina com o projeto final aprovado", () => {
  const lista = [et("a", 1, 1, "2026-10-05", { teoria: true })];
  const quizzes = [{ card_ids: ["a"], status: "concluido", nota: 100 }];
  const sem = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-06", quizzes });
  assert.equal(sem.concluida, false);
  const com = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-06", quizzes,
    projetos: [{ id: "f1", tipo: "projeto_final", periodo: BASE, status: "concluido", nota: 90 }] });
  assert.equal(com.concluida, true);
});
caso("avanço: o que veio antes das regras continua valendo (semana concluída antes, projeto da semana do calendário)", () => {
  // semana 1 inteira concluída antes das regras: não pede projeto
  const lista = [et("a", 1, 3, "2026-10-05", { teoria: true, dispensa: true }), et("b", 2, 2, "2026-10-08", { teoria: true, dispensa: true }), et("c", 3, 3, "2026-10-12")];
  const av = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-12" });
  assert.ok(av.unidades[0].dispensada && av.unidades[1].aberta);
  // o projeto antigo (chave = a segunda da semana do calendário) vale para a semana do plano com os mesmos assuntos
  const base2 = "2026-10-07"; // a trilha começou numa quarta: as chaves novas não batem com as segundas
  const lista2 = [et("a", 1, 3, "2026-10-07", { teoria: true }), et("b", 2, 2, "2026-10-12"), et("c", 3, 3, "2026-10-14")];
  const antigo = { id: "velho", tipo: "projeto_semanal", periodo: "2026-10-05", rodada: 1, status: "concluido", nota: 70, card_ids: ["a", "b"] };
  const av2 = avancoDaTrilha({ etapas: lista2, diasDeEstudo: [1, 2, 3, 4, 5], base: base2, hoje: "2026-10-14", projetos: [antigo] });
  assert.equal(av2.unidades[0].projeto.id, "velho");
  assert.ok(av2.unidades[1].aberta);
});
caso("avanço: projeto reprovado dá lugar a outro; reprovado em todos, a semana libera assim mesmo", () => {
  const lista = [et("a", 1, 5, "2026-10-05", { teoria: true }), et("b", 2, 1, "2026-10-12")];
  const reprovado = (rodada) => ({ id: `r${rodada}`, tipo: "projeto_semanal", periodo: BASE, rodada, status: "concluido", nota: 30, card_ids: ["a"] });
  const um = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-12", projetos: [reprovado(1)] });
  assert.ok(um.unidades[0].podeOutroProjeto && !um.unidades[1].aberta);
  const todos = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-12",
    projetos: Array.from({ length: PROJETOS_POR_SEMANA }, (_, i) => reprovado(i + 1)) });
  assert.ok(todos.unidades[0].esgotou && todos.unidades[1].aberta);
});
caso("mapa da trilha: semanas do plano, o quiz que falta, a semana trancada, o troféu do final e a chegada", () => {
  const lista = [
    et("z", 0, 1, null, { teoria: true }),
    et("a", 1, 3, "2026-10-05", { teoria: true }), et("b", 2, 2, "2026-10-08", { teoria: true }),
    et("c", 3, 3, "2026-10-12"),
  ];
  const av = avancoDaTrilha({ etapas: lista, diasDeEstudo: [1, 2, 3, 4, 5], base: BASE, hoje: "2026-10-08",
    quizzes: [{ card_ids: ["a"], status: "concluido", nota: 100 }] });
  assert.deepEqual(mapaDaTrilha(av, "2026-10-08").map((n) => `${n.tipo}:${n.estado || ""}`), [
    "unidade:", "assunto:feito",
    "unidade:", "assunto:feito", "assunto:quiz", "projeto_semanal:disponivel",
    "unidade:", "assunto:bloqueado", "projeto_final:bloqueado",
    "chegada:bloqueado",
  ]);
  assert.equal(mapaDaTrilha(av, "2026-10-08")[2].titulo, "Semana 1");
});
caso("hoje: assunto de semana trancada não entra no dia (nem para adiantar)", () => {
  const t = tarefasDoDia([
    { trilhaId: "t", ordem: 1, inicio: "2026-10-10", fim: "2026-10-10", concluido: false, bloqueada: true },
    { trilhaId: "t", ordem: 2, inicio: "2026-10-12", fim: "2026-10-12", concluido: false, bloqueada: true },
  ], "2026-10-10");
  assert.equal(t.length, 0);
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
caso("agenda: a entrega de cada semana do plano aparece no fim dela; a da semana trancada fica para depois", () => {
  const av = avancoDaTrilha({
    etapas: [et("a", 1, 3, "2026-09-21", { fim: "2026-09-23", teoria: true }), et("b", 2, 2, "2026-09-24", { fim: "2026-09-25", teoria: true }), et("c", 3, 5, "2026-10-05", { fim: "2026-10-09" })],
    diasDeEstudo: [1, 2, 3, 4, 5], base: "2026-09-21", hoje: "2026-10-07",
  });
  const itens = montarAgenda({ ...agendaBase, semanas: new Map([["t", av.unidades]]), de: "2026-09-21", ate: "2026-10-11" });
  const projetos = itens.filter((x) => x.tipo === "projeto_semanal" || x.tipo === "projeto_final");
  assert.deepEqual(projetos.map((x) => [x.tipo, x.fim, x.situacao]), [["projeto_semanal", "2026-09-25", "atrasado"], ["projeto_final", "2026-10-09", "futuro"]]);
  assert.equal(itensDoDia(itens, "2026-09-25").filter((x) => x.tipo === "projeto_semanal").length, 1);
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
  // 12 na loja (os 5 dos ambientes das expedições estrearam em 23/10/2026): a vitrine fecha as linhas de 6, 4, 3 e 2.
  // Os chefões do Modo Domínio (24/10/2026) não se compram: ficam fora da loja.
  const daLoja = Object.keys(PERSONAGENS).filter((id) => !PERSONAGENS[id].chefao);
  assert.equal(daLoja.length, 12);
  // a vitrine mostra todos os da loja, uma vez cada, do mais barato ao mais caro
  assert.deepEqual([...ORDEM_DOS_PERSONAGENS].sort(), daLoja.sort());
  const precos = ORDEM_DOS_PERSONAGENS.map((id) => PERSONAGENS[id].preco);
  assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
  for (const id of ["cogumelo", "mergulhador", "yeti", "magma", "alienigena"]) assert.ok(PERSONAGENS[id].preco > 0, id);
  assert.deepEqual(personagensDe([]), ["neuro", "abacato"]);
  assert.deepEqual(personagensDe(["ninja", "inventado", "ninja"]), ["neuro", "abacato", "ninja"]);
  // o Neuro Abacate (mascote do Abacato) é de graça e de todo mundo
  assert.equal(PERSONAGENS.abacato.preco, 0);
  assert.deepEqual(podeEscolherPersonagem({ id: "abacato", possui: [], saldo: 0 }), { ok: true, compra: false, custo: 0 });
  assert.deepEqual(podeEscolherPersonagem({ id: "ninja", possui: [], saldo: 300 }), { ok: true, compra: true, custo: 300 });
  assert.match(podeEscolherPersonagem({ id: "robo", possui: [], saldo: 100 }).motivo, /faltam 1.900 moeda/);
  assert.match(podeEscolherPersonagem({ id: "ninja", possui: [], saldo: 12.35 }).motivo, /faltam 287,65 moeda/); // com centavos
  assert.deepEqual(podeEscolherPersonagem({ id: "ninja", possui: ["ninja"], saldo: 0 }), { ok: true, compra: false, custo: 0 });
  assert.deepEqual(podeEscolherPersonagem({ id: "neuro", possui: [], saldo: 0 }), { ok: true, compra: false, custo: 0 });
  assert.equal(podeEscolherPersonagem({ id: "dragao", possui: [], saldo: 9999 }).ok, false);
});

caso("lotação do Acampamento: exército + defesa juntos; lotado pede Acampamento maior", () => {
  assert.deepEqual([lotacaoDoAcampamento(1), lotacaoDoAcampamento(2), lotacaoDoAcampamento(4)], [40, 65, 115]);
  assert.equal(lotacaoDoAcampamento(undefined), 40); // reino antigo, sem o campo, nasce com o nível 1
  const niveis = { quartel: 5, castelo: 5, acampamento: 1 };
  const reservas = { exercito: { guerreiro: 30 }, guarnicao: { arqueira: 8 } }; // 38 de 40
  assert.equal(podeTreinar({ tropa: "guerreiro", quantidade: 2, destino: "exercito", niveis, reservas, saldo: 999 }).ok, true);
  assert.match(podeTreinar({ tropa: "guerreiro", quantidade: 3, destino: "exercito", niveis, reservas, saldo: 999 }).motivo, /Acampamento está lotado \(38 de 40\).*aumente o Acampamento/);
  assert.match(podeTreinar({ tropa: "arqueira", quantidade: 3, destino: "guarnicao", niveis, reservas, saldo: 999 }).motivo, /lotado/);
  assert.equal(podeTreinar({ tropa: "guerreiro", quantidade: 3, destino: "exercito", niveis: { ...niveis, acampamento: 2 }, reservas, saldo: 999 }).ok, true);
});

caso("dicas da Lisa: o guia do projeto precisa de passo a passo; o resto é limpo e limitado", () => {
  const guia = validarGuia({ passos: ["Crie o repositório", " ", "Monte as pastas", "Implemente o requisito 1"], dicas: ["Teste cada rota", 42], estudar: ["HTTP", "x".repeat(300)] });
  assert.deepEqual(guia.passos, ["Crie o repositório", "Monte as pastas", "Implemente o requisito 1"]);
  assert.deepEqual(guia.dicas, ["Teste cada rota", "42"]);
  assert.ok(guia.estudar[1].length <= 121);
  assert.equal(validarGuia({ passos: Array.from({ length: 20 }, (_, i) => `passo ${i}`) }).passos.length, 10);
  assert.throws(() => validarGuia({ passos: ["só um", "dois"] }), /passo a passo/);
  assert.throws(() => validarGuia(null), /passo a passo/);
});

caso("projeto: cada requisito tem valor claro, os extras são bônus e a soma fecha com a base", () => {
  const conteudo = { requisitos: ["a", "b", "c", "d", "e", "f", "g"], extras: ["x", "y"] };
  const t = tabelaDePontos("projeto_semanal", conteudo);
  assert.equal(t.base, 450);
  assert.equal(t.requisitos.reduce((s, v) => s + v, 0), 450);
  assert.deepEqual(t.requisitos, [65, 65, 64, 64, 64, 64, 64]);
  assert.deepEqual(t.extras, [45, 45]);
  assert.equal(t.maximo, 540);
  // mais simples NÃO tira pontos; desafiador vale 1,5×
  assert.equal(tabelaDePontos("projeto_mensal", { ...conteudo, complexidade: "simples" }).base, 1200);
  assert.equal(tabelaDePontos("projeto_mensal", { ...conteudo, complexidade: "desafiador" }).base, 1800);
  assert.equal(tabelaDePontos("projeto_mensal", { ...conteudo, complexidade: "inventada" }).base, 1200);
});

caso("projeto: entregas parciais somam o que é novo e nunca tiram o que já foi garantido", () => {
  const conteudo = { requisitos: ["a", "b", "c", "d", "e"], extras: ["x"] };
  const t = tabelaDePontos("projeto_semanal", conteudo); // 90 cada, extra 45
  const e1 = cumpridosNaAvaliacao({ requisitos: [{ numero: 1, atendido: true }, { numero: 2, atendido: true }, { numero: 3, atendido: false }] }, conteudo);
  assert.deepEqual(e1, { requisitos: [0, 1], extras: [] });
  assert.equal(pontosDoProjeto(t, e1), 180);
  // a 2ª entrega quebrou o requisito 2 mas fez o 3 e o 4 e o extra: o 2 continua garantido
  const e2 = cumpridosNaAvaliacao({ requisitos: [{ numero: 1, atendido: true }, { numero: 2, atendido: false }, { numero: 3, atendido: true }, { numero: 4, atendido: true }], extras: [{ numero: 1, atendido: true }] }, conteudo);
  const juntos = juntarCumpridos(e1, e2);
  assert.deepEqual(juntos, { requisitos: [0, 1, 2, 3], extras: [0] });
  assert.equal(pontosDoProjeto(t, juntos), 405);
  assert.equal(projetoCompleto(t, juntos), false);
  assert.equal(projetoCompleto(t, juntarCumpridos(juntos, { requisitos: [4] })), true);
  // sem número, vale a ordem; número fora do projeto é ignorado
  assert.deepEqual(cumpridosNaAvaliacao({ requisitos: [{ atendido: true }, { atendido: false }, { numero: 9, atendido: true }] }, conteudo).requisitos, [0]);
});

caso("projeto: a complexidade só muda antes da 1ª entrega, até 3 vezes", () => {
  const p = { tipo: "projeto_semanal", tentativas: 0, conteudo: { requisitos: ["a"] } };
  assert.equal(podeTrocarComplexidade(p, "simples").ok, true);
  assert.match(podeTrocarComplexidade(p, "padrao").motivo, /já está/);
  assert.match(podeTrocarComplexidade({ ...p, tentativas: 1 }, "desafiador").motivo, /primeira entrega/);
  assert.match(podeTrocarComplexidade({ ...p, conteudo: { trocas: 3 } }, "desafiador").motivo, /trocas/);
  assert.equal(podeTrocarComplexidade({ ...p, tipo: "exercicio" }, "simples").ok, false);
  assert.equal(podeTrocarComplexidade(p, "facil-demais").ok, false);
});

caso("avaliação: os itens guardam o número do requisito e os extras vêm separados", () => {
  const a = validarAvaliacao({ nota: 70, requisitos: [{ numero: 2, requisito: "rota", atendido: true }, { numero: 99, requisito: "x", atendido: false }], extras: [{ numero: 1, requisito: "csv", atendido: true }] });
  assert.equal(a.requisitos[0].numero, 2);
  assert.equal("numero" in a.requisitos[1], false);
  assert.equal(a.extras.length, 1);
  assert.deepEqual(validarAvaliacao({ nota: 50 }).extras, []);
});

caso("rodar o código: JavaScript e SQL no navegador; C, Python e os outros no compilador do servidor", () => {
  assert.equal(execucaoDoExercicio("JavaScript").onde, "navegador");
  assert.equal(execucaoDoExercicio("", "JavaScript do Zero").chave, "javascript");
  assert.equal(execucaoDoExercicio("sql").onde, "navegador");
  assert.equal(execucaoDoExercicio("", "SQL e Supabase do Zero").chave, "sql");
  assert.equal(execucaoDoExercicio("C").compilador, "gcc-13.2.0-c");
  assert.equal(execucaoDoExercicio("", "Aprenda Programação em C do Zero").chave, "c");
  assert.equal(execucaoDoExercicio("c++").compilador, "gcc-13.2.0");
  assert.equal(execucaoDoExercicio("Python 3").onde, "servidor");
  assert.equal(execucaoDoExercicio("", "PHP Básico para Integração com IA").chave, "php");
  assert.equal(execucaoDoExercicio("", "Dominando o Microsoft Entra ID"), null);
  assert.equal(execucaoDoExercicio("", "Java para iniciantes").chave, "java");
  assert.equal(execucaoDoExercicio("", "JavaScript para iniciantes").chave, "javascript");
  assert.equal(execucaoDoExercicio("", "Estudos de Ciência da Computação e JS - Nível 1").chave, "javascript");
  assert.equal(prepararParaCompilador("php", "echo 1;"), "<?php\necho 1;");
  assert.equal(prepararParaCompilador("php", "<?php echo 1;"), "<?php echo 1;");
  assert.equal(prepararParaCompilador("java", "public class Main {\n public static void main(String[] a) {} }"), "class Main {\n public static void main(String[] a) {} }");
  const r = resultadoDoServidor({ status: "1", compiler_error: "prog.c:2: erro", program_output: "" });
  assert.equal(r.falhouNaCompilacao, true);
  assert.equal(resultadoDoServidor({ status: "0", program_output: "oi\n" }).saida, "oi\n");
});

caso("guerra: o mesmo reino só a cada 48 h, contadas do ataque (e cada lado conta o seu)", () => {
  const agora = new Date("2026-10-22T12:00:00Z");
  const comTropas = { exercito: { guerreiro: 5 } };
  const alvo = { usuario_id: "ele", escudo_ate: null };
  const base = { atacanteId: "eu", atacante: comTropas, defensor: alvo, ataquesHoje: 0, agora };
  assert.equal(HORAS_ENTRE_ATAQUES_AO_MESMO_REINO, 48);
  // ataquei há 10 h: bloqueado, com a hora em que libera
  const r = podeInvadir({ ...base, ultimoAtaqueAoAlvo: "2026-10-22T02:00:00Z" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /libera de novo em 1 dia e 14 h/);
  assert.equal(r.liberaEm, "2026-10-24T02:00:00.000Z");
  // há 49 h: liberado (mesmo sendo "outro dia" faz tempo)
  assert.equal(podeInvadir({ ...base, ultimoAtaqueAoAlvo: "2026-10-20T11:00:00Z" }).ok, true);
  // nunca ataquei (ele me atacou — isso é do lado dele): posso revidar
  assert.equal(podeInvadir({ ...base, ultimoAtaqueAoAlvo: null }).ok, true);
  assert.equal(proximoAtaqueAoReino(null), null);
  assert.equal(esperaAte(new Date("2026-10-22T12:20:00Z"), agora), "em 20 min");
  assert.equal(esperaAte(new Date("2026-10-22T15:00:00Z"), agora), "em 3 h");
  assert.equal(esperaAte(new Date("2026-10-24T12:00:00Z"), agora), "em 2 dias");
});

caso("expedições: o catálogo respeita as regras do reino (terra nova pede Terreno, chefe é um dos monstros)", () => {
  const ids = new Set();
  const anterior = {};
  for (const x of EXPEDICOES) {
    assert.equal(ids.has(x.id), false, x.id);
    ids.add(x.id);
    const v = veiculoDa(x);
    assert.ok(VEICULOS[v], `${x.id}: veículo ${v}`);
    assert.ok(x.torreMinima >= (anterior[v] || 0), `${x.id} fora de ordem`);
    assert.ok(x.torreMinima >= VEICULOS[v].torreMinima, `${x.id}: abre antes do veículo`);
    anterior[v] = x.torreMinima;
    assert.ok(MONSTROS[x.chefe] && x.monstros[x.chefe] > 0, `${x.id}: o chefe precisa estar entre os monstros`);
    for (const t of Object.keys(x.monstros)) assert.ok(MONSTROS[t], `${x.id}: monstro desconhecido ${t}`);
    for (const [chave, nivel] of Object.entries(x.construcoes)) {
      assert.ok(CONSTRUCOES[chave], `${x.id}: construção ${chave}`);
      if (nivel > 0 && CONSTRUCOES[chave].terreno) assert.ok((x.construcoes.terreno || 0) >= CONSTRUCOES[chave].terreno, `${x.id}: ${chave} sem Terreno`);
    }
  }
  assert.equal(expedicaoPorId("covil-cerbero").chefe, "cerbero");
  assert.equal(expedicaoPorId("nao-existe"), null);
  assert.deepEqual(contagensDeMonstros({ goblin: 2.7, dragao: 3, cerbero: -1 }), { goblin: 2 });
});

caso("expedições: torre, veículo e combustível no tanque (repetir vale), e tropas para partir", () => {
  const x = expedicaoPorId("floresta-lobos"); // Torre 2, de Barco
  const ok = { expedicao: x, nivelDaTorre: 2, veiculos: [], tanque: tanqueDoDia({ feitas: 0 }) };
  assert.equal(podeExpedicionar(ok).ok, true); // o Barco é de todo mundo
  assert.equal(podeExpedicionar({ ...ok, tanque: tanqueDoDia({ feitas: 2 }) }).ok, true); // o mesmo lugar de novo
  assert.match(podeExpedicionar({ ...ok, nivelDaTorre: 1 }).motivo, /Torre do Neuro no nível 2/);
  const vazio = podeExpedicionar({ ...ok, tanque: tanqueDoDia({ feitas: EXPEDICOES_POR_DIA }) });
  assert.equal(vazio.semCombustivel, true);
  assert.match(vazio.motivo, /tanque do Barco Voador está vazio/);
  // abasteceu: mais uma
  assert.equal(podeExpedicionar({ ...ok, tanque: tanqueDoDia({ feitas: 3, extras: 1 }) }).ok, true);
  // sem exército também parte (vai a Tropa da Expedição)
  assert.equal(podeExpedicionar({ ...ok, temExercito: false }).ok, true);
  assert.equal(podeExpedicionar({ ...ok, expedicao: null }).ok, false);
  // as do fundo do mar pedem o Submarino
  const recife = expedicaoPorId("recife-tritoes");
  assert.match(podeExpedicionar({ ...ok, expedicao: recife }).motivo, /precisa do Submarino/);
  assert.equal(podeExpedicionar({ ...ok, expedicao: recife, veiculos: ["submarino"] }).ok, true);
});

caso("expedições: sem exército, vai a Tropa da Expedição (emprestada, do tamanho da Torre)", () => {
  const vazio = exercitoDaExpedicao({}, 2);
  assert.equal(vazio.emprestado, true);
  assert.ok(Object.values(vazio.exercito).reduce((s, n) => s + n, 0) > 0);
  assert.deepEqual(vazio.exercito, exercitoDeTreino(2, 1));
  // Torre 0 (reino novo) ainda leva a tropa do nível 1
  assert.deepEqual(exercitoDaExpedicao(null, 0).exercito, exercitoDeTreino(1, 1));
  // quem tem exército vai com o dele
  assert.deepEqual(exercitoDaExpedicao({ guerreiro: 3 }, 5), { exercito: { guerreiro: 3 }, emprestado: false });
  // e a Tropa da Expedição vence o primeiro lugar com folga
  const x = expedicaoPorId("bosque-cogumelos");
  const r = batalhaDeExpedicao({ atacante: { exercito: exercitoDaExpedicao({}, 1).exercito, neuro_nivel: 1 }, expedicao: x, semente: 7 });
  assert.ok(r.estrelas >= 2, `${r.estrelas} estrelas`);
});

caso("expedições: o saque segue a destruição, mesmo sem estrela, e ⭐⭐⭐ dá +25%", () => {
  const x = { recompensa: 200 };
  assert.equal(saqueDaExpedicao(x, { destruicao: 40, estrelas: 0 }), 80);
  assert.equal(saqueDaExpedicao(x, { destruicao: 100, estrelas: 2 }), 200);
  assert.equal(saqueDaExpedicao(x, { destruicao: 100, estrelas: 3 }), 250);
  assert.equal(saqueDaExpedicao(x, { destruicao: 0, estrelas: 0 }), 0);
});

caso("expedições: cada lugar tem dificuldade de 1 a 5 e recompensa que cresce com ela", () => {
  const antes = {};
  for (const x of EXPEDICOES) {
    const v = veiculoDa(x);
    assert.ok(x.dificuldade >= 1 && x.dificuldade <= 5, x.id);
    assert.ok(x.recompensa > (antes[v] || 0), `${x.id}: a recompensa precisa crescer`);
    antes[v] = x.recompensa;
  }
  // os veículos novos: três lugares cada, um por nível
  for (const v of ["submarino", "dirigivel", "tanque"]) {
    const lugares = EXPEDICOES.filter((x) => veiculoDa(x) === v);
    assert.equal(lugares.length, 3, v);
    assert.equal(new Set(lugares.map((x) => x.dificuldade)).size, 3, `${v}: um lugar por nível`);
  }
  assert.equal(expedicaoPorId("covil-cerbero").dificuldade, 5);
  assert.equal(defensorDaExpedicao(expedicaoPorId("vila-bandidos")).cenario, "vila-bandidos");
});

caso("expedições: monstros soltos desde o começo, batalha determinística, nada se gasta", () => {
  const x = expedicaoPorId("vila-goblins");
  const atacante = { exercito: { guerreiro: 8, arqueira: 6 }, neuro_nivel: 2 };
  const a = batalhaDeExpedicao({ atacante, expedicao: x, semente: 4242 });
  const b = batalhaDeExpedicao({ atacante, expedicao: x, semente: 4242 });
  assert.deepEqual({ ...a, entrada: null }, { ...b, entrada: null });
  assert.deepEqual(a.entrada.defensor, defensorDaExpedicao(x));
  // quem caiu + quem ficou de pé fecham com o exército (é só o placar: ninguém se perde)
  for (const [t, n] of Object.entries(atacante.exercito)) assert.equal((a.caidas[t] || 0) + (a.sobreviventes[t] || 0), n);
  // no primeiro passo os monstros já estão na ilha, do lado da defesa
  const e = montarCombate(a.entrada);
  const ev = passoDoCombate(e);
  const monstros = e.unidades.filter((u) => MONSTROS[u.tipo]);
  assert.equal(monstros.length, 8);
  assert.ok(monstros.every((u) => u.lado === "defesa" && u.guarda));
  assert.ok(ev.filter((x) => x.tipo === "entrou").length >= 8);
  // e ficam dentro da ilha
  assert.ok(monstros.every((u) => Math.hypot(u.x, u.z) <= raioDaIlha(0)));
  // invasão entre jogadores continua sem monstro nenhum
  const pvp = montarCombate({ semente: 1, atacante, defensor: { construcoes: { castelo: 1, torre: 1 }, neuro_nivel: 1, guarnicao: {} } });
  passoDoCombate(pvp);
  assert.equal(pvp.unidades.some((u) => MONSTROS[u.tipo]), false);
});

caso("expedições: os dois primeiros lugares são vencíveis por quem acabou de liberar (exército de treino)", () => {
  for (const id of ["bosque-cogumelos", "vila-goblins"]) {
    const x = expedicaoPorId(id);
    let soma = 0;
    for (let i = 1; i <= 6; i++) soma += batalhaDeExpedicao({ atacante: { exercito: exercitoDeTreino(x.torreMinima, 1), neuro_nivel: x.torreMinima * 2 }, expedicao: x, semente: i * 7919 }).estrelas;
    assert.ok(soma / 6 >= 2, `${id}: média de ${soma / 6} estrelas`);
  }
});

caso("paz: a proposta traz todos os termos (sem guerra, vizinhos, mina ×N, expedições, 100% dos votos)", () => {
  const termos = termosDaPaz(7, 5);
  assert.equal(termos.length, 5);
  assert.match(termos[0].titulo, /7 dias sem guerra/);
  assert.ok(termos.some((x) => /Todos vizinhos/.test(x.titulo)));
  assert.ok(termos.some((x) => /Mina ×5/.test(x.titulo)));
  assert.ok(termos.some((x) => /Expedições repartem/.test(x.titulo) && /20%/.test(x.texto)));
  assert.ok(termos.some((x) => /100% dos votos/.test(x.titulo)));
  assert.deepEqual(DIAS_DE_PAZ, [3, 7, 14, 30]);
});

caso("paz: só com 100% dos votos; um não derruba; uma proposta por vez", () => {
  assert.equal(resultadoDaVotacao([true, true, true], 3), "aprovada");
  assert.equal(resultadoDaVotacao([true, true], 3), "aberta");
  assert.equal(resultadoDaVotacao([true, false, true], 3), "rejeitada");
  assert.equal(resultadoDaVotacao([true, true, true, true], 3), "aprovada"); // reino novo durante a votação conta também
  const agora = new Date("2026-10-22T12:00:00Z");
  const aberta = { status: "votacao", expira_em: "2026-10-24T12:00:00Z" };
  const vigente = { status: "aprovada", fim: "2026-10-29T12:00:00Z", total_reinos: 5 };
  assert.equal(votacaoAberta(aberta, agora), true);
  assert.equal(votacaoAberta({ ...aberta, expira_em: "2026-10-22T11:00:00Z" }, agora), false);
  assert.equal(podeProporPaz({ dias: 7, ofensiva: 3, agora }).ok, true);
  assert.match(podeProporPaz({ dias: 7, ofensiva: 3, votacaoAtual: aberta, agora }).motivo, /em votação/);
  assert.match(podeProporPaz({ dias: 7, ofensiva: 3, pazAtual: vigente, agora }).motivo, /já está em paz/);
  assert.match(podeProporPaz({ dias: 5, ofensiva: 3, agora }).motivo, /3, 7, 14, 30/);
  assert.equal(podeVotar({ paz: aberta, jaVotou: false, ofensiva: 4, agora }).ok, true);
  assert.match(podeVotar({ paz: aberta, jaVotou: true, ofensiva: 4, agora }).motivo, /já votou/);
  assert.match(podeVotar({ paz: { ...aberta, status: "rejeitada" }, jaVotou: false, ofensiva: 4, agora }).motivo, /terminou/);
  assert.deepEqual(periodoDaPaz(7, agora), { inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-29T12:00:00.000Z" });
});

caso("paz: só vota (e propõe) quem tem 3+ dias de ofensiva; os 100% contam só os eleitores", () => {
  const agora = new Date("2026-10-22T12:00:00Z");
  const aberta = { status: "votacao", expira_em: "2026-10-24T12:00:00Z" };
  assert.equal(OFENSIVA_PARA_VOTAR, 3);
  assert.equal(podeVotarComOfensiva(3), true);
  assert.equal(podeVotarComOfensiva(2), false);
  assert.equal(podeVotarComOfensiva(undefined), false);
  const semOfensiva = podeVotar({ paz: aberta, jaVotou: false, ofensiva: 2, agora });
  assert.equal(semOfensiva.ok, false);
  assert.match(semOfensiva.motivo, /3 dias seguidos \(sua ofensiva: 2 dias\)/);
  assert.match(semOfensiva.motivo, /a paz vale para você do mesmo jeito/);
  assert.match(podeVotar({ paz: aberta, jaVotou: false, ofensiva: 1, agora }).motivo, /sua ofensiva: 1 dia\)/);
  assert.match(podeProporPaz({ dias: 7, ofensiva: 0, agora }).motivo, /para propor a paz, estude 3 dias seguidos/);
  assert.match(podeProporPaz({ dias: 7, agora }).motivo, /sua ofensiva: 0 dias/); // sem ofensiva conhecida = 0
  // 5 reinos: só a e b estão aptos; c já votou (votou quando ainda estava apto) → 3 eleitores
  const eleitores = eleitoresDaVotacao({ aptos: ["a", "b"], votantes: ["a", "c"] });
  assert.deepEqual(eleitores.sort(), ["a", "b", "c"]);
  assert.equal(resultadoDaVotacao([true, true], eleitores.length), "aberta"); // falta b
  assert.equal(resultadoDaVotacao([true, true, true], eleitores.length), "aprovada"); // d e e não votam e ganham a paz
  assert.ok(termosDaPaz(7, 5).some((x) => /3\+ dias de ofensiva/.test(x.texto) && /ganha a paz do mesmo jeito/.test(x.texto)));
});

caso("paz: mina × o número de reinos, expedição reparte 20% e ninguém invade ninguém", () => {
  const agora = new Date("2026-10-22T12:00:00Z");
  const vigente = { status: "aprovada", fim: "2026-10-29T12:00:00Z", total_reinos: 5 };
  assert.equal(pazVigente(vigente, agora), true);
  assert.equal(fatorDaMinaNaPaz(vigente, agora), 5);
  assert.equal(fatorDaMinaNaPaz({ ...vigente, fim: "2026-10-21T12:00:00Z" }, agora), 1);
  assert.equal(fatorDaMinaNaPaz(null, agora), 1);
  assert.equal(parteDaExpedicao(75), 15);
  assert.equal(parteDaExpedicao(0), 0);
  const r = podeInvadir({ atacanteId: "a", atacante: { exercito: { guerreiro: 3 } }, defensor: { usuario_id: "b" }, ataquesHoje: 0, emPaz: true, agora });
  assert.match(r.motivo, /em paz/);
  const reino = { construcoes: { mina: 2 }, coletado_em: "2026-10-22T08:00:00Z" };
  assert.equal(producaoAcumulada(reino, agora, 5), 5 * producaoAcumulada(reino, agora, 1));
});

caso("veículos: o Barco é de todos; os outros pedem Torre e moedas", () => {
  assert.deepEqual(veiculosDe([]), ["barco"]);
  assert.deepEqual(veiculosDe(["nave", "inventado", "submarino"]), ["barco", "submarino", "nave"]); // na ordem da garagem
  assert.equal(VEICULOS.barco.preco, 0);
  assert.match(podeComprarVeiculo({ id: "barco", possui: [], nivelDaTorre: 5, saldo: 0 }).motivo, /já é seu/);
  assert.match(podeComprarVeiculo({ id: "tanque", possui: [], nivelDaTorre: 2, saldo: 99999 }).motivo, /Torre do Neuro no nível 3/);
  assert.match(podeComprarVeiculo({ id: "submarino", possui: [], nivelDaTorre: 2, saldo: 100 }).motivo, /faltam 500/);
  assert.deepEqual(podeComprarVeiculo({ id: "submarino", possui: [], nivelDaTorre: 2, saldo: 600 }), { ok: true, custo: 600 });
  assert.equal(podeComprarVeiculo({ id: "foguete", possui: [], nivelDaTorre: 5, saldo: 9999 }).ok, false);
});

caso("combustível: 3 cargas por dia por veículo; abastecer só com o tanque vazio, mais caro a cada vez", () => {
  assert.equal(CARGAS_POR_DIA, 3);
  assert.deepEqual(tanqueDoDia({ feitas: 1 }), { cargas: 3, usadas: 1, restantes: 2, extras: 0, extrasPossiveis: EXTRAS_POR_DIA });
  assert.deepEqual([0, 1, 2, 3, 4].map(precoDaCarga), [20, 35, 50, 65, 80]);
  const base = { id: "barco", possui: [], saldo: 1000 };
  assert.match(podeAbastecer({ ...base, feitas: 1 }).motivo, /ainda tem 2 carga/);
  assert.deepEqual(podeAbastecer({ ...base, feitas: 3 }), { ok: true, custo: 20 });
  assert.deepEqual(podeAbastecer({ ...base, feitas: 4, extras: 1 }), { ok: true, custo: 35 });
  assert.match(podeAbastecer({ ...base, feitas: 3 + EXTRAS_POR_DIA, extras: EXTRAS_POR_DIA }).motivo, /amanhã o tanque enche/);
  assert.match(podeAbastecer({ ...base, feitas: 3, saldo: 5 }).motivo, /faltam 15/);
  assert.match(podeAbastecer({ ...base, id: "nave", feitas: 3 }).motivo, /ainda não é seu/);
});

caso("planetoides: sorteio fixo por pessoa, dia e viagem; força e recompensa variam dentro dos limites", () => {
  const s1 = sementeDoPlanetoide("u1", "2026-10-23", 1);
  assert.equal(s1, sementeDoPlanetoide("u1", "2026-10-23", 1));
  assert.notEqual(s1, sementeDoPlanetoide("u1", "2026-10-23", 2));
  assert.notEqual(s1, sementeDoPlanetoide("u2", "2026-10-23", 1));
  assert.deepEqual(planetoideDa(s1), planetoideDa(s1)); // o radar mostra o mesmo que a batalha usa
  const racas = new Set(), forcas = [], recompensas = [], dificuldades = new Set();
  for (let i = 1; i <= 400; i++) {
    const p = planetoideDa(sementeDoPlanetoide("u", "2026-10-23", i));
    racas.add(p.raca); forcas.push(p.forca); recompensas.push(p.recompensa); dificuldades.add(p.dificuldade);
    assert.ok(p.forca >= FORCA_MINIMA && p.forca <= FORCA_MAXIMA, `força ${p.forca}`);
    assert.ok(p.recompensa >= RECOMPENSA_MINIMA && p.recompensa <= RECOMPENSA_MAXIMA, `recompensa ${p.recompensa}`);
    assert.ok(MONSTROS[p.chefe] && p.monstros[p.chefe] > 0, "o chefe está entre os aliens");
    for (const t of Object.keys(p.monstros)) assert.ok(MONSTROS[t], t);
    assert.equal(p.veiculo, "nave");
    for (const [chave, nivel] of Object.entries(p.construcoes)) {
      if (nivel > 0 && CONSTRUCOES[chave].terreno) assert.ok((p.construcoes.terreno || 0) >= CONSTRUCOES[chave].terreno, `${chave} sem Terreno`);
    }
  }
  assert.equal(racas.size, ORDEM_DAS_RACAS.length, "todas as raças aparecem");
  assert.ok(Math.max(...forcas) - Math.min(...forcas) > 0.9, "a força varia de verdade");
  assert.ok(Math.max(...recompensas) - Math.min(...recompensas) > 200, "a recompensa varia de verdade");
  assert.ok(dificuldades.size >= 3, "planetoides fáceis e difíceis");
  // a força vai para o motor: monstros mais fortes, mesma batalha determinística
  const p = planetoideDa(s1);
  const defensor = defensorDaExpedicao({ ...p, forca: 1.5 });
  assert.equal(defensor.forca, 1.5);
  assert.equal(defensor.veiculo, "nave");
  const fraco = montarCombate({ atacante: { exercito: { guerreiro: 1 } }, defensor: { ...defensor, forca: 1 }, semente: 3 });
  const forte = montarCombate({ atacante: { exercito: { guerreiro: 1 } }, defensor, semente: 3 });
  assert.equal(forte.forca, 1.5);
  assert.equal(fraco.forca, 1);
});

caso("planetoides: a força deixa os aliens mais fortes no combate (vida e dano)", () => {
  const entrada = (forca) => ({ semente: 9, atacante: { exercito: { guerreiro: 6, arqueira: 4 }, neuro_nivel: 2 },
    defensor: { construcoes: { castelo: 2, mina: 1 }, neuro_nivel: 0, guarnicao: {}, monstros: { zorg: 4 }, ...(forca ? { forca } : {}) } });
  const normal = resolverCombate(entrada(null));
  assert.deepEqual(resolverCombate(entrada(1)), normal); // força 1 = sem força nenhuma
  const forte = resolverCombate(entrada(1.8));
  const fraco = resolverCombate(entrada(0.6));
  assert.ok(fraco.destruicao >= normal.destruicao && normal.destruicao >= forte.destruicao, `${fraco.destruicao} ≥ ${normal.destruicao} ≥ ${forte.destruicao}`);
});

caso("mina de ouro: todo reino nasce com ela e com o pelotão de 3 operários; 1 pepita a cada 8 h", () => {
  assert.equal(NIVEIS_INICIAIS.minaDeOuro, 1);
  assert.equal(OPERARIOS_INICIAIS, 3);
  assert.deepEqual([1, 2, 5].map(vagasDaMina), [3, 5, 11]);
  const desde = "2026-10-23T00:00:00Z";
  // 3 operários por 8 h = 3 pepitas = 18 moedas
  const semDiamante = [...Array(2000).keys()].map((i) => i + 1).find((sem) => diamantesEntre(9, 1, sem) === 0);
  assert.deepEqual(ouroAcumulado({ nivel: 1, semente: semDiamante, operarios: 3, desde, agora: new Date("2026-10-23T08:00:00Z") }), { pepitas: 3, ouro: 3, diamantes: 0, moedas: 18, capacidade: 9, cheia: false });
  // 7 h ainda não deu pepita
  assert.equal(ouroAcumulado({ nivel: 1, operarios: 3, desde, agora: new Date("2026-10-23T07:59:00Z") }).pepitas, 2);
  // enche (3 pepitas por vaga) e para
  assert.deepEqual(ouroAcumulado({ nivel: 1, semente: semDiamante, operarios: 3, desde, agora: new Date("2026-10-26T00:00:00Z") }), { pepitas: 9, ouro: 9, diamantes: 0, moedas: 54, capacidade: 9, cheia: true });
  // vale mais que a Mina de Moedas do mesmo nível
  assert.ok(3 * moedasPorOperarioPorDia() > 24 * producaoPorHora(1));
});

caso("mina de ouro: alugados para fora não trabalham para mim; os que aluguei de fora trabalham", () => {
  const desde = "2026-10-23T00:00:00Z", agora = new Date("2026-10-23T16:00:00Z");
  const fora = [{ quantidade: 2, inicio: "2026-10-23T08:00:00Z", fim: "2026-10-24T08:00:00Z" }];
  const deFora = [{ quantidade: 1, inicio: "2026-10-22T20:00:00Z", fim: "2026-10-23T04:00:00Z" }];
  // 3 × 16 h − 2 × 8 h (fora desde as 8 h) + 1 × 4 h (o alugado, até as 4 h) = 48 − 16 + 4 = 36 h
  assert.equal(horasTrabalhadas({ operarios: 3, desde, agora, alugadosParaFora: fora, alugadosDeFora: deFora }), 36);
  assert.deepEqual(equipeDeAgora({ operarios: 3, alugadosParaFora: fora, alugadosDeFora: deFora, agora }), { proprios: 3, alugadosParaFora: 2, alugadosDeFora: 0, emCasa: 1, trabalhando: 1 });
  assert.equal(periodoDoAluguel(new Date("2026-10-23T10:00:00Z")).fim, "2026-10-24T10:00:00.000Z");
});

caso("operários: comprar cabe nas vagas; pôr para alugar e alugar de outro reino", () => {
  assert.deepEqual([3, 4, 5].map(precoDoOperario), [120, 160, 200]);
  assert.deepEqual(podeComprarOperario({ operarios: 3, nivel: 2, saldo: 500 }), { ok: true, custo: 120 });
  assert.match(podeComprarOperario({ operarios: 3, nivel: 1, saldo: 500 }).motivo, /3 vagas — melhore a mina/);
  assert.match(podeComprarOperario({ operarios: 4, nivel: 2, saldo: 100 }).motivo, /faltam 60/);
  assert.deepEqual(podeOfertar({ quantidade: 2, preco: 10, operarios: 3 }), { ok: true, quantidade: 2, preco: 10 });
  assert.deepEqual(podeOfertar({ quantidade: 0, preco: 0, operarios: 3 }), { ok: true, quantidade: 0, preco: 0 }); // tirar a oferta
  assert.match(podeOfertar({ quantidade: 5, preco: 10, operarios: 3 }).motivo, /você tem 3/);
  assert.match(podeOfertar({ quantidade: 1, preco: 99, operarios: 3 }).motivo, /de 5 a 40/);
  const oferta = { quantidade: 3, preco: 12 };
  assert.deepEqual(podeAlugar({ souODono: false, oferta, jaAlugados: 1, quantidade: 2, vagasLivres: 2, saldo: 100 }), { ok: true, custo: 24, quantidade: 2 });
  assert.match(podeAlugar({ souODono: true, oferta, quantidade: 1, vagasLivres: 5, saldo: 100 }).motivo, /já são seus/);
  assert.match(podeAlugar({ souODono: false, oferta, jaAlugados: 3, quantidade: 1, vagasLivres: 5, saldo: 100 }).motivo, /todos alugados/);
  assert.match(podeAlugar({ souODono: false, oferta, jaAlugados: 1, quantidade: 3, vagasLivres: 5, saldo: 100 }).motivo, /só 2 operário/);
  assert.match(podeAlugar({ souODono: false, oferta, quantidade: 2, vagasLivres: 1, saldo: 100 }).motivo, /só tem 1 vaga/);
  assert.match(podeAlugar({ souODono: false, oferta, quantidade: 2, vagasLivres: 0, saldo: 100 }).motivo, /lotada/);
  assert.match(podeAlugar({ souODono: false, oferta, quantidade: 2, vagasLivres: 5, saldo: 10 }).motivo, /faltam 14/);
  assert.match(podeAlugar({ souODono: false, oferta: { quantidade: 0, preco: 0 }, quantidade: 1, vagasLivres: 5, saldo: 100 }).motivo, /não tem operários/);
});

caso("bolsa: preço do pregão limitado a ±30%, nunca abaixo do mínimo; corretagem de 1% (mínimo 1)", () => {
  assert.equal(precoDepois(100, 12), 112);
  assert.equal(precoDepois(100, -80), 70); // a variação para em −30%
  assert.equal(precoDepois(100, 99), 130);
  assert.equal(precoDepois(3, -30), PRECO_MINIMO);
  assert.equal(precoDepois(2, -30), PRECO_MINIMO);
  assert.deepEqual([corretagem(10), corretagem(250), corretagem(1000), corretagem(1234.5)], [1, 2.5, 10, 12.35]); // centavo por centavo, mínimo 1
  assert.equal(variacaoReal(100, 112), 12);
});

caso("bolsa: comprar cobra preço + corretagem; vender paga preço − corretagem; preço médio na carteira", () => {
  const acao = { id: "PEPT", preco: 25, status: "ativa" };
  assert.deepEqual(podeComprarAcao({ acao, quantidade: 4, saldo: 200 }), { ok: true, quantidade: 4, valor: 100, taxa: 1, total: 101 });
  assert.match(podeComprarAcao({ acao, quantidade: 4, saldo: 100 }).motivo, /faltam 1/);
  assert.match(podeComprarAcao({ acao, quantidade: 0, saldo: 100 }).motivo, /quantas/);
  assert.match(podeComprarAcao({ acao, quantidade: MAXIMO_POR_ORDEM + 1, saldo: 1e9 }).motivo, /no máximo/);
  assert.match(podeComprarAcao({ acao: { ...acao, status: "falida" }, quantidade: 1, saldo: 100 }).motivo, /não está na bolsa/);
  assert.deepEqual(podeVenderAcao({ acao, posicao: { quantidade: 4, custo: 101 }, quantidade: 2 }), { ok: true, quantidade: 2, valor: 50, taxa: 1, total: 49 });
  assert.match(podeVenderAcao({ acao, posicao: { quantidade: 1 }, quantidade: 2 }).motivo, /você tem 1/);
  assert.match(podeVenderAcao({ acao, posicao: null, quantidade: 1 }).motivo, /não tem ações/);
  const comprou = posicaoDepois(null, { tipo: "compra", quantidade: 4, total: 101 });
  assert.deepEqual(comprou, { quantidade: 4, custo: 101 });
  assert.deepEqual(posicaoDepois(comprou, { tipo: "venda", quantidade: 2 }), { quantidade: 2, custo: 50.5 });
  assert.deepEqual(posicaoDepois(comprou, { tipo: "venda", quantidade: 4 }), { quantidade: 0, custo: 0 });
  assert.deepEqual(resumoDaCarteira([{ acao_id: "PEPT", quantidade: 4, custo: 101 }], () => 30), { valor: 120, custo: 101, lucro: 19 });
  // comprar e vender no mesmo dia nunca dá lucro (o preço só muda no pregão)
  const c = podeComprarAcao({ acao, quantidade: 10, saldo: 1e6 }), v = podeVenderAcao({ acao, posicao: { quantidade: 10 }, quantidade: 10 });
  assert.ok(v.total < c.total);
});

caso("bolsa: o pregão da Lisa é conferido (toda ação ganha variação, tickers únicos, faixa de preço)", () => {
  const ativas = [{ id: "PEPT", preco: 20 }, { id: "BARC", preco: 40 }];
  const p = validarPregao({
    manchete: "  Dia agitado no reino!  ",
    movimentos: [{ ticker: "pept", variacao: 55, noticia: "Ouro em alta" }, { ticker: "XXXX", variacao: -5, noticia: "?" }],
    novas: [
      { ticker: "BARC", nome: "Repetida", setor: "Transportes", emoji: "⛵", descricao: "x", preco: 30 },     // já existe
      { ticker: "FALI", nome: "Já faliu", setor: "Magia", emoji: "🪄", descricao: "x", preco: 30 },           // saiu da bolsa antes
      { ticker: "ab", nome: "Curta", setor: "Magia", emoji: "🪄", descricao: "x", preco: 30 },               // ticker inválido
      { ticker: "NOVA", nome: "Nova Empresa", setor: "Inventado", emoji: "", descricao: "", preco: 9999 },
      { ticker: "OUTR", nome: "Outra", setor: "Magia", emoji: "🪄", descricao: "y", preco: 1 },
      { ticker: "TERC", nome: "Terceira", setor: "Magia", emoji: "🪄", descricao: "z", preco: 20 },
    ],
  }, ativas, { novas: 2, existentes: ["FALI"] });
  assert.equal(p.manchete, "Dia agitado no reino!");
  assert.deepEqual(p.movimentos.map((m) => [m.acao, m.variacao]), [["PEPT", VARIACAO_MAXIMA], ["BARC", 0]]); // BARC sem resposta: 0%
  assert.deepEqual(p.novas.map((n) => n.id), ["NOVA", "OUTR"]);
  assert.equal(p.novas[0].setor, SETORES[0]);         // setor fora da lista vira o primeiro
  assert.equal(p.novas[0].preco, PRECO_INICIAL[1]);   // preço dentro da faixa
  assert.equal(p.novas[1].preco, PRECO_INICIAL[0]);
});

caso("bolsa: sem a IA, o sorteio do dia move o mercado (o mesmo para todos) e lança empresas", () => {
  const ativas = [{ id: "PEPT", preco: 20 }, { id: "BARC", preco: 40 }, { id: "FORJ", preco: 60 }];
  const a = pregaoDeReserva("2026-10-23", ativas), b = pregaoDeReserva("2026-10-23", ativas), c = pregaoDeReserva("2026-10-24", ativas);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.movimentos, c.movimentos);
  assert.equal(a.movimentos.length, 3);
  assert.ok(a.movimentos.every((m) => Math.abs(m.variacao) <= 12));
  assert.equal(a.novas.length, NOVAS_POR_DIA);
  assert.ok(a.novas.every((n) => !["PEPT", "BARC", "FORJ"].includes(n.id)));
  assert.equal(pregaoDeReserva("2026-10-23", [], { novas: ACOES_DO_PRIMEIRO_DIA }).novas.length, ACOES_DO_PRIMEIRO_DIA);
});

caso("bolsa: quem chega ao preço mínimo vai à falência; acima do teto, a mais antiga fecha o capital", () => {
  const depois = Array.from({ length: MAXIMO_DE_ACOES }, (_, i) => ({ id: `A${String.fromCharCode(65 + i)}C`, preco: 30, criada_em: `2026-10-${String(10 + i).padStart(2, "0")}` }));
  depois[5].preco = PRECO_MINIMO;
  // 12 na bolsa, 1 faliu → 11; com 2 novas seriam 13: a mais antiga fecha
  assert.deepEqual(saidasDaBolsa(depois, 2), { faliram: [depois[5].id], fecham: [depois[0].id] });
  assert.deepEqual(saidasDaBolsa(depois.slice(0, 4), 2), { faliram: [], fecham: [] });
});

caso("mina de ouro: diamantes saem por sorte (mais na mina funda), fixos por rodada e valem mais", () => {
  assert.deepEqual([1, 3, 5].map((n) => Math.round(chanceDeDiamante(n) * 100)), [4, 6, 8]);
  assert.ok(VALOR_DO_DIAMANTE > 5 * VALOR_DA_PEPITA);
  // a mesma semente sempre dá os mesmos diamantes; mais pedras nunca "desfazem" um diamante
  const sem = sementeDaMina("u1", "2026-10-23T10:00:00.000Z");
  assert.equal(sem, sementeDaMina("u1", "2026-10-23T10:00:00.000Z"));
  assert.notEqual(sem, sementeDaMina("u1", "2026-10-23T18:00:00.000Z"));
  let antes = 0;
  for (let pedras = 0; pedras <= 40; pedras++) { const d = diamantesEntre(pedras, 3, sem); assert.ok(d >= antes && d - antes <= 1); antes = d; }
  // em muitas rodadas, a proporção bate com a chance
  let total = 0;
  for (let i = 1; i <= 2000; i++) total += diamantesEntre(10, 5, i * 7919);
  assert.ok(Math.abs(total / 20000 - chanceDeDiamante(5)) < 0.01, `proporção ${total / 20000}`);
  const comDiamante = [...Array(5000).keys()].map((i) => i + 1).find((x) => diamantesEntre(3, 1, x) === 1);
  const r = ouroAcumulado({ nivel: 1, semente: comDiamante, operarios: 3, desde: "2026-10-23T00:00:00Z", agora: new Date("2026-10-23T08:00:00Z") });
  assert.deepEqual([r.pepitas, r.ouro, r.diamantes, r.moedas], [3, 2, 1, 2 * VALOR_DA_PEPITA + VALOR_DO_DIAMANTE]);
});

caso("bolsa: o preço anda hora a hora da abertura ao fechamento da Lisa (o mesmo para todos)", () => {
  const semente = sementeDaAcao("PEPT", "2026-10-23");
  const c = caminhoDoDia({ abertura: 40, fechamento: 46, semente });
  assert.equal(c.length, PASSOS_DO_DIA + 1);
  assert.equal(c[0], 40);
  assert.equal(c[PASSOS_DO_DIA], 46);
  assert.deepEqual(c, caminhoDoDia({ abertura: 40, fechamento: 46, semente })); // todo mundo vê o mesmo
  assert.notDeepEqual(c, caminhoDoDia({ abertura: 40, fechamento: 46, semente: sementeDaAcao("PEPT", "2026-10-24") }));
  assert.ok(c.every((p) => p >= 1 && Math.round(p * 100) === Math.round(p * 100 + 1e-9)), "centavos");
  assert.ok(new Set(c).size > PASSOS_DO_DIA - 2, "o preço mexe de verdade ao longo do dia");
  const mexidas = c.slice(1).map((p, i) => Math.abs(p / c[i] - 1));
  assert.ok(Math.max(...mexidas) < 0.08, `nenhuma hora pula demais (${Math.max(...mexidas)})`);
  const v = velaDe(c, 10);
  assert.deepEqual([v.abertura, v.fechamento], [40, c[10]]);
  assert.equal(v.maxima, Math.max(...c.slice(0, 11)));
  assert.equal(v.minima, Math.min(...c.slice(0, 11)));
  // um dia sem variação ainda balança, e volta ao mesmo preço
  const parado = caminhoDoDia({ abertura: 20, fechamento: 20, semente: 5 });
  assert.equal(parado[0], 20);
  assert.equal(parado[PASSOS_DO_DIA], 20);
});

caso("bolsa: o pregão negocia das 07:00 às 17:00 e o preço anda só nesse horário", () => {
  assert.deepEqual([ABRE_AS, FECHA_AS, PASSOS_DO_DIA], [7, 17, 10]);
  assert.deepEqual([0, 6, 7, 12, 16, 17, 23].map(pregaoAberto), [false, false, true, true, true, false, false]);
  assert.deepEqual([0, 6, 7, 8, 16, 17, 23].map(passosAte), [0, 0, 0, 1, 9, 10, 10]);
  const c = caminhoDoDia({ abertura: 30, fechamento: 36, semente: sementeDaAcao("OURO", "2026-10-23") });
  assert.equal(precoNaHora(c, 3), 30, "de madrugada: o fechamento de ontem, parado");
  assert.equal(precoNaHora(c, 7), 30, "abre no fechamento de ontem");
  assert.equal(precoNaHora(c, 12), c[5]);
  assert.equal(precoNaHora(c, 17), 36, "às 17:00 chega ao fechamento da Lisa");
  assert.equal(precoNaHora(c, 22), 36, "e fica lá até amanhã");
  assert.deepEqual([horaDoPasso(0), horaDoPasso(PASSOS_DO_DIA)], [7, 17]);
  // quando o preço (ou o pregão) muda de novo
  assert.equal(proximaVirada("2026-10-23", 5), "2026-10-23T07:00:00-03:00");
  assert.equal(proximaVirada("2026-10-23", 9), "2026-10-23T10:00:00-03:00");
  assert.equal(proximaVirada("2026-10-23", 16), "2026-10-23T17:00:00-03:00");
  assert.equal(proximaVirada("2026-10-23", 17), "2026-10-24T07:00:00-03:00");
  assert.equal(proximaVirada("2026-10-31", 23), "2026-11-01T07:00:00-03:00");
});

caso("Reino de Teste: nasce com tudo liberado (e cabe tudo no acampamento)", () => {
  const r = reinoLiberado();
  for (const c of ORDEM_DAS_CONSTRUCOES) {
    assert.equal(r.construcoes[c], CONSTRUCOES[c].max, c);
    assert.equal(podeMelhorar(r, c, 1e9).motivo, "já está no nível máximo");
  }
  assert.deepEqual(r.veiculos, ORDEM_DOS_VEICULOS);
  assert.deepEqual(personagensDe(r.personagens).sort(), Object.keys(PERSONAGENS).sort());
  assert.ok(espacoUsado(r.exercito) <= capacidadeDoExercito(r.construcoes.quartel));
  assert.ok(espacoUsado(r.guarnicao) <= capacidadeDaGuarnicao(r.construcoes.castelo));
  assert.ok(espacoUsado(r.exercito) + espacoUsado(r.guarnicao) <= lotacaoDoAcampamento(r.construcoes.acampamento));
  assert.equal(r.operarios, vagasDaMina(r.construcoes.minaDeOuro));
  // do zero: como um reino novo de verdade
  const novo = reinoNovoDeTeste();
  assert.deepEqual(novo.construcoes, NIVEIS_INICIAIS);
  assert.deepEqual(novo.veiculos, ["barco"]);
  assert.equal(totalDeTropas(novo.exercito), 0);
});

caso("Reino de Teste: os rivais-robô são reinos válidos, do mais fraco ao mais forte", () => {
  const ids = RIVAIS_DE_TESTE.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.ok(ehRivalDeTeste(ids[0]) && !ehRivalDeTeste("63624d00-0000-4000-8000-000000000000"));
  let defesaAntes = -1;
  for (const rival of RIVAIS_DE_TESTE) {
    const r = reinoDoRival(rival);
    for (const c of ORDEM_DAS_CONSTRUCOES) {
      const n = r.construcoes[c];
      assert.ok(n >= (NIVEIS_INICIAIS[c] || 0) && n <= CONSTRUCOES[c].max, `${rival.nome}: ${c} ${n}`);
      if (CONSTRUCOES[c].terreno && r.construcoes.terreno < CONSTRUCOES[c].terreno) assert.equal(n, 0, `${rival.nome}: ${c} sem terreno`);
    }
    assert.ok(espacoUsado(r.exercito) <= capacidadeDoExercito(r.construcoes.quartel), `${rival.nome}: exército`);
    assert.ok(espacoUsado(r.guarnicao) <= capacidadeDaGuarnicao(r.construcoes.castelo), `${rival.nome}: guarnição`);
    assert.ok(espacoUsado(r.exercito) + espacoUsado(r.guarnicao) <= lotacaoDoAcampamento(r.construcoes.acampamento), `${rival.nome}: acampamento`);
    assert.ok(totalDeTropas(r.exercito) > 0, "todo robô pode invadir (a ferramenta “Um rival invade você”)");
    if (rival.oferta) assert.ok(podeOfertar({ ...rival.oferta, operarios: r.operarios }).ok, `${rival.nome}: oferta`);
    const defesa = poderDo(r).defesa;
    assert.ok(defesa > defesaAntes, `${rival.nome} mais forte que o anterior`);
    defesaAntes = defesa;
  }
});

caso("Reino de Teste: a tela chama o servidor no mundo certo, e as ferramentas são únicas", () => {
  assert.equal(urlNoMundo("/api/reino", "teste"), "/api/reino?mundo=teste");
  assert.equal(urlNoMundo("/api/reino/bolsa?hora=3", "teste"), "/api/reino/bolsa?hora=3&mundo=teste");
  assert.equal(urlNoMundo("/api/reino", "real"), "/api/reino");
  const ferramentas = FERRAMENTAS_DE_TESTE.map((x) => x.id);
  assert.equal(new Set(ferramentas).size, ferramentas.length);
  assert.ok(!ferramentas.includes("limpar") && !ferramentas.includes("tanques"), "o modo de teste antigo (no reino de verdade) saiu");
});

caso("Reino de Teste: o código do reino e da bolsa só fala com o banco pelo mundo (nada vaza para o de verdade)", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const mundo = ler("../src/lib/mundo.js");
  const tabelas = [...mundo.match(/TABELAS_DO_MUNDO = \[([\s\S]*?)\]/)[1].matchAll(/"(proof_[a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(tabelas.length >= 10 && tabelas.includes("proof_reinos") && tabelas.includes("proof_bolsa_posicoes"));
  for (const arquivo of ["../src/lib/reino.js", "../src/lib/bolsa.js"]) {
    const src = ler(arquivo);
    assert.ok(!/\bsupabase\./.test(src), `${arquivo}: fala com o banco direto (use db.from)`);
    for (const t of tabelas) assert.ok(!src.includes(`buscarEmLotes("${t}"`), `${arquivo}: buscarEmLotes("${t}") sem tabela()`);
  }
  // cada tabela do jogo tem a gêmea de teste na migração
  const migracao = ler("../db/016-mundo-de-teste.sql");
  for (const t of tabelas) assert.ok(migracao.includes(`${t.replace(/^proof_/, "proof_teste_")} `) && migracao.includes(`like public.${t} `), `gêmea de ${t}`);
});

caso("moedas com centavos: a bolsa conta centavo por centavo, e a venda devolve os centavos", () => {
  assert.equal(valorDaCompra(23.45, 3), 70.35);
  assert.equal(valorDaVenda(23.45, 3), 70.35);
  assert.equal(valorDaCompra(0.1, 3), 0.3); // sem o lixo do ponto flutuante
  const acao = { id: "PEPT", preco: 23.45, status: "ativa" };
  assert.deepEqual(podeComprarAcao({ acao, quantidade: 3, saldo: 100 }), { ok: true, quantidade: 3, valor: 70.35, taxa: 1, total: 71.35 });
  assert.deepEqual(podeVenderAcao({ acao, posicao: { quantidade: 3 }, quantidade: 3 }), { ok: true, quantidade: 3, valor: 70.35, taxa: 1, total: 69.35 });
  assert.match(podeComprarAcao({ acao, quantidade: 3, saldo: 71.3 }).motivo, /faltam 0,05 moeda/);
  // o saldo soma os centavos do livro-caixa (os números do banco podem vir como texto)
  assert.equal(saldoDe({ pontosDeEstudo: 100, movimentos: [{ valor: "69.35" }, { valor: -0.2 }, { valor: 0.1 }] }), 169.25);
  assert.deepEqual([formatarMoedas(412), formatarMoedas(412.5), formatarMoedas(1234.56), formatarMoedas(412, { sempreComCentavos: true })], ["412", "412,50", "1.234,56", "412,00"]);
  assert.equal(centavos(0.1 + 0.2), 0.3);
  assert.equal(faltam(300, 12.35), "faltam 287,65 moeda(s)");
});

caso("invasão: só as tropas que caem se perdem (as sobreviventes voltam)", () => {
  const exercito = { guerreiro: 10, arqueira: 6, gigante: 2 };
  const r = batalha({ atacante: { exercito, neuro_nivel: 3 }, defensor: { construcoes: { castelo: 1, torre: 1, mina: 1 }, neuro_nivel: 1, guarnicao: {} }, saldoDoDefensor: 0, semente: 99 });
  const perdas = caidasNoAtaque(exercito, r.sobreviventes);
  for (const [t, n] of Object.entries(exercito)) assert.equal((perdas[t] || 0) + (r.sobreviventes[t] || 0), n);
  assert.ok(Object.values(r.sobreviventes).reduce((a, b) => a + b, 0) > 0, "contra um reino fraco, alguém sobrevive");
});

// ---------------------------------------------------------------- Modo Domínio (24/10/2026)

caso("Modo Domínio: o nível manda no tamanho da torre; a dificuldade só sobe", () => {
  assert.deepEqual(andaresPermitidos(1), { min: 10, max: 15 });
  assert.deepEqual(andaresPermitidos(5), { min: 10, max: 100 });
  assert.equal(andaresEscolhidos(200, 3), 50);
  assert.equal(andaresEscolhidos(3, 5), MIN_ANDARES);
  assert.equal(andaresEscolhidos("muitos", 1), null);
  assert.equal(dificuldadeEsperada(1, 10), 1);
  assert.equal(dificuldadeEsperada(10, 10), 5);
  for (const n of [10, 37, 100]) {
    const lista = Array.from({ length: n }, (_, i) => dificuldadeEsperada(i + 1, n));
    assert.ok(lista.every((d, i) => i === 0 || d >= lista[i - 1]), `sobe em ${n}`);
  }
});

caso("Modo Domínio: os chefões ficam mais fortes, o do topo é um dos quatro e a semente repete", () => {
  const ordem = CHEFOES.map((c) => c.id);
  const finais = CHEFOES_FINAIS.map((c) => c.id);
  assert.equal(finais.length, 4);
  for (const n of [10, 37, 100]) {
    for (const s of [1, 7, 12345, sementeDe("dono/repo")]) {
      const lista = chefoesDaTorre(n, s);
      assert.equal(lista.length, n);
      assert.ok(finais.includes(lista.at(-1)), "o do topo é dos quatro mais fortes");
      assert.ok(lista.slice(0, -1).every((c) => c !== lista.at(-1)), "o guardião do topo só aparece no topo");
      assert.deepEqual(chefoesDaTorre(n, s), lista, "a mesma semente sorteia igual");
      const media = (xs) => xs.reduce((a, c) => a + ordem.indexOf(c), 0) / xs.length;
      const q = Math.max(2, Math.floor(n / 4));
      assert.ok(media(lista.slice(0, q)) < media(lista.slice(-q - 1, -1)), "o começo é mais fraco que o fim");
    }
  }
  assert.equal(nomeDoChefao("golem", "do Callback"), "Golem do Callback");
  assert.equal(nomeDoChefao("golem", ""), "Golem");
  assert.equal(chefaoDoPersonagem(personagemDoChefao("kraken")), "kraken");
  assert.equal(chefaoDoPersonagem("ninja"), null);
});

caso("Modo Domínio: pontos do andar (dificuldade × nível × nota) e do topo", () => {
  // o triplo desde 26/10/2026
  assert.equal(pontosDoAndar(100, 5, 5), Math.round(65 * 3 * 1.75));
  assert.equal(pontosDoAndar(100, 1, 1), 75);
  assert.equal(pontosDoAndar(0, 5, 5), 0);
  assert.equal(pontosDoAndar(150, 1, 1), 75, "nota acima de 100 não vale mais");
  assert.equal(pontosDoTopo(1, 10), 120);
  assert.equal(pontosDoTopo(5, 100), Math.round(600 * Math.sqrt(10)));
});

caso("recompensas em triplo (26/10/2026): prática e Domínio sim; teoria e conquistas não", () => {
  assert.equal(MULTIPLICADOR_DE_RECOMPENSAS, 3);
  assert.deepEqual(premiosDoMarco(0, 5).find((p) => p.tipo === "pontos"), { tipo: "pontos", pontos: 150 });
  assert.deepEqual(premiosDoMarco(3, 1).find((p) => p.tipo === "pontos"), { tipo: "pontos", pontos: 120 });
  assert.equal(PONTOS.item, 10, "a teoria fica como estava");
  assert.equal(PONTOS.card, 30);
  assert.equal(PONTOS.meta_diaria, 20);
});

caso("Modo Domínio: a luta — 60 vence, sem sorte; as vidas fecham certinho", () => {
  for (const nota of [0, 30, 59, 60, 75, 100]) {
    for (let s = 1; s <= 25; s++) {
      const r = roteiroDaLuta({ nota, atributos: { logica: 80, testes: 20 }, dificuldade: 1 + (s % 5), semente: s });
      assert.equal(r.venceu, nota >= NOTA_PARA_VENCER);
      assert.equal(r.golpes[0].quem, "neuro");
      r.golpes.forEach((g, i) => { if (i) assert.notEqual(g.quem, r.golpes[i - 1].quem, "os golpes se alternam"); assert.ok(g.dano >= 1); });
      const fim = r.golpes.at(-1);
      if (r.venceu) { assert.equal(fim.vidaChefao, 0); assert.ok(fim.vidaNeuro > 0); assert.equal(fim.quem, "neuro"); }
      else { assert.equal(fim.vidaNeuro, 0); assert.ok(fim.vidaChefao > 0); }
      assert.deepEqual(roteiroDaLuta({ nota, atributos: { logica: 80, testes: 20 }, dificuldade: 1 + (s % 5), semente: s }), r);
    }
  }
  // quanto maior a nota, mais rápido o chefão cai
  const golpesDoNeuro = (nota) => roteiroDaLuta({ nota, semente: 3 }).golpes.filter((g) => g.quem === "neuro").length;
  assert.ok(golpesDoNeuro(100) <= golpesDoNeuro(61));
  // o golpe especial é o melhor atributo
  const r = roteiroDaLuta({ nota: 90, atributos: { testes: 95, logica: 40 }, semente: 5 });
  assert.equal(r.golpes.filter((g) => g.quem === "neuro").at(-1).especial, "testes");
});

caso("Modo Domínio: os atributos do Neuro pesam a dificuldade; o nível sobe com a experiência", () => {
  const zero = atributosDoNeuro([]);
  assert.equal(zero.nivel, 1);
  assert.ok(ATRIBUTOS.every((a) => zero.valores[a.id] === 0));
  const r = atributosDoNeuro([{ atributos: { logica: 100 }, dificuldade: 1 }, { atributos: { logica: 0 }, dificuldade: 3 }]);
  assert.equal(r.valores.logica, 25);
  assert.equal(r.experiencia, 4);
  assert.equal(atributosDoNeuro(Array.from({ length: 3 }, () => ({ atributos: {}, dificuldade: 5 }))).nivel, 2);
});

caso("Modo Domínio: os prêmios dos marcos dependem do nível do repositório", () => {
  assert.deepEqual(marcosDaTorre(10), [3, 5, 8, 10]);
  assert.deepEqual(marcosDaTorre(100), [25, 50, 75, 100]);
  const tipos = (lista) => lista.flatMap((m) => m.premios.map((p) => p.tipo));
  const n1 = premiosDaTorre(10, 1, "kraken");
  assert.deepEqual([...new Set(tipos(n1))].sort(), ["certificado", "pontos"]);
  const n5 = premiosDaTorre(100, 5, "kraken");
  const topo = n5.at(-1).premios;
  assert.ok(topo.some((p) => p.tipo === "veiculo"));
  assert.ok(topo.some((p) => p.tipo === "avatar" && p.personagem === "chefao-kraken"));
  assert.ok(topo.some((p) => p.tipo === "certificado"));
  assert.ok(n5[0].premios.some((p) => p.tipo === "tropas"));
  assert.ok(n5[1].premios.some((p) => p.tipo === "defesas"));
  assert.ok(!tipos(premiosDaTorre(50, 4, "kraken")).includes("avatar"), "avatar só no nível Mestre");
  assert.deepEqual(premiosDoAndar(8, 10, 5, "kraken"), premiosDaTorre(10, 5, "kraken")[2].premios);
  assert.deepEqual(premiosDoAndar(4, 10, 5, "kraken"), []);
  // os pontos dos marcos crescem até o topo
  const pontos = n5.map((m) => m.premios.find((p) => p.tipo === "pontos").pontos);
  assert.ok(pontos.every((p, i) => i === 0 || p > pontos[i - 1]));
});

caso("Modo Domínio: prêmio no Reino — o que não cabe (ou não é liberado) vira moedas", () => {
  const vazio = { exercito: {}, guarnicao: {} };
  assert.deepEqual(encaixarTropas({ pacote: { guerreiro: 8 }, destino: "exercito", niveis: { quartel: 0, acampamento: 1 }, ...vazio }), { cabem: {}, sobram: { guerreiro: 8 } });
  assert.equal(valorDasTropas({ guerreiro: 8 }), 80);
  assert.deepEqual(
    encaixarTropas({ pacote: { guerreiro: 8 }, destino: "exercito", niveis: { quartel: 1, acampamento: 1 }, exercito: { guerreiro: 15 }, guarnicao: {} }),
    { cabem: { guerreiro: 5 }, sobram: { guerreiro: 3 } },
  );
  // mago pede a Torre do Neuro no nível 3
  assert.deepEqual(encaixarTropas({ pacote: { mago: 1 }, destino: "guarnicao", niveis: { castelo: 1, acampamento: 4 }, ...vazio }).sobram, { mago: 1 });
  // a lotação do Acampamento vale para as duas reservas juntas
  const r = encaixarTropas({ pacote: { arqueira: 6 }, destino: "guarnicao", niveis: { castelo: 3, acampamento: 1 }, exercito: { guerreiro: 30 }, guarnicao: { arqueira: 7 } });
  assert.deepEqual(r, { cabem: { arqueira: 3 }, sobram: { arqueira: 3 } });
  // o que cabe sempre respeita o treino de verdade
  const n = { quartel: 2, castelo: 2, acampamento: 2 };
  const e = encaixarTropas({ pacote: { gigante: 2, guerreiro: 8 }, destino: "exercito", niveis: n, ...vazio });
  for (const [t, q] of Object.entries(e.cabem)) assert.ok(podeTreinar({ tropa: t, quantidade: q, destino: "exercito", niveis: n, reservas: vazio, saldo: 1e9 }).ok, t);
  assert.equal(veiculoDoPremio([]), "submarino");
  assert.equal(veiculoDoPremio(["submarino", "dirigivel"]), "tanque");
  assert.equal(veiculoDoPremio(["barco", "submarino", "dirigivel", "tanque", "nave"]), null);
  assert.deepEqual(MOEDAS_NO_LUGAR, { veiculo: 2400, avatar: 4500 }); // o triplo desde 26/10/2026
});

caso("Modo Domínio: a torre grande sai em blocos, cada um com a sua fatia de assuntos", () => {
  assert.deepEqual(blocosDaTorre(10), [{ inicio: 1, fim: 10 }]);
  assert.deepEqual(blocosDaTorre(30), [{ inicio: 1, fim: 25 }, { inicio: 26, fim: 30 }]);
  assert.equal(blocosDaTorre(100).length, 4);
  assert.equal(blocosDaTorre(100).reduce((s, b) => s + b.fim - b.inicio + 1, 0), 100);
  const assuntos = Array.from({ length: 20 }, (_, i) => `a${i + 1}`);
  const fim = assuntosDoBloco(assuntos, { inicio: 76, fim: 100 }, 100);
  assert.ok(fim.includes("a20") && !fim.includes("a1"));
  const comeco = assuntosDoBloco(assuntos, { inicio: 1, fim: 25 }, 100);
  assert.ok(comeco.includes("a1") && !comeco.includes("a20"));
  assert.deepEqual(assuntosDoBloco(assuntos, { inicio: 1, fim: 20 }, 20), assuntos);
  // o trecho é numerado e a dificuldade segue a torre inteira
  const trecho = validarTorre({ andares: Array.from({ length: 5 }, () => ({ titulo: "x", dificuldade: 5 })) }, 5, { inicio: 1, total: 100 });
  assert.deepEqual(trecho.map((a) => a.numero), [1, 2, 3, 4, 5]);
  assert.ok(trecho.every((a) => a.dificuldade === 2), "no começo de 100 andares, dificuldade 5 desce para 2");
  const alto = validarTorre({ andares: Array.from({ length: 3 }, () => ({ titulo: "y", dificuldade: 1 })) }, 3, { inicio: 98, total: 100 });
  assert.deepEqual(alto.map((a) => [a.numero, a.dificuldade]), [[98, 4], [99, 4], [100, 4]]);
  assert.throws(() => validarTorre({ andares: [{}, {}] }, 3), /só 2 de 3/);
  // juntando os blocos, a dificuldade nunca desce
  assert.deepEqual(dificuldadeSempreSobe([4, 4, 3, 5, 4].map((dificuldade, i) => ({ numero: i + 1, dificuldade }))).map((a) => a.dificuldade), [4, 4, 4, 5, 5]);
});

caso("Modo Domínio: as conferências do que a IA devolve", () => {
  const a = validarAnalise({ apto: true, complexidade: 9, andaresSugeridos: 500, tecnologias: Array.from({ length: 20 }, (_, i) => `t${i}`) });
  assert.equal(a.complexidade, 5);
  assert.equal(a.andaresSugeridos, 100);
  assert.equal(a.tecnologias.length, 12);
  assert.equal(validarAnalise({ apto: true, complexidade: 0 }).apto, false);
  assert.equal(validarAnalise({ apto: true, complexidade: 2 }).andaresSugeridos, 30, "sem sugestão, vale o teto do nível");
  assert.throws(() => validarDesafio({ requisitos: ["só um"] }), /requisitos/);
  const d = validarDesafio({ enunciado: "faça", requisitos: ["a", "b", "c"], arquivos: Array(20).fill("x.js") });
  assert.equal(d.arquivos.length, 8);
  const av = validarAvaliacaoDoAndar({ nota: 150, atributos: { logica: 30, testes: "abc" } });
  assert.equal(av.nota, 100);
  assert.equal(av.venceu, true);
  assert.equal(av.atributos.logica, 30);
  assert.equal(av.atributos.testes, 100, "atributo ilegível vale a nota geral");
  assert.equal(validarAvaliacaoDoAndar({ nota: 59 }).venceu, false);
  assert.equal(mediaDasNotas([{ vencido: true, melhorNota: 80 }, { vencido: true, melhorNota: 61 }, { vencido: false, melhorNota: 30 }]), 71);
});

caso("Modo Domínio: a branch sugerida e o código do certificado", () => {
  assert.equal(branchSugerida("Meu Repositório Ação"), "dominio/meu-repositorio-acao");
  assert.equal(branchSugerida("dono/lisa.proof"), "dominio/lisa.proof");
  for (const b of ["dominio/x", "feature/a-b_c.1"]) assert.ok(branchValida(b), b);
  for (const b of ["", "../x", "a..b", "a b", "x.lock", "/x", "x/", "a;rm"]) assert.ok(!branchValida(b), b);
  const codigo = codigoDoCertificado(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 250, 255]));
  assert.match(codigo, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.ok(codigoValido(codigo));
  assert.ok(!/[01OIL]/.test(codigo.replace(/-/g, "")), "sem as letras que se confundem");
  assert.ok(!codigoValido("ABCD-EFGH-IJKL"));
  assert.ok(!codigoValido(`${codigo}X`));
  assert.throws(() => codigoDoCertificado([1, 2, 3]));
});

caso("Modo Domínio: o endereço do repositório (GitHub e GitLab, só os públicos de verdade)", () => {
  assert.deepEqual(lerEnderecoDoRepo("https://github.com/dono/repo/tree/main"), { provedor: "github", caminho: "dono/repo", nome: "repo", branch: "main", url: "https://github.com/dono/repo" });
  assert.equal(lerEnderecoDoRepo("github.com/dono/repo.git").caminho, "dono/repo");
  const gl = lerEnderecoDoRepo("https://gitlab.com/grupo/sub/projeto/-/tree/dev/x?ref=1");
  assert.deepEqual([gl.provedor, gl.caminho, gl.nome, gl.branch], ["gitlab", "grupo/sub/projeto", "projeto", "dev/x"]);
  assert.equal(lerEnderecoDoRepo("https://gitlab.com/grupo/projeto/-/blob/main/a.js").branch, null);
  assert.equal(lerEnderecoDoRepo("https://gitlab.com/grupo/projeto.git").caminho, "grupo/projeto");
  for (const ruim of ["https://gitlab.com.evil.com/a/b", "https://evil.com/github.com/a/b", "https://gitlab.com/so-um", "https://gitlab.exemplo.com/a/b", "ftp://github.com/a/b", ""]) {
    assert.equal(lerEnderecoDoRepo(ruim), null, ruim);
  }
  assert.equal(linkDoCommit("https://gitlab.com/g/p", "abc"), "https://gitlab.com/g/p/-/commit/abc");
  assert.equal(linkDoCommit("https://github.com/d/r", "abc"), "https://github.com/d/r/commit/abc");
});

caso("Modo Domínio: o PDF do certificado é um PDF de verdade (xref batendo com os objetos)", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
  const pdf = pdfDeJpeg(jpeg, 20, 14, { titulo: "Certificado de Domínio — ação (teste)" });
  const texto = new TextDecoder("latin1").decode(pdf);
  assert.ok(texto.startsWith("%PDF-1.4"));
  assert.ok(texto.trimEnd().endsWith("%%EOF"));
  const inicioDoXref = Number(/startxref\s+(\d+)/.exec(texto)[1]);
  assert.equal(texto.slice(inicioDoXref, inicioDoXref + 4), "xref");
  const entradas = [...texto.slice(inicioDoXref).matchAll(/^(\d{10}) 00000 n ?\r?$/gm)].map((m) => Number(m[1]));
  assert.ok(entradas.length >= 5, `entradas: ${entradas.length}`);
  entradas.forEach((pos, i) => assert.ok(texto.startsWith(`${i + 1} 0 obj`, pos), `objeto ${i + 1}`));
  const titulo = /\/Title \(([^)]*)\)/.exec(texto)?.[1] || "";
  assert.ok(titulo.startsWith("Certificado de Dominio"), titulo);
  assert.ok(!/[^\x20-\x7e]/.test(titulo), "título só em ASCII");
  assert.throws(() => pdfDeJpeg(new Uint8Array([1, 2, 3]), 1, 1), /JPEG/);
});

caso("Modo Domínio: chefão-avatar não se compra, e o certificado público é a única porta sem login", () => {
  assert.equal(ORDEM_DOS_CHEFOES.length, 4);
  for (const id of ORDEM_DOS_CHEFOES) {
    assert.ok(PERSONAGENS[id]?.chefao, id);
    assert.ok(!ORDEM_DOS_PERSONAGENS.includes(id), "não aparece na loja");
    assert.equal(podeEscolherPersonagem({ id, possui: [], saldo: 1e9 }).ok, false);
    assert.deepEqual(podeEscolherPersonagem({ id, possui: [id], saldo: 0 }), { ok: true, compra: false, custo: 0 });
    assert.ok(personagensDe([id]).includes(id));
  }
  assert.ok(ehLivre("/certificado/ABCD-2345-EFGH"));
  assert.ok(ehLivre("/api/certificado/ABCD-2345-EFGH"));
  for (const fechado of ["/certificados", "/dominio", "/api/dominio", "/api/certificadoX", "/api/dominio/1/entregar"]) assert.ok(!ehLivre(fechado), fechado);
});

caso("Modo Domínio: a migração só acrescenta tipos (nenhum tipo antigo some)", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const tiposDe = (sql, restricao) => {
    const trechos = [...sql.matchAll(new RegExp(`${restricao}[\\s\\S]*?check \\(tipo in \\(([\\s\\S]*?)\\)\\)`, "g"))];
    return trechos.length ? [...trechos.at(-1)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : null;
  };
  const novos = ler("../db/018-modo-dominio.sql");
  for (const restricao of ["proof_reino_movimentos_tipo_check", "proof_eventos_tipo_check"]) {
    const agora = tiposDe(novos, restricao);
    assert.ok(agora?.includes("dominio"), `${restricao} aceita dominio`);
    let antes = null;
    for (const f of fs.readdirSync(new URL("../db/", import.meta.url)).filter((x) => /^\d{3}-.*\.sql$/.test(x) && x < "018").sort()) {
      antes = tiposDe(ler(`../db/${f}`), restricao) || antes;
    }
    assert.ok(antes, `achei a regra antiga de ${restricao}`);
    for (const t of antes) assert.ok(agora.includes(t), `${restricao}: o tipo ${t} continua`);
  }
});

// ---------------------------------------------------------------- a Mesa dos Consultores (26/10/2026)

/** Um mercado de mentira para os consultores: `n` pregões com variações parecidas com as de verdade. */
function mercadoDeTeste(n, { acoes = 10, inicio = "2026-01-01" } = {}) {
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const setores = ["Tecnologia", "Alimentos", "Magia", "Mineração", "Turismo"];
  return Array.from({ length: n }, (_, d) => ({
    dia: somarDias(inicio, d),
    acoes: Array.from({ length: acoes }, (_, i) => {
      const abertura = 10 + Math.floor(r() * 70);
      const v = Math.round((r() + r() + r() - 1.5) * 16) + (r() < 0.6 ? 2 : -1);
      return { id: `AC${i}`, nome: `Empresa ${i}`, setor: setores[i % setores.length], emoji: "🏢", abertura, fechamento: precoDepois(abertura, v) };
    }),
  }));
}

caso("consultores: seis personagens com história e jeito próprios; o segredo não vai para o navegador", () => {
  assert.equal(CONSULTORES.length, 6);
  assert.equal(new Set(IDS_DOS_CONSULTORES).size, 6);
  for (const c of CONSULTORES) {
    assert.ok(c.nome && c.titulo && c.origem && c.idade && c.metodo && c.bordao, c.id);
    assert.ok(c.historia.length > 120, `${c.id}: a história tem corpo`);
    assert.ok(c.personalidade.length >= 3, `${c.id}: personalidade`);
    assert.ok(c.faixaDeclarada > 0 && c.sobreAFaixa, `${c.id}: a faixa que diz ter`);
    assert.ok(svgDoConsultor(c.id).startsWith("<svg") && svgDoConsultor(c.id).includes("clipPath"), `${c.id}: tem retrato`);
    assert.equal(consultorPorId(c.id), c);
  }
  // o jeito de errar (projecoes.js) só pode ser importado pelo servidor: nada da tela, nada do que vai ao navegador
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  assert.ok(!/ESTILOS|humorDoDia|diaRuim|multRuim/.test(ler("../src/dominio/consultores.js")), "consultores.js não tem o segredo");
  const naTela = [];
  const varrer = (pasta) => {
    for (const e of fs.readdirSync(new URL(pasta, import.meta.url), { withFileTypes: true })) {
      const p = `${pasta}${e.name}`;
      if (e.isDirectory()) { if (p !== "../src/app/api") varrer(`${p}/`); } else if (/\.js$/.test(e.name)) naTela.push(p);
    }
  };
  varrer("../src/componentes/");
  varrer("../src/app/");
  assert.ok(naTela.length > 20);
  for (const p of naTela) assert.ok(!/from\s+["'][^"']*dominio\/projecoes/.test(ler(p)), `${p} não pode importar projecoes.js`);
});

caso("consultores: a mesma projeção para todo mundo; a margem de erro de cada um muda de dia para dia", () => {
  const acao = { id: "MARA", nome: "Maravilhas", setor: "Magia", abertura: 40, fechamento: 44 };
  assert.deepEqual(projetar("corvo", "2026-10-26", acao), projetar("corvo", "2026-10-26", { ...acao }));
  const dias = Array.from({ length: 40 }, (_, i) => somarDias("2026-10-01", i));
  const desvio = (xs) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); };
  const erros = {};
  for (const id of IDS_DOS_CONSULTORES) {
    erros[id] = dias.map((d) => humorDoDia(id, d).erro);
    assert.ok(new Set(erros[id].map((x) => x.toFixed(3))).size > 30, `${id}: o erro muda de um dia para o outro`);
    assert.ok(Math.max(...erros[id]) / Math.min(...erros[id]) > 1.5, `${id}: há dias bons e dias ruins`);
  }
  assert.ok(desvio(erros.ametista) > desvio(erros.corvo), "a Madame é a mais imprevisível; o Corvo, o mais constante");
});

caso("consultores: cada um erra do seu jeito (300 pregões simulados)", () => {
  const m = Object.fromEntries(IDS_DOS_CONSULTORES.map((id) => [id, { erro: 0, vies: 0, faixa: 0, lado: 0, proj: 0, real: 0, n: 0, alimentos: [0, 0], outros: [0, 0] }]));
  for (const { dia, acoes } of mercadoDeTeste(300)) {
    for (const a of acoes) {
      const real = variacaoReal(a.abertura, a.fechamento);
      for (const id of IDS_DOS_CONSULTORES) {
        const p = projetar(id, dia, a);
        const av = avaliar(id, p, real);
        const x = m[id];
        x.erro += av.erro; x.vies += p.variacao - real; x.faixa += av.naFaixa; x.lado += av.direcao; x.n++;
        x.proj += Math.abs(p.variacao); x.real += Math.abs(real);
        const g = a.setor === "Alimentos" ? x.alimentos : x.outros;
        g[0] += av.erro; g[1]++;
        if (id === "zuleica") assert.ok(Number.isInteger(p.variacao), "a Dona Zuleica arredonda tudo");
      }
    }
  }
  const media = (id, k) => m[id][k] / m[id].n;
  const ordem = [...IDS_DOS_CONSULTORES].sort((a, b) => media(a, "erro") - media(b, "erro"));
  assert.equal(ordem[0], "corvo", `o Corvo erra menos na média (${ordem.join(" < ")})`);
  assert.ok(media("corvo", "lado") > 0.75, "o Corvo acerta o lado na maioria das vezes");
  assert.ok(media("luna", "vies") > 2, "a Luna vê alta em tudo");
  assert.ok(media("gorgo", "vies") < -2, "o Gorgo vê crise em tudo");
  assert.ok(m.barao.proj < 0.75 * m.barao.real, "o Barão acha que o mercado anda menos do que anda");
  assert.ok(m.ametista.proj > 1.2 * m.ametista.real, "a Madame exagera");
  assert.ok(media("ametista", "faixa") < 0.25, "a Madame diz ±1% e quase nunca cai na faixa");
  assert.ok(media("barao", "faixa") > 0.5, "a faixa larga do Barão costuma conter o fechamento");
  const z = m.zuleica;
  assert.ok(z.alimentos[0] / z.alimentos[1] < z.outros[0] / z.outros[1], "de comida a Dona Zuleica entende");
  for (const id of IDS_DOS_CONSULTORES) assert.ok(media(id, "lado") > 0.55, `${id} ainda ajuda mais do que atrapalha`);
});

caso("consultores: o relatório não entrega o fechamento de hoje antes do fim do pregão", () => {
  const hoje = "2026-10-26";
  const passados = mercadoDeTeste(9, { acoes: 6, inicio: "2026-10-17" });
  // o fechamento de hoje é 7771 sobre 7000: nenhuma projeção (em décimos de ponto) dá esse preço exato
  const deHoje = [{ id: "SEGR", nome: "Segredo S.A.", setor: "Magia", emoji: "🤫", abertura: 7000, fechamento: 7771 }, ...passados[0].acoes.slice(0, 3)];
  const dias = [...passados, { dia: hoje, acoes: deHoje }];
  const numeros = (o, saida = []) => { if (typeof o === "number") saida.push(o); else if (o && typeof o === "object") for (const v of Object.values(o)) numeros(v, saida); return saida; };

  const antes = relatorioDaMesa({ hoje, revelado: false, dias });
  const texto = JSON.stringify(antes);
  assert.ok(!texto.includes("fechamento") && !texto.includes("resultado") && !texto.includes("humor"), "nada do segredo no relatório");
  assert.ok(!numeros(antes).includes(7771), "o fechamento de hoje não aparece em lugar nenhum");
  assert.equal(antes.revelado, false);
  assert.equal(antes.placarDeHoje, null);
  assert.equal(antes.consultores.length, 6);
  for (const c of antes.consultores) {
    assert.equal(c.projecoes.length, 4);
    assert.equal(c.hoje, null);
    assert.ok(c.historico.length === 7 && c.historico.every((h) => h.dia < hoje), "o placar só tem pregões fechados (os 7 últimos)");
    assert.ok(c.comentario && c.aposta?.frase.includes(c.aposta.acao));
    for (const p of c.projecoes) {
      assert.ok(p.faixa.de < p.preco && p.preco < p.faixa.ate, "a projeção fica no meio da faixa que ele declara");
      assert.ok(p.frase.includes(pctDaFala(p.variacao)), "a fala traz a variação projetada");
    }
  }
  assert.equal(antes.ultimoPregao.dia, passados.at(-1).dia);

  const depois = relatorioDaMesa({ hoje, revelado: true, dias });
  assert.equal(depois.revelado, true);
  assert.equal(depois.placarDeHoje.dia, hoje);
  assert.equal(depois.ultimoPregao.dia, passados.at(-1).dia, "o último pregão continua sendo o de ontem");
  for (const c of depois.consultores) {
    assert.ok(c.hoje && c.historico[0].dia === hoje && c.historico.length === 8);
    const s = c.projecoes.find((p) => p.acao === "SEGR");
    assert.equal(s.resultado.preco, 7771);
    assert.equal(s.resultado.variacao, 11);
    assert.deepEqual(s, { ...projetar(c.id, hoje, deHoje[0]), resultado: s.resultado }, "depois do fechamento, a projeção é a mesma de antes");
  }

  // sem pregão hoje ainda (a Lisa abrindo): sem projeções, mas o placar dos dias passados aparece
  const cedo = relatorioDaMesa({ hoje, revelado: false, dias: passados });
  assert.equal(cedo.temProjecoes, false);
  assert.ok(cedo.consultores.every((c) => c.aposta === null && c.projecoes.length === 0 && c.historico.length === 7));
});

caso("consultores: o placar dá nota 10 − erro médio e coroa quem errou menos; a aposta segue o jeito de cada um", () => {
  assert.equal(notaPeloErro(2.4), 7.6);
  assert.equal(notaPeloErro(0), 10);
  assert.equal(notaPeloErro(15), 0);
  assert.equal(pctDaFala(4.2), "+4,2%");
  assert.equal(pctDaFala(-3), "−3%");
  assert.equal(pctDaFala(0), "0%");
  assert.deepEqual([9, 3, 0, -3, -9].map(rumoDaFala), ["disparar", "subir", "lado", "cair", "despencar"]);
  const dias = mercadoDeTeste(8, { acoes: 8, inicio: "2026-10-18" });
  const hoje = dias.at(-1).dia;
  const r = relatorioDaMesa({ hoje, revelado: false, dias });
  const ranking = r.ultimoPregao.ranking;
  assert.equal(ranking.length, 6);
  for (let i = 1; i < ranking.length; i++) assert.ok(ranking[i - 1].erroMedio <= ranking[i].erroMedio, "do que errou menos para o que errou mais");
  const campeao = r.consultores.find((c) => c.id === ranking[0].id);
  assert.equal(campeao.historico[0].melhor, true);
  assert.equal(r.consultores.filter((c) => c.historico[0].melhor).length, 1, "um campeão por pregão");
  for (const c of r.consultores) {
    const vs = c.projecoes.map((p) => p.variacao);
    if (c.id === "luna" && Math.max(...vs) >= 1) assert.equal(c.aposta.variacao, Math.max(...vs), "a Luna aposta na maior alta");
    if (c.id === "gorgo" && Math.min(...vs) <= -1) assert.equal(c.aposta.variacao, Math.min(...vs), "o Gorgo aposta na maior queda");
    if (c.id === "corvo") assert.equal(Math.abs(c.aposta.variacao), Math.max(...vs.map(Math.abs)), "o Corvo aposta no maior sinal");
    assert.ok(c.resumo.pregoes === 7 && c.resumo.total === 7 * 8 && c.resumo.nota === notaPeloErro(c.resumo.erroMedio));
  }
});

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
