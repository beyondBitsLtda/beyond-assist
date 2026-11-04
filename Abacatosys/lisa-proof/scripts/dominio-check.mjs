// Testa as regras puras da Lisa_Proof: datas, ofensiva, plano da trilha e metas.
// Uso:  npm run dominio-check

import assert from "node:assert/strict";
import fs from "node:fs";
import { diaDe, somarDias, diaDaSemana, inicioDaSemana, fimDoMes, diaValido, formatarDia } from "../src/dominio/datas.js";
import { calcularOfensiva, semanaDaOfensiva } from "../src/dominio/ofensiva.js";
import { ehQuadroDeEstudo, temaDo } from "../src/dominio/estudo.js";
import {
  validarPlano, planoPadrao, agendar, montarEtapas, planoDoReplanejamento,
  normalizarDiasDeEstudo, diasEstimados,
} from "../src/dominio/plano.js";
import { resumoDasMetas, tarefasDoDia } from "../src/dominio/metas.js";
import { nivelPorPontos, MULTIPLICADOR_DE_RECOMPENSAS, PONTOS } from "../src/dominio/pontos.js";
import {
  temExemploDaLisa, validarExemploDaLisa,
  periodoDe, periodoPermitido, pontosDoQuiz, PONTOS_DA_PRATICA, arquivosDoProjeto, pontosDaNota, validarQuiz, quizParaTela,
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
import { ARTEFATOS, manaDe, pontosQueContam, podeForjar, efeitoDe, bonusDaPocao, PONTOS_POR_MANA } from "../src/dominio/forja.js";
import { CHEFOES_DA_PROCRASTINACAO, roubosVencidos, valorDoRoubo, chefaoDoAtraso, podeNascer, danoDosEstudos, danoDosCadernos, situacaoDoChefao, pesoDoAtraso, HORAS_ATE_O_PROXIMO } from "../src/dominio/chefoes.js";
import { DUELO, PERGUNTAS_DO_DUELO, montarDuelo, respostasDaLisa, perguntaParaTela, corrigir, resultadoDoDuelo, movimentosDoDuelo, podeDuelar, segundosDoDuelo } from "../src/dominio/duelo.js";
import { humorDoNeuro, diasSemEstudo, evolucaoDa, fatorDaMinaDoHumor, EVOLUCOES_DO_NEURO, DIAS_PARA_REVOLTAR } from "../src/dominio/humorDoNeuro.js";
import { TROPAS, ORDEM_DAS_TROPAS, ORDEM_DA_TRIPULACAO } from "../src/dominio/tropas.js";
import { LUGARES } from "../src/dominio/combate.js";
import { fazExpedicao } from "../src/dominio/veiculos.js";
import { ARQUIPELAGO, CONSTRUCOES_DA_ILHA, CONCHAS_POR_MOEDA, capacidadeDaTripulacao, batalhaNaIlha, desfechoNaIlha, guardasDaConquista, construcoesAposConquista, defensorDaIlha, producaoDaIlha, juntadoNaIlha, podeConstruirNaIlha, podeTreinarTripulacao, podeAtacarIlha, pactoVigente, pactoPendente, saqueDeConchas, protecaoDoBau } from "../src/dominio/ilhas.js";
import { PONTOS_DO_MINIGAME, jogoDoDia } from "../src/dominio/arena.js";
import { BUGS, SOLUCOES_DOS_BUGS, ANDARES_DA_MASMORRA, arnesDoBug, lerArnes, NIVEIS_DO_MASCOTE, CODIGO_INICIAL_DO_MASCOTE, SOLUCAO_DO_MASCOTE, simularMascote, arnesDoMascote, PUZZLES_DE_PARSONS, blocosEmbaralhados, conferirParsons, faseLiberada } from "../src/dominio/arena.js";
import { AGENDA as AGENDA_DA_LISA } from "../src/dominio/lisaJogadora.js";
import { luzDaHora, tempoDoBloco, climaDoReino, textoDoClima, agoraEmBrasilia, TEMPOS } from "../src/dominio/clima.js";
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
import { projetar, humorDoDia, avaliar, relatorioDaMesa, notaPeloErro, pctDaFala, rumoDaFala, caminhoPrevisto, DIAS_DE_PREVISOES } from "../src/dominio/projecoes.js";
import { svgDoConsultor } from "../src/componentes/bolsa/consultoresDePapel.js";
import {
  TIPOS_DE_MATERIAL, ORDEM_DOS_TIPOS, CONSTRUCOES_DO_ACERVO, CATEGORIAS_DO_ACERVO, GORJETAS, nivelDaConstrucao, nivelDaBiblioteca, recompensaDe,
  estadoDaBiblioteca, videoDoLink, linkValido, validarMaterial, podeRevisar, podeRetirar, podeAgradecer, motivoValido,
} from "../src/dominio/acervo.js";
import { svgDoFuncionario } from "../src/componentes/acervo/personagensDoAcervo.js";
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
  capacidadeDoExercito, capacidadeDaGuarnicao, podeTreinar, podeReceber, espacoUsado, somarTropas, contagens, totalDeTropas, lotacaoDoAcampamento,
} from "../src/dominio/tropas.js";
import {
  ANUNCIOS_POR_REINO, faixaDePreco, descontoSobreOTreino, podeAnunciar, podeComprarDoMercado, maximoParaComprar, podeRetirarAnuncio,
  anuncioDepoisDaVenda, ordenarOfertas,
} from "../src/dominio/mercadoDeTropas.js";
import { estatisticas, conquistasNovas, desbloqueadasDe, vitrine } from "../src/dominio/conquistas.js";
import {
  CORREIO, conferirRecado, contaDoQuiz, podeMandarPergunta, perguntaNaCarta, recompensaDoRecado, recompensaDaPergunta, podeEscreverPara,
} from "../src/dominio/correio.js";
import {
  CONTA_DA_LISA, TEMAS_DE_TECNOLOGIA, temaDoMes, sorteio as sorteioDaLisa, chanceDeAcerto, respostasDoQuiz, oQueFazerAgora, itensDaTeoriaHoje,
  melhoriaDaVez, compraNaBolsa, alvoDaInvasao, documentoDoDiagrama,
} from "../src/dominio/lisaJogadora.js";
import {
  conferirChamado, tituloDoChamado, descricaoDoChamado, relatoDoChamado, situacaoDoChamado, previsaoDoChamado, fimDaPrevisao,
  diaEmBrasilia, quemAbriu, ordenarChamados, conferirAtualizacao, TETO_DA_RESPOSTA,
} from "../src/dominio/chamado.js";
import { montarRaioX, acertosDoQuiz, horaEmSaoPaulo } from "../src/dominio/raioX.js";
import { assuntosParaODuracao, nomeDoQuadro, validarCurso, assuntosEmOrdem, resumoDoCurso } from "../src/dominio/curso.js";
import { analisar, avaliar as avaliarExpressao, equivalentes, formaAtendida, lerResposta, numeroCerto } from "../src/dominio/expressao.js";
import {
  MOTORES, motorDo, corrigeNoServidor, validarAberto, validarCalculo, corrigirCalculo, corrigirItemDeCalculo, validarDitado, compararDitado,
  corrigirDitado, embaralhar, desembaralhar, gerarOuvido, corrigirOuvido, categoriaDoOuvido, exercicioParaTela, avaliacaoDoMotor,
  conferirEvidencia, evidenciasAceitas, videoDoYoutube, LIMITES_DA_EVIDENCIA,
} from "../src/dominio/motores.js";
import { PERFIS, ORDEM_DOS_PERFIS, perfilValido, perfilPeloTema, motorDoExercicio, evidenciasDoPerfil } from "../src/dominio/perfis.js";
import { tentativasDe } from "../src/dominio/pratica.js";
import {
  gerarRitmo, corrigirRitmo, lerToques, nivelDoRitmo, gerarAfinacao, corrigirAfinacao, detectarAltura, alturaSustentada,
  centsAteANota, frequenciaDaNota, nomeDaNota,
} from "../src/dominio/musica.js";
import {
  agendaNova, revisarCartao, previsoes, quandoVolta, cartoesDoDia, resumoDosCartoes, validarCartoes, validarCartao, pontosDaRevisao,
} from "../src/dominio/cartoes.js";
import { podePedirRevisao, validarPedido, validarVeredito, podeRevisar as podeRevisarNaTurma, aplicarRevisao, atendidosPelaIA } from "../src/dominio/revisoes.js";
import { atributosDaTorre, tituloDaTorre, validarPedidoDeTema, validarDesafioDoTema, PERFIS_DE_TORRE, TORRES_DE_TEMA } from "../src/dominio/modoDominio.js";
import { secoesDoLivro, faixasDosAndares, andaresPermitidosDoLivro, paginasDaFaixa } from "../src/dominio/modoDominio.js";
import { midiDoGrau, nomeDoGrau, pautaDoAssunto, gerarLeitura, corrigirLeitura } from "../src/dominio/musica.js";
import { validarPassos, corrigirItemDePassos, corrigirPassos, passosParaTela, lerLinhas } from "../src/dominio/passos.js";
import {
  gerarGrafico, categoriaDoGrafico, formatarPolinomio, graficoParaTela, corrigirItemDeGrafico, lerPontos, inicioDosPontos,
} from "../src/dominio/grafico.js";
import { validarConversa, validarRespostaDaLisa, turnosDe, podeFalar, podeEncerrar, validarMensagem } from "../src/dominio/conversa.js";
import { gerarSenha, precisaDeSenha, entregaTemMidia, aplicarSenha, TETO_SEM_SENHA } from "../src/dominio/senha.js";
import { validarEntradaDoDiario, pontosFracos, chaveDoDiario } from "../src/dominio/diario.js";
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
import {
  TIPOS_DE_DIAGRAMA, ORDEM_DOS_DIAGRAMAS, NOMES_DAS_FORMAS, NOTACAO_DO_TIPO, LIMITES_DO_DIAGRAMA, validarDesafioDeDiagrama,
  conferirDiagrama, descreverDiagrama, pedeDiagrama, motoresComDiagrama, tiposSugeridos, formasDoTipo,
} from "../src/dominio/diagramas.js";

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
  // o triplo desde 26/10/2026: 15 por acerto, 30 de bônus, projeto da semana 450; o exercício do dia, o
  // triplo de novo desde 03/11/2026 (BEYOND-0017): 360 com nota 100, metade na 2ª e na 3ª rodada
  assert.equal(pontosDoQuiz(5, 5), 105);
  assert.equal(pontosDoQuiz(3, 5), 45);
  assert.equal(pontosDaNota("projeto_semanal", 80), 360);
  assert.equal(pontosDaNota("exercicio", 150), 360);
  assert.equal(pontosDaNota("exercicio", 50), 180);
  assert.equal(comFatorDaRodada(pontosDaNota("exercicio", 100), 2), 180);
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
  assert.equal(relatoDoChamado(d), "a pergunta 5 veio sem código", "a tela mostra só o relato, sem e-mail nem aparelho");
});
caso("chamados (BEYOND-0015): a coluna vira o status e o prazo vira a previsão", () => {
  assert.equal(situacaoDoChamado({ coluna: "Novos" }), "aberto");
  assert.equal(situacaoDoChamado({ coluna: "Em análise" }), "analise");
  assert.equal(situacaoDoChamado({ coluna: "Resolvidos" }), "resolvido");
  assert.equal(situacaoDoChamado({ coluna: "Em análise", concluido: true }), "resolvido", "o concluído do Abacato vale");
  assert.equal(situacaoDoChamado({ coluna: "Aguardando peça" }), "analise", "coluna que alguém criou: em análise");
  const agora = new Date("2026-11-03T15:00:00Z");
  assert.deepEqual(previsaoDoChamado({ fimEm: null, situacao: "aberto", agora }), { texto: "sem previsão ainda", atrasada: false });
  assert.deepEqual(previsaoDoChamado({ fimEm: fimDaPrevisao("2026-11-05"), situacao: "analise", agora }), { texto: "previsto para 05/11", atrasada: false });
  assert.deepEqual(previsaoDoChamado({ fimEm: fimDaPrevisao("2026-11-01"), situacao: "analise", agora }), { texto: "era para 01/11", atrasada: true });
  assert.equal(previsaoDoChamado({ fimEm: fimDaPrevisao("2026-11-01"), situacao: "resolvido", agora }), null, "resolvido não tem previsão");
  assert.equal(fimDaPrevisao("2026-11-05"), "2026-11-05T21:00:00.000Z", "18:00 em Brasília");
  assert.equal(diaEmBrasilia("2027-01-10T21:00:00Z", agora), "10/01/2027", "outro ano leva o ano");
  assert.equal(quemAbriu("u-123/1730000000000"), "u-123");
});
caso("chamados: em aberto primeiro (previsão mais perto antes), resolvidos depois", () => {
  const c = (id, situacao, criadoEm, fimEm = null) => ({ id, situacao, criadoEm, fimEm });
  const ordem = ordenarChamados([
    c("r1", "resolvido", "2026-11-01"), c("a1", "aberto", "2026-10-30"), c("a2", "analise", "2026-11-02", "2026-11-04T21:00:00Z"),
    c("r2", "resolvido", "2026-11-02"), c("a3", "aberto", "2026-10-29"),
  ]).map((x) => x.id);
  assert.deepEqual(ordem, ["a2", "a3", "a1", "r2", "r1"]);
});
caso("chamados: o que o técnico manda é conferido", () => {
  const coluna = "6f1c2a3b-1111-4222-8333-944455556666";
  assert.deepEqual(conferirAtualizacao({ colunaId: coluna }), { ok: true, mudancas: { colunaId: coluna } });
  assert.deepEqual(conferirAtualizacao({ previsao: "2026-11-05" }), { ok: true, mudancas: { previsao: "2026-11-05" } });
  assert.deepEqual(conferirAtualizacao({ previsao: "" }), { ok: true, mudancas: { previsao: "" } }, "vazio tira a previsão");
  assert.equal(conferirAtualizacao({ previsao: "amanhã" }).ok, false);
  assert.equal(conferirAtualizacao({ colunaId: "x' or 1=1" }).ok, false);
  assert.equal(conferirAtualizacao({ resposta: "x".repeat(TETO_DA_RESPOSTA + 1) }).ok, false);
  assert.equal(conferirAtualizacao({ resposta: "   " }).ok, false, "resposta em branco não conta");
  assert.equal(conferirAtualizacao({}).ok, false);
});
caso("chamados: as rotas, a tela no menu, e só o técnico muda", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const lib = ler("../src/lib/chamados.js");
  assert.match(lib, /if \(admin\.id !== usuario\.id\) throw new ErroDeAcesso\(403, "só o técnico muda um chamado"\)/);
  assert.match(lib, /consulta = consulta\.like\("origem_id", `\$\{usuario\.id\}\/%`\)/, "quem não é técnico só vê os seus");
  assert.match(lib, /card\.abacato_colunas\?\.quadro_id !== quadroId\) throw new ErroDeAcesso\(404/, "só card do quadro de chamados");
  assert.match(lib, /\.\.\.\(tecnico \? \{ quem:/, "o nome de quem abriu só vai para o técnico");
  assert.match(ler("../src/app/api/chamados/route.js"), /export async function GET\(req\)[\s\S]*listarChamados\(usuario\)/);
  assert.match(ler("../src/app/api/chamados/[id]/route.js"), /export async function PATCH\(req, \{ params \}\)[\s\S]*atualizarChamado\(usuario, id, corpo\)/);
  assert.match(ler("../src/componentes/Moldura.js"), /\{ href: "\/chamados", rotulo: "Chamados", Icone: IconeChamados, grupo: "Você" \}/);
  assert.match(ler("../src/app/layout.js"), /import "\.\/chamados\.css";/);
  assert.match(ler("../src/componentes/ReportarProblema.js"), /<Link href="\/chamados"/);
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
  // 14 na loja: os 12 de antes (os 5 dos ambientes das expedições estrearam em 23/10/2026), a Lisa,
  // o mascote da marca, de graça (31/10/2026), e o Raposão (03/11/2026, 🪙 610 — o prêmio do Viana).
  // Os chefões do Modo Domínio (24/10/2026) não se compram: ficam fora da loja.
  const daLoja = Object.keys(PERSONAGENS).filter((id) => !PERSONAGENS[id].chefao);
  assert.equal(daLoja.length, 14);
  assert.equal(PERSONAGENS.raposao.preco, 610);
  // a vitrine mostra todos os da loja, uma vez cada, do mais barato ao mais caro
  assert.deepEqual([...ORDEM_DOS_PERSONAGENS].sort(), daLoja.sort());
  const precos = ORDEM_DOS_PERSONAGENS.map((id) => PERSONAGENS[id].preco);
  assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
  for (const id of ["cogumelo", "mergulhador", "yeti", "magma", "alienigena"]) assert.ok(PERSONAGENS[id].preco > 0, id);
  assert.deepEqual(personagensDe([]), ["neuro", "abacato", "lisa"]);
  assert.deepEqual(personagensDe(["ninja", "inventado", "ninja"]), ["neuro", "abacato", "lisa", "ninja"]);
  // a Lisa (o mascote da marca) também é de graça e de todo mundo
  assert.equal(PERSONAGENS.lisa.preco, 0);
  assert.deepEqual(podeEscolherPersonagem({ id: "lisa", possui: [], saldo: 0 }), { ok: true, compra: false, custo: 0 });
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

caso("mercado de tropas: o preço vai de 20% ao custo do treino; anunciar libera o espaço", () => {
  assert.deepEqual(faixaDePreco("guerreiro"), { minimo: 2, maximo: 10, sugerido: 6 });
  assert.deepEqual(faixaDePreco("dragao"), { minimo: 76, maximo: 380, sugerido: 228 });
  assert.equal(descontoSobreOTreino("arqueira", 12), 40);
  const reservas = { exercito: { gigante: 3, guerreiro: 10 }, guarnicao: { arqueira: 4 } };
  assert.deepEqual(podeAnunciar({ tropa: "gigante", quantidade: 2, preco: 60, origem: "exercito", reservas }), { ok: true, quantidade: 2, preco: 60, libera: 10 });
  assert.match(podeAnunciar({ tropa: "gigante", quantidade: 4, preco: 60, origem: "exercito", reservas }).motivo, /só 3 Gigante/);
  assert.match(podeAnunciar({ tropa: "gigante", quantidade: 1, preco: 60, origem: "guarnicao", reservas }).motivo, /não há Gigante na defesa/);
  assert.match(podeAnunciar({ tropa: "arqueira", quantidade: 1, preco: 21, origem: "guarnicao", reservas }).motivo, /de 4 a 20 moedas/, "nunca mais caro que treinar");
  assert.match(podeAnunciar({ tropa: "arqueira", quantidade: 1, preco: 3, origem: "guarnicao", reservas }).motivo, /de 4 a 20/);
  assert.match(podeAnunciar({ tropa: "arqueira", quantidade: 1, preco: 4.5, origem: "guarnicao", reservas }).motivo, /de 4 a 20/, "preço inteiro");
  assert.match(podeAnunciar({ tropa: "arqueira", quantidade: 0, preco: 10, origem: "guarnicao", reservas }).motivo, /de 1 a 60/);
  assert.match(podeAnunciar({ tropa: "arqueira", quantidade: 1, preco: 10, origem: "quartel", reservas }).motivo, /exército ou da defesa/);
  assert.match(podeAnunciar({ tropa: "arqueira", quantidade: 1, preco: 10, origem: "guarnicao", reservas, abertos: ANUNCIOS_POR_REINO }).motivo, /já tem 10 anúncios/);
});

caso("mercado de tropas: comprar segue as regras do treino (sem o custo dele) e paga o preço do anúncio", () => {
  const anuncio = { id: "a1", vendedor_id: "vendedor", tropa: "gigante", origem: "exercito", quantidade: 3, restante: 3, preco: 60, status: "aberta" };
  const niveis = { quartel: 2, castelo: 2, acampamento: 1 };
  const base = { anuncio, usuarioId: "eu", niveis, reservas: {}, saldo: 1000 };
  assert.deepEqual(podeComprarDoMercado({ ...base, quantidade: 2, destino: "exercito" }), { ok: true, custo: 120, quantidade: 2 });
  assert.match(podeComprarDoMercado({ ...base, usuarioId: "vendedor", quantidade: 1, destino: "exercito" }).motivo, /são suas/);
  assert.match(podeComprarDoMercado({ ...base, quantidade: 4, destino: "exercito" }).motivo, /só sobraram 3/);
  assert.match(podeComprarDoMercado({ ...base, quantidade: 1, destino: "exercito", niveis: { quartel: 1, castelo: 2 } }).motivo, /Quartel no nível 2/, "a tropa pede o nível da construção");
  assert.match(podeComprarDoMercado({ ...base, quantidade: 1, destino: "exercito", niveis: { quartel: 0, castelo: 2 } }).motivo, /construa o Quartel/);
  assert.equal(podeComprarDoMercado({ ...base, quantidade: 1, destino: "guarnicao" }).ok, true, "o gigante defende");
  assert.match(podeComprarDoMercado({ ...base, anuncio: { ...anuncio, tropa: "balao" }, niveis: { quartel: 5, castelo: 5 }, quantidade: 1, destino: "guarnicao" }).motivo, /não serve para defesa/);
  assert.match(podeComprarDoMercado({ ...base, quantidade: 1, destino: "exercito", reservas: { exercito: { guerreiro: 28 } } }).motivo, /só cabe mais 2/, "o espaço do exército");
  assert.match(podeComprarDoMercado({ ...base, quantidade: 1, destino: "guarnicao", reservas: { exercito: { guerreiro: 30 }, guarnicao: { arqueira: 7 } } }).motivo, /Acampamento está lotado/);
  assert.match(podeComprarDoMercado({ ...base, quantidade: 2, destino: "exercito", saldo: 100 }).motivo, /faltam 20/);
  assert.match(podeComprarDoMercado({ ...base, anuncio: { ...anuncio, status: "retirada" }, quantidade: 1, destino: "exercito" }).motivo, /vendido ou retirado/);
  assert.match(podeComprarDoMercado({ ...base, anuncio: null, quantidade: 1, destino: "exercito" }).motivo, /vendido ou retirado/);
  // o máximo de agora: o que cabe e o que o saldo paga
  assert.deepEqual(maximoParaComprar({ ...base, destino: "exercito" }), { maximo: 3, motivo: "" });
  assert.deepEqual(maximoParaComprar({ ...base, destino: "exercito", saldo: 130 }), { maximo: 2, motivo: "" });
  assert.equal(maximoParaComprar({ ...base, destino: "guarnicao" }).maximo, 2, "a defesa da Torre nível 2 tem 12 de espaço");
  assert.match(maximoParaComprar({ ...base, destino: "exercito", saldo: 10 }).motivo, /faltam 50/);
  // vender parte deixa o anúncio aberto; vender tudo fecha
  assert.deepEqual(anuncioDepoisDaVenda(anuncio, 2), { restante: 1, status: "aberta" });
  assert.deepEqual(anuncioDepoisDaVenda(anuncio, 3), { restante: 0, status: "vendida" });
});

caso("mercado de tropas: retirar devolve à reserva de origem, se couber; a vitrine sai na ordem das tropas e do preço", () => {
  const anuncio = { id: "a1", vendedor_id: "eu", tropa: "arqueira", origem: "guarnicao", quantidade: 5, restante: 4, preco: 10, status: "aberta" };
  const niveis = { quartel: 1, castelo: 1, acampamento: 1 };
  assert.deepEqual(podeRetirarAnuncio({ anuncio, usuarioId: "eu", niveis, reservas: {} }), { ok: true, quantidade: 4 });
  assert.match(podeRetirarAnuncio({ anuncio, usuarioId: "outro", niveis, reservas: {} }).motivo, /não é seu/);
  assert.match(podeRetirarAnuncio({ anuncio, usuarioId: "eu", niveis, reservas: { guarnicao: { guerreiro: 6 } } }).motivo, /não cabem de volta: só cabe mais 2/);
  assert.match(podeRetirarAnuncio({ anuncio: { ...anuncio, status: "vendida", restante: 0 }, usuarioId: "eu", niveis, reservas: {} }).motivo, /vendido ou retirado/);
  const vitrine = ordenarOfertas([
    { id: "d", tropa: "dragao", preco: 200, criado_em: "2026-10-30T10:00:00Z" },
    { id: "g2", tropa: "guerreiro", preco: 8, criado_em: "2026-10-30T09:00:00Z" },
    { id: "g1", tropa: "guerreiro", preco: 5, criado_em: "2026-10-30T11:00:00Z" },
    { id: "g3", tropa: "guerreiro", preco: 8, criado_em: "2026-10-30T08:00:00Z" },
  ]);
  assert.deepEqual(vitrine.map((o) => o.id), ["g1", "g3", "g2", "d"]);
  // o treino continua igual depois de ganhar o podeReceber
  assert.deepEqual(podeReceber({ tropa: "guerreiro", quantidade: 3, destino: "exercito", niveis, reservas: {} }), { ok: true, quantidade: 3 });
  assert.deepEqual(podeTreinar({ tropa: "guerreiro", quantidade: 3, destino: "exercito", niveis, reservas: {}, saldo: 30 }), { ok: true, custo: 30, quantidade: 3 });
});

caso("mercado de tropas: os anúncios dos robôs de teste respeitam as regras, e a migração 021 só acrescenta tipos", () => {
  for (const r of RIVAIS_DE_TESTE) {
    for (const t of r.tropas || []) {
      const pode = podeAnunciar({ ...t, reservas: { [t.origem]: { [t.tropa]: t.quantidade } } });
      assert.equal(pode.ok, true, `${r.nome}: ${pode.motivo}`);
    }
  }
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const tipos = (sql) => [...sql.match(/proof_reino_movimentos_tipo_check\s+check \(tipo in \(([\s\S]*?)\)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const antes = tipos(ler("../db/020-biblioteca-colaborativa.sql"));
  const agora = tipos(ler("../db/021-mercado-de-tropas.sql"));
  for (const t of antes) assert.ok(agora.includes(t), `o tipo ${t} continua`);
  for (const t of ["mercado_compra", "mercado_venda"]) assert.ok(agora.includes(t), `entra o tipo ${t}`);
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
  // os veículos novos: pelo menos três lugares cada, de níveis diferentes (desde 03/11/2026, BEYOND-0020,
  // o submarino e o dirigível ganharam um quarto lugar, e a dificuldade nunca desce dentro do veículo)
  for (const v of ["submarino", "dirigivel", "tanque"]) {
    const lugares = EXPEDICOES.filter((x) => veiculoDa(x) === v);
    assert.ok(lugares.length >= 3, v);
    assert.ok(new Set(lugares.map((x) => x.dificuldade)).size >= 3, `${v}: três níveis pelo menos`);
    assert.ok(lugares.every((x, i) => !i || x.dificuldade >= lugares[i - 1].dificuldade), `${v}: a dificuldade não desce`);
  }
  // os lugares novos usam o cenário de um lugar que já existe
  for (const x of EXPEDICOES.filter((e) => e.cenario)) assert.ok(EXPEDICOES.some((e) => e.id === x.cenario), `${x.id}: cenário ${x.cenario}`);
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
  // cada tabela do jogo tem a gêmea de teste numa migração (a 016 criou as primeiras; as tabelas novas trazem a sua)
  const migracao = fs.readdirSync(new URL("../db/", import.meta.url)).filter((f) => f >= "016" && f.endsWith(".sql")).map((f) => ler(`../db/${f}`)).join("\n");
  for (const t of tabelas) assert.ok(migracao.includes(`${t.replace(/^proof_/, "proof_teste_")} `) && migracao.includes(`like public.${t} `), `gêmea de ${t}`);
});

caso("bolsa: quem tinha ações de quem sai da bolsa recebe uma vez só, e a carteira avisa (chamado \"a ação Astro sumiu\")", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const bolsa = ler("../src/lib/bolsa.js");
  const devolver = bolsa.slice(bolsa.indexOf("async function devolverPosicoes("), bolsa.indexOf("async function jaResgatou("));
  // paga ANTES de zerar (cair no meio deixa a posição cheia para a retomada), sem pagar duas vezes, e confere os erros
  assert.ok(devolver.indexOf('tipo: "bolsa_resgate"') < devolver.indexOf("update({ quantidade: 0, custo: 0 })"), "o pagamento vem antes de zerar a posição");
  assert.match(devolver, /if \(total > 0 && !\(await jaResgatou\(p\.usuario_id, acao\.id\)\)\)/);
  assert.match(devolver, /falhou\(error, "resgate da bolsa"\)/);
  assert.match(devolver, /falhou\(ordem\.error, "ordem de resgate"\)/);
  assert.match(bolsa, /\.eq\("tipo", "bolsa_resgate"\)\.eq\("detalhe->>acao", acaoId\)/);
  // a carteira mostra as empresas minhas que saíram nos últimos dias, com o quanto entrou
  assert.match(bolsa, /\.in\("tipo", \["resgate", "falencia"\]\)/);
  assert.match(bolsa, /minhasSaidas: await comNomes\(/);
  const terminal = ler("../src/componentes/bolsa/Terminal.js");
  assert.match(terminal, /fechou o capital: você recebeu <strong>🪙 \{moedas\(s\.total\)\}<\/strong>/);
  assert.match(terminal, /as suas \{s\.quantidade\} ações viraram pó/);
});

caso("reino: cobrar e gravar numa transação só, nos dois mundos (a Mina de Ouro paga que não subiu de nível)", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const reino = ler("../src/lib/reino.js");
  const lancarEGravar = reino.slice(reino.indexOf("async function lancarEGravar("), reino.indexOf("// ---------------------------------------------------------------- moedas de fora do Reino"));
  // um pedido só ao banco: nada de lançar e depois gravar (cancelar no meio deixava a cobrança sem a melhoria)
  assert.match(lancarEGravar, /db\.rpc\("proof_lancar_e_gravar", \{/);
  assert.ok(!/\blancar\(|gravarReino\(|desfazerLancamentos\(/.test(lancarEGravar), "lancarEGravar não lança nem grava em pedidos separados");
  assert.match(lancarEGravar, /if \(!gravou\) throw conflito\(\);/);
  // o mundo vai junto em toda função do banco
  assert.match(ler("../src/lib/mundo.js"), /rpc: \(nome, args\) => supabase\.rpc\(nome, \{ \.\.\.args, p_teste: emTeste\(\) \}\)/);
  const sql = ler("../db/025-reino-cobra-e-grava-junto.sql");
  assert.match(sql, /create or replace function public\.proof_lancar_e_gravar\(\s*p_teste boolean, p_usuario uuid, p_versao integer, p_mudancas jsonb, p_lancamentos jsonb/);
  assert.match(sql, /'proof_teste_reinos' else 'proof_reinos'/);
  assert.match(sql, /'proof_teste_reino_movimentos' else 'proof_reino_movimentos'/);
  assert.match(sql, /where r\.usuario_id = \$2 and r\.versao = \$3/, "só grava a versão que foi lida");
  assert.ok(sql.indexOf("if gravou <> 1 then") < sql.indexOf("insert into public.%I (usuario_id, tipo, valor, detalhe)"), "só lança depois de gravar o reino, na mesma transação");
  assert.match(sql, /revoke all on function public\.proof_lancar_e_gravar\(boolean, uuid, integer, jsonb, jsonb\) from public, anon, authenticated/);
  // o estorno entra nos dois livros-caixa
  for (const t of ["proof_reino_movimentos_tipo_check", "proof_teste_reino_movimentos_tipo_check"]) {
    const bloco = sql.slice(sql.indexOf(`add constraint ${t}`));
    assert.match(bloco.slice(0, bloco.indexOf(";")), /'mercado_venda', 'estorno'\)/, t);
  }
  // a tela faz um pedido do reino de cada vez
  const pagina = ler("../src/app/(app)/reino/page.js");
  for (const f of ["agir", "agirNoMercado"]) {
    const corpo = pagina.slice(pagina.indexOf(`async function ${f}(`));
    assert.match(corpo.slice(0, 200), /if \(pedindoRef\.current\) return;\s*pedindoRef\.current = true;/, f);
  }
  assert.match(pagina, /ocupado=\{ocupado === c\.chave\} travado=\{!!ocupado\}/);
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
  // o Navio (Temporada das Ilhas, 03/11/2026) entrou no fim da fila: com os cinco de antes, o prêmio é ele
  assert.equal(veiculoDoPremio(["barco", "submarino", "dirigivel", "tanque", "nave"]), "navio");
  assert.equal(veiculoDoPremio(["barco", "submarino", "dirigivel", "tanque", "nave", "navio"]), null);
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
    assert.deepEqual(s, { ...projetar(c.id, hoje, deHoje[0]), horas: s.horas, resultado: s.resultado }, "depois do fechamento, a projeção é a mesma de antes");
    assert.deepEqual(s.horas, antes.consultores.find((x) => x.id === c.id).projecoes.find((p) => p.acao === "SEGR").horas, "e a previsão hora a hora também");
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

caso("consultores: a previsão hora a hora vai da abertura ao fechamento projetado, no traço de cada um", () => {
  const dias = mercadoDeTeste(20, { acoes: 8, inicio: "2026-10-07" });
  const hoje = dias.at(-1).dia;
  const r = relatorioDaMesa({ hoje, revelado: false, dias });
  const torto = {}; // o quanto a previsão foge da linha reta, em média
  for (const c of r.consultores) {
    torto[c.id] = 0;
    for (const p of c.projecoes) {
      const a = dias.at(-1).acoes.find((x) => x.id === p.acao);
      assert.equal(p.horas.length, PASSOS_DO_DIA + 1, "uma previsão para cada hora do pregão");
      assert.equal(p.horas[0], a.abertura, "começa na abertura");
      assert.equal(p.horas.at(-1), c.id === "zuleica" ? Math.max(1, Math.round(p.preco)) : p.preco, "termina no fechamento projetado");
      if (c.id === "zuleica") assert.ok(p.horas.slice(1).every(Number.isInteger), "a Dona Zuleica arredonda até as horas");
      assert.deepEqual(p.horas, caminhoPrevisto(c.id, hoje, a, p), "a mesma previsão para todo mundo");
      p.horas.forEach((v, i) => { const reta = a.abertura * Math.pow(p.preco / a.abertura, i / PASSOS_DO_DIA); torto[c.id] += Math.abs(v - reta) / reta; });
    }
  }
  assert.ok(torto.barao < torto.corvo && torto.corvo < torto.ametista, "o Barão traça uma régua; a Madame, um drama");
  // as previsões dos pregões passados (para as velas): só dias fechados, os 14 mais recentes, todos os consultores
  const dp = r.previsoesDosPregoes;
  const diasComPrevisao = [...new Set(Object.values(dp).flatMap((porDia) => Object.keys(porDia)))].sort();
  assert.equal(diasComPrevisao.length, DIAS_DE_PREVISOES);
  assert.ok(diasComPrevisao.every((d) => d < hoje), "o dia de hoje fica nas projeções, não no passado");
  assert.equal(diasComPrevisao[0], dias.at(-1 - DIAS_DE_PREVISOES).dia);
  const ontem = dias.at(-2);
  for (const a of ontem.acoes) {
    for (const id of IDS_DOS_CONSULTORES) assert.equal(dp[a.id][ontem.dia][id], projetar(id, ontem.dia, a).preco);
  }
});

// ---------------------------------------------------------------- a Biblioteca Colaborativa (26/10/2026)

const HASH_DE_TESTE = "a".repeat(64);

caso("acervo: quatro tipos, cada um com a sua construção e quem cuida dela", () => {
  assert.deepEqual(ORDEM_DOS_TIPOS, ["livro", "artigo", "videoaula", "video"]);
  assert.deepEqual(ORDEM_DOS_TIPOS.map((t) => TIPOS_DE_MATERIAL[t].recompensa), [300, 250, 150, 120], "o livro vale mais que o vídeo");
  for (const t of ORDEM_DOS_TIPOS) {
    const c = CONSTRUCOES_DO_ACERVO[t];
    assert.ok(c.nome && c.personagem.nome && c.personagem.cargo, t);
    assert.ok(c.personagem.falas.length >= 3, `${t}: falas`);
    assert.ok(svgDoFuncionario(c.personagem.id).startsWith("<svg"), `${t}: tem desenho`);
  }
  assert.ok(CATEGORIAS_DO_ACERVO.includes("Outros"));
});

caso("acervo: a biblioteca e as construções sobem de nível, e a recompensa sobe junto", () => {
  assert.deepEqual(nivelDaConstrucao(0), { nivel: 1, proximo: 1, faltam: 1 });
  assert.deepEqual(nivelDaConstrucao(1), { nivel: 2, proximo: 3, faltam: 2 });
  assert.deepEqual(nivelDaConstrucao(45), { nivel: 10, proximo: null, faltam: 0 });
  assert.deepEqual(nivelDaConstrucao(999), { nivel: 10, proximo: null, faltam: 0 });
  assert.equal(nivelDaBiblioteca(0).nivel, 1);
  assert.equal(nivelDaBiblioteca(7).nivel, 2);
  assert.equal(nivelDaBiblioteca(8).nivel, 3);
  assert.equal(nivelDaBiblioteca(150).nivel, 10);
  assert.equal(recompensaDe("livro", 1), 300);
  assert.equal(recompensaDe("livro", 10), 570, "no nível 10, 1,9×");
  assert.equal(recompensaDe("video", 3), 144);
  assert.equal(recompensaDe("inventado", 3), 0);
  const e = estadoDaBiblioteca({ livro: 3, video: 5 });
  assert.equal(e.total, 8);
  assert.equal(e.nivel, 3);
  assert.equal(e.construcoes.livro.nivel, 3);
  assert.equal(e.construcoes.artigo.nivel, 1);
  assert.equal(e.recompensas.livro, 360);
  assert.equal(e.proximo, 15);
  assert.equal(e.faltam, 7);
});

caso("acervo: os links de vídeo do YouTube e do Vimeo (e o que não é vídeo)", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [`https://www.youtube.com/watch?v=${id}&t=10s`, `https://youtu.be/${id}`, `https://youtube.com/shorts/${id}`, `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/embed/${id}`]) {
    const v = videoDoLink(url);
    assert.equal(v?.plataforma, "youtube", url);
    assert.equal(v.id, id, url);
    assert.equal(v.embed, `https://www.youtube-nocookie.com/embed/${id}`);
    assert.equal(v.miniatura, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  }
  assert.deepEqual(videoDoLink("https://vimeo.com/76979871"), { plataforma: "vimeo", id: "76979871", embed: "https://player.vimeo.com/video/76979871", miniatura: null });
  for (const ruim of ["javascript:alert(1)", "https://exemplo.com/video", "youtube.com/watch?v=" + id, "https://www.youtube.com/watch?v=curto", "", null]) {
    assert.equal(videoDoLink(ruim), null, String(ruim));
  }
  assert.equal(linkValido("https://doi.org/10.1000/182"), "https://doi.org/10.1000/182");
  assert.equal(linkValido("ftp://x.com/a"), null);
  assert.equal(linkValido("https://com"), null);
});

caso("acervo: o que vale como envio (e o que acusa duplicado)", () => {
  const base = { titulo: "Cálculo I — Volume 1", categoria: "Matemática", assunto: "limites" };
  const pdf = { tamanho: 1000, paginas: 12, hash: HASH_DE_TESTE, sumario: [{ titulo: "Cap. 1", pagina: 1, nivel: 1 }, { titulo: "fora", pagina: 99, nivel: 1 }] };
  const livro = validarMaterial({ ...base, tipo: "livro", pdf });
  assert.equal(livro.ok, true, livro.erros?.join("; "));
  assert.deepEqual(livro.material.pdf.sumario, [{ titulo: "Cap. 1", pagina: 1, nivel: 1 }], "o sumário só com páginas que existem");
  assert.equal(livro.chave, "livro:calculo i volume 1");
  assert.equal(validarMaterial({ ...base, tipo: "livro", titulo: "calculo I volume 1!!", pdf }).chave, livro.chave, "o mesmo título, escrito de outro jeito, é duplicado");
  assert.match(validarMaterial({ ...base, tipo: "livro" }).erros.join(), /escolha o PDF/);
  assert.match(validarMaterial({ ...base, tipo: "livro", pdf: { ...pdf, hash: "x" } }).erros.join(), /conferir o PDF/);
  assert.match(validarMaterial({ ...base, tipo: "livro", pdf: { ...pdf, tamanho: 60 * 1024 * 1024 } }).erros.join(), /50 MB/);
  assert.equal(validarMaterial({ ...base, tipo: "artigo", link: "https://doi.org/10.1000/182" }).ok, true, "artigo por link");
  assert.equal(validarMaterial({ ...base, tipo: "artigo", pdf }).ok, true, "artigo em PDF");
  assert.match(validarMaterial({ ...base, tipo: "artigo" }).erros.join(), /PDF ou cole o link/);
  const v = validarMaterial({ ...base, tipo: "videoaula", link: "https://youtu.be/dQw4w9WgXcQ" });
  assert.equal(v.ok, true);
  assert.equal(v.chave, "video:youtube:dQw4w9WgXcQ", "o mesmo vídeo é duplicado, com qualquer título");
  assert.match(validarMaterial({ ...base, tipo: "video", link: "https://exemplo.com" }).erros.join(), /YouTube ou Vimeo/);
  assert.match(validarMaterial({ ...base, tipo: "livro", categoria: "Culinária", pdf }).erros.join(), /categoria/);
  assert.match(validarMaterial({ ...base, tipo: "livro", titulo: "ab", pdf }).erros.join(), /nome/);
  assert.match(validarMaterial({ ...base, tipo: "inventado" }).erros.join(), /tipo/);
  assert.equal(validarMaterial({ ...base, tipo: "livro", pdf, capa: "data:text/html;base64,AAAA" }).material.capa, null, "capa só de imagem");
  assert.equal(validarMaterial({ ...base, tipo: "livro", pdf, capa: "data:image/jpeg;base64,AAAA" }).material.capa, "data:image/jpeg;base64,AAAA");
});

caso("acervo: quem revisa, quem retira e quem agradece", () => {
  const dono = { id: "dono", papel: "dono" }, lider = { id: "lider", papel: "lider" };
  const pendente = (autor) => ({ autor_id: autor, status: "pendente" });
  assert.equal(podeRevisar({ usuarioId: "alguem", material: pendente("x"), bibliotecarios: [dono, lider] }).ok, false, "só bibliotecário");
  assert.equal(podeRevisar({ usuarioId: "lider", material: pendente("x"), bibliotecarios: [dono, lider] }).ok, true);
  assert.match(podeRevisar({ usuarioId: "lider", material: pendente("lider"), bibliotecarios: [dono, lider] }).motivo, /outro bibliotecário/, "o próprio envio fica para o outro");
  assert.equal(podeRevisar({ usuarioId: "dono", material: pendente("dono"), bibliotecarios: [dono] }).ok, true, "sozinho, revisa o próprio");
  assert.equal(podeRevisar({ usuarioId: "dono", material: pendente("dono"), bibliotecarios: [dono, lider] }).ok, true, "o administrador libera o próprio envio, mesmo com o líder da semana");
  assert.equal(podeRevisar({ usuarioId: "lider", material: pendente("lider"), bibliotecarios: [lider] }).ok, true, "o líder sozinho também");
  assert.equal(podeRevisar({ usuarioId: "dono", material: { autor_id: "x", status: "aprovado" }, bibliotecarios: [dono] }).ok, false, "só o que está na fila");
  assert.equal(podeRetirar({ usuarioId: "dono", material: { status: "aprovado" }, bibliotecarios: [dono] }).ok, true);
  assert.equal(podeRetirar({ usuarioId: "dono", material: { status: "pendente" }, bibliotecarios: [dono] }).ok, false);
  assert.equal(podeRetirar({ usuarioId: "alguem", material: { status: "aprovado" }, bibliotecarios: [dono] }).ok, false);
  const aprovado = { autor_id: "autor", status: "aprovado" };
  assert.deepEqual(podeAgradecer({ usuarioId: "leitor", material: aprovado, moedas: 25, saldo: 100, jaAgradeceu: false }), { ok: true, moedas: 25 });
  assert.match(podeAgradecer({ usuarioId: "autor", material: aprovado, moedas: 25, saldo: 100 }).motivo, /si mesmo/);
  assert.match(podeAgradecer({ usuarioId: "leitor", material: aprovado, moedas: 25, saldo: 100, jaAgradeceu: true }).motivo, /já agradeceu/);
  assert.match(podeAgradecer({ usuarioId: "leitor", material: aprovado, moedas: 7, saldo: 100 }).motivo, /gorjeta/);
  assert.match(podeAgradecer({ usuarioId: "leitor", material: aprovado, moedas: 50, saldo: 20 }).motivo, /faltam 30 moedas/);
  assert.match(podeAgradecer({ usuarioId: "leitor", material: { ...aprovado, status: "pendente" }, moedas: 10, saldo: 100 }).motivo, /não está no acervo/);
  assert.deepEqual(GORJETAS, [10, 25, 50]);
  assert.equal(motivoValido("  ok "), null, "motivo de verdade (5 letras ou mais)");
  assert.equal(motivoValido("PDF incompleto"), "PDF incompleto");
});

console.log("\ncursos que não são de programação");
caso("expressões: lê a escrita do dia a dia (vírgula, ², √, multiplicação implícita) e avalia certo", () => {
  assert.equal(avaliarExpressao(analisar("2x^2 - 3x + 1"), 2), 3);
  assert.equal(avaliarExpressao(analisar("(x-2)(x-3)"), 4), 2);
  assert.equal(avaliarExpressao(analisar("3x²"), 2), 12);
  assert.ok(Math.abs(avaliarExpressao(analisar("√(x) + 2,5"), 4) - 4.5) < 1e-9);
  assert.ok(Math.abs(avaliarExpressao(analisar("2pi"), 0) - 2 * Math.PI) < 1e-9);
  assert.equal(avaliarExpressao(analisar("-x^2"), 3), -9, "o sinal fica fora da potência");
  assert.equal(avaliarExpressao(analisar("2^3^2"), 0), 512, "potência associa à direita");
  assert.throws(() => analisar("(x+1"), /parêntese/);
  assert.throws(() => analisar("y+1"), /incógnita/);
  assert.throws(() => analisar(""), /vazia/);
  assert.equal(lerResposta("1/3").toFixed(4), "0.3333");
  assert.equal(lerResposta("12 cm"), 12);
  assert.equal(lerResposta("1.000,5"), 1000.5);
  assert.equal(lerResposta("30%"), 30);
  assert.ok(numeroCerto(0.333, 1 / 3), "0,333 vale 1/3 (0,5%)");
  assert.ok(!numeroCerto(0.33, 1 / 3));
  assert.ok(numeroCerto(3.14, Math.PI, 0.01), "a tolerância do item manda");
});

caso("expressões: equivalência pelos valores de teste e a forma pedida (fatorada, expandida, simplificada)", () => {
  assert.equal(equivalentes(analisar("(x-2)(x-3)"), analisar("x^2-5x+6")).iguais, true);
  const diferente = equivalentes(analisar("(x-2)(x+3)"), analisar("x^2-5x+6"));
  assert.equal(diferente.iguais, false);
  assert.ok(Number.isFinite(diferente.x), "diz em que valor de x diferem");
  assert.equal(equivalentes(analisar("sqrt(x)"), analisar("x^(1/2)")).iguais, true, "fora do domínio das duas é pulado");
  assert.equal(formaAtendida(analisar("(x-2)(x-3)"), "fatorada"), true);
  assert.equal(formaAtendida(analisar("-(x-1)^2"), "fatorada"), true);
  assert.equal(formaAtendida(analisar("x^2-5x+6"), "fatorada"), false);
  assert.equal(formaAtendida(analisar("x^2-5x+6"), "expandida"), true);
  assert.equal(formaAtendida(analisar("(x-2)(x-3)"), "expandida"), false);
  assert.equal(formaAtendida(analisar("(x^2-9)/(x-3)"), "simplificada", analisar("x+3")), false, "a própria pergunta não vale como simplificada");
});

caso("lista de cálculo: a IA errada é filtrada, e o servidor corrige número, expressão e forma", () => {
  const lista = validarCalculo({
    titulo: "Fatoração", itens: [
      { pergunta: "Fatore x^2 - 5x + 6", tipo: "expressao", resposta: "(x-2)(x-3)", forma: "fatorada", explicacao: "raízes 2 e 3" },
      { pergunta: "Quanto é 3/4 de 20?", tipo: "numero", resposta: "15", explicacao: "" },
      { pergunta: "Raiz de 2 com 2 casas", tipo: "numero", resposta: "1.41", tolerancia: 0.01, explicacao: "" },
      { pergunta: "Item quebrado", tipo: "expressao", resposta: "x +* 2", explicacao: "" },
      { pergunta: "", tipo: "numero", resposta: "3" },
    ],
  });
  assert.equal(lista.motor, "calculo");
  assert.equal(lista.itens.length, 3, "o item que não dá para ler e o vazio saem");
  assert.throws(() => validarCalculo({ itens: [{ pergunta: "a", tipo: "numero", resposta: "1" }] }), /itens que dê para corrigir/);
  const r = corrigirCalculo(lista, ["(x-3)(x-2)", "15,0", "1,414"]);
  assert.deepEqual(r.itens.map((i) => i.certo), [true, true, true]);
  assert.equal(r.nota, 100);
  const e = corrigirCalculo(lista, ["x^2-5x+6", "16", ""]);
  assert.match(e.itens[0].motivo, /forma fatorada/);
  assert.match(e.itens[1].motivo, /deu 16, e a resposta é 15/);
  assert.equal(e.itens[2].motivo, "sem resposta");
  assert.equal(e.nota, 0);
  assert.match(corrigirItemDeCalculo(lista.itens[0], "(x-2)(x+3)").motivo, /não é equivalente: com x = /);
});

caso("ditado: palavra a palavra, acento vale meio, palavra a mais custa; a frase vai embaralhada para a tela", () => {
  const d = validarDitado({ titulo: "Ditado", idioma: "es-ES", frases: [
    { texto: "Mañana vamos a la playa.", traducao: "Amanhã vamos à praia." },
    { texto: "¿Dónde está la estación?", traducao: "Onde fica a estação?" },
    { texto: "Me gusta el café.", traducao: "Eu gosto de café." },
    { texto: "Oi", traducao: "" },
  ] });
  assert.equal(d.idioma, "es-ES");
  assert.equal(d.frases.length, 3, "frase de uma palavra sai");
  assert.equal(validarDitado({ idioma: "inglês", frases: d.frases }).idioma, "en-US", "idioma torto vira en-US");
  assert.equal(compararDitado("Mañana vamos a la playa.", "mañana vamos a la playa").nota, 1, "pontuação e maiúscula não contam");
  assert.equal(compararDitado("Mañana vamos a la playa.", "manana vamos a la playa").nota, 0.9, "acento errado vale meio");
  assert.equal(compararDitado("Me gusta el café.", "me gusta café").nota, 0.75);
  assert.ok(compararDitado("Me gusta el café.", "me gusta el café me gusta el café").nota <= 0.5, "colar a frase duas vezes não dá nota cheia");
  assert.deepEqual(compararDitado("Me gusta el café.", "me gusta cafe").palavras.map((p) => p.marca), ["ok", "ok", "falta", "acento"]);
  assert.equal(corrigirDitado(d, ["Mañana vamos a la playa", "Dónde está la estación", "Me gusta el café"]).nota, 100);
  assert.equal(desembaralhar(embaralhar("¿Dónde está? 日本")), "¿Dónde está? 日本");
  const tela = exercicioParaTela(d, false);
  assert.ok(!JSON.stringify(tela).includes("playa"), "antes de corrigir, a frase não fica à vista");
  assert.equal(desembaralhar(tela.frases[0].fala), d.frases[0].texto);
  assert.ok(JSON.stringify(exercicioParaTela(d, true)).includes("playa"), "corrigido, aparece");
});

caso("treino de ouvido: montado pelo código (a mesma semente, o mesmo treino), sem gabarito na tela", () => {
  const assunto = { titulo: "Intervalos de terça e quinta", nivel: "basico" };
  const a = gerarOuvido({ semente: 42, assunto }), b = gerarOuvido({ semente: 42, assunto });
  assert.deepEqual(a, b);
  assert.equal(a.itens.length, 8);
  assert.equal(a.categoria, "intervalos");
  assert.deepEqual(a.opcoes, ["2ª maior", "3ª menor", "3ª maior", "4ª justa", "5ª justa", "8ª justa"]);
  const SEMITONS = { "2ª maior": 2, "3ª menor": 3, "3ª maior": 4, "4ª justa": 5, "5ª justa": 7, "8ª justa": 12 };
  for (const it of a.itens) {
    assert.equal(it.notas.length, 2);
    assert.equal(it.notas[1] - it.notas[0], SEMITONS[a.opcoes[it.correta]], "as notas tocam o intervalo do gabarito");
  }
  assert.equal(categoriaDoOuvido({ titulo: "Tríades maiores e menores" }).categoria, "acordes");
  const acordes = gerarOuvido({ semente: 7, assunto: { titulo: "Acordes", nivel: "avancado" } });
  assert.deepEqual(acordes.opcoes, ["maior", "menor", "diminuto", "aumentado"]);
  assert.ok(acordes.itens.every((it) => it.notas.length === 3 && it.modo === "harmonico"));
  assert.ok(exercicioParaTela(a, false).itens.every((it) => !("correta" in it)));
  const certas = a.itens.map((it) => it.correta);
  assert.equal(corrigirOuvido(a, certas).nota, 100);
  const erradas = certas.map((c) => (c + 1) % a.opcoes.length);
  const r = corrigirOuvido(a, erradas);
  assert.equal(r.nota, 0);
  assert.match(r.itens[0].motivo, /^era .+ \(você marcou .+\)$/);
  const av = avaliacaoDoMotor("ouvido", a, r);
  assert.equal(av.requisitos.length, 8);
  assert.equal(av.requisitos[0].atendido, false);
});

caso("motores: o exercício antigo é de código; os corrigidos no servidor têm uma tentativa só", () => {
  assert.equal(motorDo({ titulo: "x", enunciado: "y" }), "codigo");
  assert.equal(motorDo({ motor: "ditado" }), "ditado");
  assert.equal(motorDo({ motor: "inventado" }), "codigo");
  assert.ok(corrigeNoServidor("calculo") && corrigeNoServidor("ouvido") && !corrigeNoServidor("aberto"));
  assert.equal(MOTORES.codigo.tentativas, 5);
  assert.equal(tentativasDe({ tipo: "exercicio", conteudo: {} }), 5);
  assert.equal(tentativasDe({ tipo: "exercicio", conteudo: { motor: "calculo" } }), 1);
  assert.equal(tentativasDe({ tipo: "exercicio", motor: "aberto" }), 5);
  assert.equal(tentativasDe({ tipo: "projeto_semanal" }), 5);
  assert.equal(podeReenviar({ tipo: "exercicio", conteudo: { motor: "ditado" }, tentativas: 1 }), false);
  assert.equal(podeReenviar({ tipo: "exercicio", conteudo: { motor: "aberto" }, tentativas: 1 }), true);
  assert.equal(entregaConcluida({ tipo: "exercicio", melhorNota: 40, tentativas: 1, conteudo: { motor: "ouvido" } }), true, "uma tentativa e acabou");
  assert.equal(entregaConcluida({ tipo: "exercicio", melhorNota: 40, tentativas: 1, conteudo: {} }), false, "o de código continua");
  const aberto = validarAberto({ titulo: "Missão", enunciado: "Fotografe", entrega: "3 fotos", evidencias: ["imagens", "github", "texto"], dicas: [], criterios: ["a", "b"] }, ["texto", "imagens"]);
  assert.deepEqual(aberto.evidencias, ["texto", "imagens"], "só as evidências do perfil, na ordem certa");
  assert.throws(() => validarAberto({ enunciado: "x", criterios: ["só um"] }, ["texto"]), /critérios/);
  assert.deepEqual(evidenciasAceitas([], ["audio"]), ["texto"]);
  const proj = validarProjeto({ titulo: "P", requisitos: ["a", "b"], extras: [], entrega: "grave", criterios: [], evidencias: ["audio", "video"] }, 0, ["audio", "video", "texto"]);
  assert.deepEqual(proj.evidencias, ["audio", "video"]);
  assert.equal(validarProjeto({ titulo: "P", requisitos: ["a", "b"] }).evidencias, undefined, "projeto de programação não tem evidências");
});

caso("evidências: tipos, tamanhos, áudio pelo tempo e só vídeo do YouTube", () => {
  const aceitas = ["texto", "imagens", "audio", "video"];
  const foto = { tipo: "image/jpeg", bytes: 300_000, miniatura: "data:image/jpeg;base64,AAAA" };
  assert.equal(conferirEvidencia({ texto: "Fiz a receita e tirei as fotos.", imagens: [foto] }, { aceitas }).ok, true);
  assert.match(conferirEvidencia({}, { aceitas }).motivo, /mande a sua entrega/);
  assert.match(conferirEvidencia({ texto: "ok" }, { aceitas }).motivo, /escreva um pouco mais/);
  assert.match(conferirEvidencia({ imagens: [foto, foto, foto, foto] }, { aceitas }).motivo, /no máximo 3 fotos/);
  assert.match(conferirEvidencia({ imagens: [{ ...foto, tipo: "image/gif" }] }, { aceitas }).motivo, /JPEG, PNG ou WebP/);
  assert.match(conferirEvidencia({ imagens: [{ ...foto, bytes: 9e6 }] }, { aceitas }).motivo, /grande demais/);
  assert.match(conferirEvidencia({ imagens: [{ ...foto, miniatura: "javascript:alert(1)" }] }, { aceitas }).motivo, /miniatura/);
  assert.match(conferirEvidencia({ imagens: [foto] }, { aceitas: ["texto"] }).motivo, /não pede fotos/);
  const audio = (segundos) => ({ tipo: "audio/wav", bytes: segundos * LIMITES_DA_EVIDENCIA.bytesPorSegundoDeAudio, segundos });
  assert.equal(conferirEvidencia({ audio: audio(80) }, { aceitas }).ok, true);
  assert.match(conferirEvidencia({ audio: audio(120) }, { aceitas }).motivo, /passou de 90 segundos/);
  assert.equal(conferirEvidencia({ audio: audio(120) }, { aceitas, projeto: true }).ok, true, "o projeto aceita até 3 minutos");
  assert.match(conferirEvidencia({ audio: { ...audio(10), tipo: "audio/webm" } }, { aceitas }).motivo, /WAV/);
  assert.equal(videoDoYoutube("https://youtu.be/dQw4w9WgXcQ?t=3"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(videoDoYoutube("https://www.youtube.com/watch?feature=x&v=dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(videoDoYoutube("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(videoDoYoutube("https://vimeo.com/123"), null);
  assert.match(conferirEvidencia({ video: "https://vimeo.com/123" }, { aceitas }).motivo, /link do YouTube/);
  assert.equal(conferirEvidencia({ video: "https://youtu.be/dQw4w9WgXcQ" }, { aceitas }).video, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

caso("perfis: o tema decide quando não há IA; o motor alterna por dia e por rodada; trilha antiga é programação", () => {
  assert.deepEqual(ORDEM_DOS_PERFIS, Object.keys(PERFIS));
  assert.equal(perfilValido(undefined), "programacao");
  assert.equal(perfilPeloTema("JavaScript"), "programacao");
  assert.equal(perfilPeloTema("Estatística com Python"), "programacao", "programação vem antes");
  assert.equal(perfilPeloTema("Inglês para viagem"), "idiomas");
  assert.equal(perfilPeloTema("Álgebra linear"), "matematica", "palavra acentuada no começo");
  assert.equal(perfilPeloTema("Violão para iniciantes"), "musica");
  assert.equal(perfilPeloTema("Culinária japonesa"), "programacao", "sem pista: o padrão dos quadros STUDY");
  assert.equal(perfilPeloTema("Culinária japonesa", "livre"), "livre");
  assert.equal(perfilPeloTema("Japonês básico"), "idiomas");
  assert.equal(motorDoExercicio({ perfil: "programacao", rodada: 2 }), "codigo");
  assert.equal(motorDoExercicio({ perfil: "livre", rodada: 1, dia: "2026-10-30" }), "aberto");
  const dia = "2026-10-30", amanha = "2026-10-31";
  const hoje1 = motorDoExercicio({ perfil: "idiomas", rodada: 1, dia });
  assert.notEqual(hoje1, motorDoExercicio({ perfil: "idiomas", rodada: 2, dia }), "a rodada extra troca de motor");
  assert.notEqual(hoje1, motorDoExercicio({ perfil: "idiomas", rodada: 1, dia: amanha }), "e o dia seguinte também");
  assert.ok(["calculo", "aberto"].includes(motorDoExercicio({ perfil: "matematica", rodada: 1, dia })));
  assert.ok(["afinacao", "aberto"].includes(motorDoExercicio({ perfil: "musica", rodada: 1, dia, assunto: { titulo: "Postura e afinação do violão" } })), "assunto de tocar não é de ouvido");
  assert.ok(["ouvido", "afinacao", "aberto"].includes(motorDoExercicio({ perfil: "musica", rodada: 1, dia, assunto: { titulo: "Intervalos" } })));
  assert.deepEqual(evidenciasDoPerfil("programacao"), []);
  assert.deepEqual(evidenciasDoPerfil("musica"), ["audio", "video", "texto"]);
  const curso = validarCurso({ tema: "Violão", modulos: [{ nome: "M", assuntos: [{ titulo: "a" }, { titulo: "b" }, { titulo: "c" }] }] });
  assert.equal(curso.proposta.perfil, "musica", "sem perfil da IA, pelo tema");
  assert.equal(validarCurso({ tema: "Violão", perfil: "livre", modulos: curso.proposta.modulos }).proposta.perfil, "livre", "a escolha vale");
  assert.equal(validarCurso({ tema: "Violão", perfil: "hacker", modulos: curso.proposta.modulos }).proposta.perfil, "musica");
});

caso("perfis: a migração 022 só acrescenta a coluna, com o padrão de antes", () => {
  const sql = fs.readFileSync(new URL("../db/022-perfis-de-curso.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists perfil text not null default 'programacao'/);
  for (const p of ORDEM_DOS_PERFIS) assert.ok(sql.includes(`'${p}'`), `a checagem aceita ${p}`);
});

caso("acervo: a migração 020 só acrescenta tipos ao livro-caixa", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const tipos = (sql) => [...sql.match(/proof_reino_movimentos_tipo_check\s+check \(tipo in \(([\s\S]*?)\)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const antes = tipos(ler("../db/018-modo-dominio.sql"));
  const agora = tipos(ler("../db/020-biblioteca-colaborativa.sql"));
  for (const t of antes) assert.ok(agora.includes(t), `o tipo ${t} continua`);
  for (const t of ["acervo", "acervo_revisao", "gorjeta_dada", "gorjeta_recebida"]) assert.ok(agora.includes(t), `entra o tipo ${t}`);
});

// ---------------------------------------------------------------- 31/10/2026: ritmo, afinação, cartões, turma e torre de tema

caso("ritmo: montado pelo código, repetível e no nível do assunto", () => {
  const a = gerarRitmo({ semente: 5, assunto: { titulo: "Colcheias e levada" } });
  assert.deepEqual(a, gerarRitmo({ semente: 5, assunto: { titulo: "Colcheias e levada" } }), "a mesma semente dá o mesmo treino");
  assert.equal(a.motor, "ritmo");
  assert.equal(a.nivel, "medio");
  assert.equal(a.itens.length, 6);
  for (let i = 1; i < a.itens.length; i++) assert.notDeepEqual(a.itens[i].batidas, a.itens[i - 1].batidas, "o mesmo padrão duas vezes seguidas, não");
  for (const it of a.itens) assert.ok(it.batidas.every((b) => b >= 0 && b < 4), "tudo dentro do compasso de 4 tempos");
  assert.equal(nivelDoRitmo({ titulo: "Síncope no samba" }), "avancado");
  assert.equal(nivelDoRitmo({ titulo: "Pulsação e semínimas" }), "basico");
  assert.equal(MOTORES.ritmo.tentativas, 1);
  assert.ok(corrigeNoServidor("ritmo") && corrigeNoServidor("afinacao"));
});

caso("ritmo: corrige pelo desvio e desconta o atraso fixo do aparelho", () => {
  const c = { bpm: 60, itens: [{ batidas: [0, 1, 2, 3] }, { batidas: [0, 2] }] }; // 1 tempo = 1000 ms
  const exato = corrigirRitmo(c, ["0,1000,2000,3000", "0,2000"]);
  assert.equal(exato.nota, 100);
  assert.equal(exato.atraso, 0);
  const atrasado = corrigirRitmo(c, ["120,1120,2120,3120", "120,2120"]);
  assert.equal(atrasado.nota, 100, "quem bate sempre 120 ms depois (fone, toque na tela) está no tempo");
  assert.equal(atrasado.atraso, 120);
  const torto = corrigirRitmo(c, ["0,1150,2000,3000", "0,2000"]);
  assert.ok(torto.nota > 85 && torto.nota < 100, `uma batida 150 ms fora custa um pouco (${torto.nota})`);
  assert.match(torto.itens[0].motivo, /desvio médio/);
  const sobrando = corrigirRitmo(c, ["0,500,1000,2000,3000", "0,2000"]);
  assert.ok(sobrando.itens[0].nota < 1);
  assert.match(sobrando.itens[0].motivo, /a mais/);
  const vazio = corrigirRitmo(c, ["", "0,2000"]);
  assert.equal(vazio.itens[0].nota, 0);
  assert.equal(vazio.itens[0].motivo, "sem toques");
  assert.deepEqual(lerToques("30, 10;abc 20"), [10, 20, 30]);
  const av = avaliacaoDoMotor("ritmo", c, exato);
  assert.equal(av.requisitos[0].requisito, "Compasso 1");
});

caso("afinação: cents em qualquer oitava, e a nota pedida some da tela no intervalo", () => {
  assert.ok(Math.abs(centsAteANota(440, 69)) < 0.01);
  assert.ok(Math.abs(centsAteANota(220, 69)) < 0.01, "uma oitava abaixo vale");
  assert.ok(Math.abs(centsAteANota(frequenciaDaNota(69) * 2 ** (30 / 1200), 69) - 30) < 0.01);
  assert.equal(nomeDaNota(60), "Dó4");
  assert.equal(nomeDaNota(70, false), "Lá♯");
  const c = { itens: [{ referencia: 60, alvo: 60, pedido: "a mesma nota" }, { referencia: 60, alvo: 67, pedido: "uma 5ª justa acima" }] };
  const r = corrigirAfinacao(c, [String(frequenciaDaNota(60) / 2), String(frequenciaDaNota(66))]);
  assert.equal(r.itens[0].certo, true);
  assert.equal(r.itens[1].certo, false);
  assert.match(r.itens[1].motivo, /soou Fá♯/);
  assert.equal(r.nota, 50);
  assert.equal(corrigirAfinacao(c, ["", "abc"]).itens[0].motivo, "sem som detectado");
  const intervalo = gerarAfinacao({ semente: 3, assunto: { titulo: "Solfejo de intervalos" } });
  assert.equal(intervalo.comIntervalo, true);
  assert.equal(exercicioParaTela(intervalo, false).itens[0].alvo, undefined, "antes de corrigir, a nota pedida não vai para a tela");
  assert.equal(exercicioParaTela(intervalo, true).itens[0].alvo, intervalo.itens[0].alvo);
  const unissono = gerarAfinacao({ semente: 3, assunto: { titulo: "Aquecimento vocal" } });
  assert.equal(unissono.comIntervalo, false);
  assert.ok(unissono.itens.every((it) => it.alvo === it.referencia));
  assert.ok(intervalo.itens.every((it) => it.alvo > it.referencia && it.alvo <= 67));
  assert.match(avaliacaoDoMotor("afinacao", c, r).requisitos[1].requisito, /Sol/);
});

caso("afinação: a detecção de altura acha a nota de um seno e de um som com harmônicos", () => {
  const taxa = 44_100, n = 2048;
  const seno = Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / taxa));
  assert.ok(Math.abs(detectarAltura(seno, taxa) - 220) < 1, "seno de 220 Hz");
  const rico = Float32Array.from({ length: n }, (_, i) => [1, 0.6, 0.4, 0.25].reduce((s, a, h) => s + a * Math.sin((2 * Math.PI * 147 * (h + 1) * i) / taxa), 0) * 0.3);
  assert.ok(Math.abs(detectarAltura(rico, taxa) - 147) < 1.5, "Ré com harmônicos (o fundamental, não um harmônico)");
  assert.equal(detectarAltura(new Float32Array(n), taxa), null, "silêncio");
  let x = 12345;
  const ruido = Float32Array.from({ length: n }, () => { x = (x * 1103515245 + 12345) % 2147483648; return (x / 2147483648 - 0.5) * 0.6; });
  assert.equal(detectarAltura(ruido, taxa), null, "ruído não tem altura");
  assert.equal(alturaSustentada([null, 400, 440, 441, 439, 440, 442]), 440, "o ataque sai e fica a mediana");
  assert.equal(alturaSustentada([440, 441]), null, "duas leituras não bastam");
});

caso("música: o motor do exercício pelo assunto (ouvido, ritmo, afinação ou tocar)", () => {
  const dia = "2026-10-30";
  const opcoes = (titulo) => new Set([1, 2, 3, 4].map((rodada) => motorDoExercicio({ perfil: "musica", rodada, dia, assunto: { titulo } })));
  assert.deepEqual([...opcoes("Compasso e semínimas")].sort(), ["aberto", "ritmo"]);
  assert.deepEqual([...opcoes("Canto: respiração")].sort(), ["aberto", "afinacao"]);
  assert.deepEqual([...opcoes("Intervalos")].sort(), ["aberto", "afinacao", "leitura", "ouvido"]);
  assert.deepEqual([...opcoes("Postura da mão direita")].sort(), ["aberto", "ritmo"]);
});

caso("cartões: a agenda do SM-2 (esqueci volta amanhã; lembrar alonga o intervalo)", () => {
  const hoje = "2026-10-31";
  const c0 = agendaNova(hoje);
  assert.equal(c0.proxima_em, hoje);
  const c1 = revisarCartao(c0, "lembrei", hoje);
  assert.deepEqual([c1.intervalo, c1.repeticoes, c1.proxima_em], [1, 1, "2026-11-01"]);
  const c2 = revisarCartao(c1, "lembrei", hoje);
  assert.equal(c2.intervalo, 3);
  const c3 = revisarCartao(c2, "lembrei", hoje);
  assert.equal(c3.intervalo, 8, "depois, multiplica pela facilidade (2,5)");
  const facil = revisarCartao(c0, "facil", hoje);
  assert.deepEqual([facil.intervalo, facil.facilidade], [3, 2.6]);
  const esqueci = revisarCartao(c3, "esqueci", hoje);
  assert.deepEqual([esqueci.intervalo, esqueci.repeticoes, esqueci.lapsos, esqueci.proxima_em], [1, 0, 1, "2026-11-01"]);
  assert.ok(esqueci.facilidade < c3.facilidade);
  let ruim = c0;
  for (let i = 0; i < 10; i++) ruim = revisarCartao(ruim, "esqueci", hoje);
  assert.equal(ruim.facilidade, 1.3, "a facilidade tem piso");
  assert.ok(revisarCartao({ intervalo: 10, facilidade: 2.5, repeticoes: 3 }, "dificil", hoje).intervalo >= 10, "difícil não encurta");
  assert.equal(revisarCartao({ intervalo: 300, facilidade: 3, repeticoes: 9 }, "facil", hoje).intervalo, 365, "no máximo um ano");
  assert.deepEqual(previsoes(c0, hoje), { esqueci: 1, dificil: 1, lembrei: 1, facil: 3 });
  assert.throws(() => revisarCartao(c0, "talvez", hoje));
  assert.equal(quandoVolta(1), "amanhã");
  assert.equal(quandoVolta(45), "em 2 meses");
  assert.equal(quandoVolta(400), "em 1 ano");
});

caso("cartões: a revisão do dia (vencidos primeiro, novos com limite) e a conferência da IA", () => {
  const hoje = "2026-10-31";
  const novos = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, proxima_em: hoje, revisado_em: null, criado_em: `2026-10-0${(i % 9) + 1}T10:00:00Z` }));
  const lista = [
    { id: "hoje", proxima_em: hoje, revisado_em: "2026-10-28T10:00:00Z", repeticoes: 2, intervalo: 3, criado_em: "2026-10-01T00:00:00Z" },
    { id: "atrasado", proxima_em: "2026-10-20", revisado_em: "2026-10-10T10:00:00Z", repeticoes: 1, intervalo: 1, criado_em: "2026-10-02T00:00:00Z" },
    { id: "futuro", proxima_em: "2026-11-05", revisado_em: "2026-10-30T10:00:00Z", repeticoes: 3, intervalo: 25, criado_em: "2026-10-01T00:00:00Z" },
    ...novos,
  ];
  const fila = cartoesDoDia(lista, hoje, { cartoes: 10, novos: 5 });
  assert.equal(fila.length, 7, "2 vencidos e 5 novos");
  assert.equal(fila[0].id, "atrasado", "o mais atrasado primeiro");
  assert.ok(!fila.some((c) => c.id === "futuro"));
  const resumo = resumoDosCartoes(lista, hoje);
  assert.deepEqual([resumo.total, resumo.novos, resumo.firmes, resumo.proxima], [23, 20, 1, "2026-11-05"]);
  const bons = validarCartoes({
    cartoes: [
      { frente: "to borrow", verso: "pegar emprestado" }, { frente: "To  Borrow", verso: "repetido" }, { frente: "run", verso: "correr" },
      { frente: "eat", verso: "comer", exemplo: "I eat rice." }, { frente: "", verso: "sem frente" }, { frente: "drink", verso: "beber" },
    ],
  }, ["Run"]);
  assert.deepEqual(bons.map((c) => c.frente), ["to borrow", "eat", "drink"], "sem repetir entre eles nem com os que já existem");
  assert.throws(() => validarCartoes({ cartoes: [{ frente: "a", verso: "b" }] }), /suficientes/);
  assert.throws(() => validarCartao({ frente: "Casa", verso: "casa" }), /iguais/);
  assert.equal(pontosDaRevisao(3), 6);
  assert.equal(pontosDaRevisao(50), 20, "com teto por dia");
});

caso("revisão da turma: pedir, revisar e a nota que só sobe", () => {
  const d = {
    tipo: "exercicio", rodada: 1, status: "em_andamento", tentativas: 1, nota: 50, pontos: comFatorDaRodada(pontosDaNota("exercicio", 50), 1),
    conteudo: { motor: "aberto", criterios: ["A", "B", "C", "D"] },
    avaliacao: { nota: 50, requisitos: [{ numero: 1, atendido: true }, { numero: 2, atendido: true }, { numero: 3, atendido: false, observacao: "não vi" }, { numero: 4, atendido: false }] },
    resposta: { texto: "minha entrega" },
  };
  assert.deepEqual(atendidosPelaIA(d), [0, 1]);
  assert.equal(podePedirRevisao(d).ok, true);
  assert.equal(podePedirRevisao(d, { jaPediu: true }).ok, false);
  assert.equal(podePedirRevisao({ ...d, conteudo: { motor: "calculo" } }).ok, false, "o que tem resposta certa não vai para a turma");
  assert.equal(podePedirRevisao({ ...d, tentativas: 0 }).ok, false);
  assert.equal(podePedirRevisao({ ...d, avaliacao: { requisitos: [1, 2, 3, 4].map((numero) => ({ numero, atendido: true })) } }).ok, false);

  const pedido = validarPedido(d, [{ indice: 2, justificativa: "aparece na foto 2" }, { indice: 0, justificativa: "a Lisa já deu esse" }], true);
  assert.deepEqual(pedido.map((c) => c.indice), [2], "só o que a Lisa deu como não cumprido");
  assert.throws(() => validarPedido(d, pedido, false), /confirme/);
  assert.throws(() => validarPedido(d, [{ indice: 2, justificativa: "sim" }], true), /explique/);
  assert.throws(() => validarPedido(d, [], true), /pelo menos um/);

  assert.throws(() => validarVeredito(pedido, [], "Muito bom, parabéns!"), /cada critério/);
  assert.throws(() => validarVeredito(pedido, [{ indice: 2, veredito: "cumpriu" }], "ok"), /comentário/);
  const v = validarVeredito(pedido, [{ indice: 2, veredito: "cumpriu", observacao: "dá para ver na foto" }], "Ficou ótimo, só capriche na luz.");
  assert.equal(v.vereditos[0].veredito, "cumpriu");

  const agora = Date.parse("2026-10-31T12:00:00Z");
  const p = { autor_id: "a", status: "aberta", criado_em: "2026-10-30T12:00:00Z" };
  assert.equal(podeRevisarNaTurma({ usuarioId: "a", pedido: p, agora }).ok, false, "o próprio pedido, não");
  assert.equal(podeRevisarNaTurma({ usuarioId: "b", pedido: p, revisadosNaSemana: ["a"], agora }).ok, false, "o mesmo colega duas vezes na semana, não");
  assert.equal(podeRevisarNaTurma({ usuarioId: "b", pedido: { ...p, status: "revisada" }, agora }).ok, false);
  assert.equal(podeRevisarNaTurma({ usuarioId: "b", pedido: { ...p, criado_em: "2026-10-01T12:00:00Z" }, agora }).ok, false, "vencido");
  assert.equal(podeRevisarNaTurma({ usuarioId: "b", pedido: p, agora }).ok, true);

  const depois = aplicarRevisao(d, v.vereditos);
  assert.equal(depois.nota, 75, "3 de 4 critérios");
  assert.equal(depois.concluido, true);
  assert.equal(depois.avaliacao.requisitos[2].atendido, true);
  assert.equal(depois.avaliacao.requisitos[2].turma, true);
  assert.ok(depois.pontos >= comFatorDaRodada(pontosDaNota("exercicio", 75), 1));
  const negou = aplicarRevisao(d, [{ indice: 2, veredito: "nao_cumpriu" }]);
  assert.equal(negou.nota, 50, "a turma não tira nota");
  assert.equal(negou.pontos, d.pontos);

  const projeto = {
    tipo: "projeto_semanal", rodada: 1, status: "em_andamento", tentativas: 1, nota: 40, pontos: 0,
    conteudo: { evidencias: ["texto"], requisitos: ["r1", "r2", "r3"], extras: [] },
    resposta: { cumpridos: { requisitos: [0], extras: [] } },
    avaliacao: { nota: 40, requisitos: [{ numero: 1, atendido: true }, { numero: 2, atendido: false }, { numero: 3, atendido: false }] },
  };
  const tabela = tabelaDePontos(projeto.tipo, projeto.conteudo);
  const dp = aplicarRevisao({ ...projeto, pontos: pontosDoProjeto(tabela, projeto.resposta.cumpridos) }, [{ indice: 1, veredito: "cumpriu" }]);
  assert.deepEqual(dp.resposta.cumpridos.requisitos, [0, 1]);
  assert.equal(dp.pontos, pontosDoProjeto(tabela, { requisitos: [0, 1], extras: [] }), "soma a parte do requisito confirmado");
  assert.equal(dp.nota, 67);
});

caso("torre de tema: o pedido, os atributos do perfil e o desafio com evidências", () => {
  assert.deepEqual(validarPedidoDeTema({ tema: "  Violão   popular ", perfil: "musica" }), { tema: "Violão popular", perfil: "musica", ponto: "" });
  assert.throws(() => validarPedidoDeTema({ tema: "ab", perfil: "musica" }), /tema/);
  assert.throws(() => validarPedidoDeTema({ tema: "Inglês", perfil: "programacao" }), /tipo da torre/);
  const musica = atributosDaTorre("musica");
  assert.deepEqual(musica.map((a) => a.id), ATRIBUTOS.map((a) => a.id), "os mesmos cinco atributos do Neuro");
  assert.ok(musica.some((a) => a.nome === "Afinação"));
  assert.equal(atributosDaTorre(undefined), ATRIBUTOS, "torre de repositório: os de programação");
  for (const p of PERFIS_DE_TORRE) assert.ok(TORRES_DE_TEMA[p] && atributosDaTorre(p).every((a) => a.nome && a.sentido), p);
  assert.equal(tituloDaTorre({ origem: "tema", tema: "Inglês" }), "Inglês");
  assert.equal(tituloDaTorre({ origem: "repositorio", repo_caminho: "dono/repo" }), "dono/repo");
  const d = validarDesafioDoTema({ enunciado: "Toque a escala", requisitos: ["a", "b"], criterios: ["c"], dica: "", entrega: "um áudio", evidencias: ["audio", "imagens", "github"] }, "musica");
  assert.deepEqual(d.evidencias, ["audio"], "só as evidências que o perfil aceita");
  assert.equal(d.arquivos, undefined);
  assert.equal(d.entrega, "um áudio");
});

caso("migração 023: só acrescenta (tabelas, colunas e tipos novos no livro de pontos)", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const sql = ler("../db/023-cartoes-turma-e-torres-de-tema.sql");
  const tipos = (texto) => [...texto.match(/proof_eventos_tipo_check check \(tipo in \(([\s\S]*?)\)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const antes = tipos(ler("../db/018-modo-dominio.sql"));
  const agora = tipos(sql);
  for (const t of antes) assert.ok(agora.includes(t), `o tipo ${t} continua`);
  for (const t of ["cartoes", "revisao"]) assert.ok(agora.includes(t), `entra o tipo ${t}`);
  assert.match(sql, /create table if not exists public\.proof_cartoes/);
  assert.match(sql, /create table if not exists public\.proof_revisoes/);
  assert.match(sql, /add column if not exists origem text not null default 'repositorio'/);
  assert.doesNotMatch(sql, /drop table|drop column/i);
  for (const p of PERFIS_DE_TORRE) assert.ok(sql.includes(`'${p}'`), `a torre aceita ${p}`);
});

// ---------------------------------------------------------------- 31/10/2026 (2): o resto da proposta

caso("passo a passo: a IA errada é filtrada; cada linha é conferida e o erro aparece onde nasceu", () => {
  const c = validarPassos({
    titulo: "Passos",
    itens: [
      { tipo: "equacao", enunciado: "Resolva", inicio: "2x + 3 = 11", solucoes: ["4"], variavel: "x" },
      { tipo: "expressao", enunciado: "Fatore", inicio: "x^2 + 6x", forma: "fatorada", resposta: "x(x + 6)", variavel: "x" },
      { tipo: "equacao", enunciado: "Resolva", inicio: "x^2 - 5x + 6 = 0", solucoes: ["2", "3"], variavel: "x" },
      { tipo: "equacao", enunciado: "Errada", inicio: "x + 1 = 3", solucoes: ["5"], variavel: "x" },
      { tipo: "expressao", enunciado: "Errada", inicio: "x^2", forma: "fatorada", resposta: "x + x", variavel: "x" },
    ],
  });
  assert.equal(c.itens.length, 3, "a solução que não vale e a resposta que não é equivalente saem");
  assert.throws(() => validarPassos({ itens: [{ tipo: "equacao", enunciado: "a", inicio: "x = x", solucoes: ["1"] }] }), /passo a passo/);
  const [eq, ex, quad] = c.itens;
  assert.equal(corrigirItemDePassos(eq, "2x = 11 - 3\nx = 8/2\nx = 4").certo, true);
  const errou = corrigirItemDePassos(eq, "2x = 11 + 3\nx = 7");
  assert.equal(errou.linhaDoErro, 1);
  assert.match(errou.motivo, /linha 1: não vale mais para x = 4/);
  assert.equal(corrigirItemDePassos(eq, "2x = 8").nota, 0.5, "certo, mas sem isolar o x");
  assert.equal(corrigirItemDePassos(ex, "= x(x + 6)").certo, true, "o = do começo da linha é ignorado");
  assert.equal(corrigirItemDePassos(ex, "x^2 + 6x + 0").nota, 0.5, "equivalente, mas não fatorada");
  const exErrou = corrigirItemDePassos(ex, "x(x + 6)\nx(x + 5)");
  assert.equal(exErrou.linhaDoErro, 2);
  assert.equal(exErrou.nota, 0.25);
  assert.equal(corrigirItemDePassos(quad, "(x - 2)(x - 3) = 0\nx - 2 = 0 ou x - 3 = 0\nx = 2 ou x = 3").certo, true);
  assert.equal(corrigirItemDePassos(quad, "(x - 2)(x - 3) = 0\nx = 2, x = 3").certo, true, "a vírgula antes do x também separa");
  assert.match(corrigirItemDePassos(quad, "(x - 2)(x - 3) = 0\nx = 2").motivo, /não vale mais para x = 3/, "perder uma raiz é erro na linha");
  assert.match(corrigirItemDePassos(quad, "0 = 0").motivo, /qualquer x/);
  assert.equal(corrigirPassos(c, ["2x = 8\nx = 4", "x(x+6)", ""]).nota, 67);
  assert.equal(passosParaTela(c).itens[0].solucoes, undefined, "as soluções não vão para a tela antes");
  assert.deepEqual(lerLinhas("  a \n\n = b\n"), ["a", "b"]);
});

caso("gráfico: montado pelo código; reta, ponto, vértice e raízes conferidos no servidor", () => {
  const g = gerarGrafico({ semente: 9, assunto: { titulo: "Função quadrática e vértice" } });
  assert.equal(g.categoria, "parabola");
  assert.deepEqual(g, gerarGrafico({ semente: 9, assunto: { titulo: "Função quadrática e vértice" } }));
  assert.equal(categoriaDoGrafico({ titulo: "Função afim" }), "reta");
  assert.equal(categoriaDoGrafico({ titulo: "Plano cartesiano" }), "pontos");
  assert.equal(formatarPolinomio([1, -4, 3]), "x² − 4x + 3");
  assert.equal(formatarPolinomio([-1, 0, 2]), "−x² + 2");
  assert.equal(formatarPolinomio([2, -1]), "2x − 1");
  const tela = graficoParaTela(g);
  assert.ok(tela.itens.every((it) => it.h === undefined && it.r1 === undefined), "o vértice e as raízes não vão para a tela");
  const reta = { tipo: "reta", a: 2, b: -1, expressao: "y = 2x − 1", pontos: 2 };
  assert.equal(corrigirItemDeGrafico(reta, "0,-1;2,3").certo, true);
  assert.equal(corrigirItemDeGrafico(reta, "0,-1;2,2").nota, 0.5);
  assert.equal(corrigirItemDeGrafico(reta, "1,1;1,1").certo, false);
  assert.equal(corrigirItemDeGrafico({ tipo: "vertice", h: 2, k: -1, pontos: 1 }, "2,-1").certo, true);
  assert.equal(corrigirItemDeGrafico({ tipo: "raizes", r1: 2, r2: 3, pontos: 2 }, "3,0;2,0").certo, true, "a ordem não importa");
  assert.equal(corrigirItemDeGrafico({ tipo: "raizes", r1: 2, r2: 3, pontos: 2 }, "2,0;4,0").nota, 0.5);
  assert.deepEqual(lerPontos("1,2;9,9;a,b"), [[1, 2]], "fora do plano e ilegível saem");
  // o começo dos pontos nunca é a resposta (a pessoa precisa mexer)
  for (let s = 1; s < 60; s++) {
    for (const assunto of [{ titulo: "Função afim" }, { titulo: "Parábola" }, { titulo: "Plano cartesiano" }, {}]) {
      for (const it of gerarGrafico({ semente: s, assunto }).itens) {
        assert.notEqual(corrigirItemDeGrafico(it, inicioDosPontos(it.pontos).map((p) => p.join(",")).join(";")).nota, 1, `semente ${s}`);
        if (it.tipo === "reta") assert.equal(corrigirItemDeGrafico(it, inicioDosPontos(2).map((p) => p.join(",")).join(";")).nota, 0);
      }
    }
  }
});

caso("leitura na pauta: a posição de cada nota, a clave pelo assunto e o gabarito escondido", () => {
  assert.equal(midiDoGrau(28), 60, "Dó4");
  assert.equal(midiDoGrau(30), 64, "Mi4, a linha de baixo da clave de sol");
  assert.equal(midiDoGrau(18), 43, "Sol2, a linha de baixo da clave de fá");
  assert.equal(nomeDoGrau(33, true), "Lá4");
  assert.equal(pautaDoAssunto({ titulo: "Clave de fá no contrabaixo" }).clave, "fa");
  const l = gerarLeitura({ semente: 4, assunto: { titulo: "Leitura de partitura" } });
  assert.equal(l.clave, "sol");
  assert.ok(l.itens.every((it) => it.grau >= 30 && it.grau <= 38));
  const tela = exercicioParaTela(l, false);
  assert.ok(tela.itens.every((it) => it.correta === undefined && it.midi === undefined && Number.isInteger(it.grau)));
  const certas = l.itens.map((it) => it.correta);
  assert.equal(corrigirLeitura(l, certas).nota, 100);
  assert.match(corrigirLeitura(l, certas.map((c) => (c + 1) % 7)).itens[0].motivo, /^era /);
  assert.equal(MOTORES.leitura.tentativas, 1);
});

caso("conversa: o roteiro, as falas que cabem e quando dá para encerrar", () => {
  const c = validarConversa({
    titulo: "No check-in", idioma: "en-US", nivel: "A2", cenario: "Aeroporto", papel: "atendente", objetivo: "fazer o check-in",
    abertura: "Good morning! Can I see your passport?", dicas: ["window seat — assento na janela"], criterios: ["Cumpriu o objetivo", "Gramática"],
  });
  assert.equal(c.motor, "conversa");
  assert.throws(() => validarConversa({ abertura: "Hi", objetivo: "x", criterios: ["a"] }), /critérios/);
  assert.equal(validarConversa({ ...c, idioma: "inglês", nivel: "Z9" }).idioma, "en-US");
  const d = { status: "em_andamento", tentativas: 0, conteudo: c, resposta: {} };
  assert.deepEqual(turnosDe(d), [{ quem: "lisa", texto: c.abertura }]);
  assert.equal(podeFalar(d).ok, true);
  const cheia = Array.from({ length: c.falas }, () => [{ quem: "pessoa", texto: "hi" }, { quem: "lisa", texto: "ok" }]).flat();
  assert.equal(podeFalar({ ...d, resposta: { turnos: cheia } }).ok, false, "as falas acabam");
  assert.equal(podeFalar({ ...d, tentativas: 1 }).ok, false, "depois de avaliada, não");
  assert.equal(podeEncerrar([{ quem: "pessoa", texto: "a" }]).ok, false);
  assert.equal(podeEncerrar([{ quem: "pessoa", texto: "a" }, { quem: "pessoa", texto: "b" }]).ok, true);
  assert.throws(() => validarMensagem("   "), /escreva/);
  assert.equal(validarRespostaDaLisa({ fala: "Sure!", correcao: "", terminou: 1 }).terminou, true);
  assert.equal(MOTORES.conversa.corrige, "ia");
});

caso("frase-senha: sorteada, pedida só com mídia, e a entrega sem ela fica no teto", () => {
  assert.match(gerarSenha([3, 200, 77]), /^\p{L}+ \p{L}+ \d{2}$/u);
  assert.throws(() => gerarSenha([1]));
  assert.equal(precisaDeSenha(["texto"]), false);
  assert.equal(precisaDeSenha(["texto", "audio"]), true);
  assert.equal(entregaTemMidia({ texto: "x", imagens: [] }), false);
  assert.equal(entregaTemMidia({ imagens: [{}] }), true);
  const av = { nota: 90, aprovado: true, comentario: "Muito bom." };
  assert.deepEqual(aplicarSenha(av, "nao_encontrada", { senha: null, temMidia: true }), av, "desafio antigo, sem senha: nada muda");
  assert.deepEqual(aplicarSenha(av, "nao_encontrada", { senha: "lua azul 12", temMidia: false }), av, "só texto: nada muda");
  assert.equal(aplicarSenha(av, "encontrada", { senha: "lua azul 12", temMidia: true }).nota, 90);
  const sem = aplicarSenha(av, "nao_encontrada", { senha: "lua azul 12", temMidia: true });
  assert.equal(sem.nota, TETO_SEM_SENHA);
  assert.equal(sem.aprovado, true, "ainda aprova: a IA pode não ter ouvido");
  assert.match(sem.comentario, /lua azul 12/);
  assert.equal(aplicarSenha({ ...av, nota: 40 }, "nao_encontrada", { senha: "lua azul 12", temMidia: true }).nota, 40);
});

caso("evidências: o PDF entra (tipo e tamanho), só onde o desafio pede", () => {
  assert.ok(evidenciasDoPerfil("matematica").includes("pdf"));
  assert.ok(!evidenciasDoPerfil("musica").includes("pdf"));
  const pdf = { tipo: "application/pdf", bytes: 200_000 };
  const ok = conferirEvidencia({ pdf }, { aceitas: ["texto", "pdf"] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.pdf, { kb: 195 });
  assert.equal(conferirEvidencia({ pdf }, { aceitas: ["texto"] }).ok, false);
  assert.equal(conferirEvidencia({ pdf: { ...pdf, tipo: "image/png" } }, { aceitas: ["pdf"] }).ok, false);
  assert.equal(conferirEvidencia({ pdf: { ...pdf, bytes: LIMITES_DA_EVIDENCIA.bytesDoPdf + 1 } }, { aceitas: ["pdf"] }).ok, false);
});

caso("diário: o que aprendi é obrigatório; onde travei vira o ponto fraco do exercício", () => {
  assert.throws(() => validarEntradaDoDiario({ aprendi: "pouco" }), /aprendeu/);
  assert.deepEqual(validarEntradaDoDiario({ aprendi: "  Aprendi a fatorar trinômios.  ", travei: "" }), { aprendi: "Aprendi a fatorar trinômios.", travei: "" });
  assert.deepEqual(pontosFracos([{ travei: "" }, { travei: "sinal negativo" }, { travei: "fração" }, { travei: "raiz" }]), ["sinal negativo", "fração"]);
  assert.equal(chaveDoDiario("2026-10-31"), "diario:2026-10-31");
});

caso("matemática e idiomas: os motores pelo assunto", () => {
  const dia = "2026-10-30";
  const opcoes = (perfil, titulo) => [...new Set([1, 2, 3, 4, 5, 6].map((rodada) => motorDoExercicio({ perfil, rodada, dia, assunto: { titulo } })))].sort();
  assert.deepEqual(opcoes("matematica", "Equações do 2º grau"), ["aberto", "calculo", "passos"]);
  assert.deepEqual(opcoes("matematica", "Gráfico da função afim"), ["aberto", "calculo", "grafico"]);
  assert.deepEqual(opcoes("matematica", "Porcentagem"), ["aberto", "calculo"]);
  assert.deepEqual(opcoes("idiomas", "No aeroporto"), ["aberto", "conversa", "ditado"]);
  assert.deepEqual(opcoes("musica", "Leitura na clave de sol"), ["aberto", "leitura"]);
});

caso("torre de um livro: as seções pelo sumário, os trechos de cada andar e o teto de andares", () => {
  const sumario = [{ titulo: "Cap 1", pagina: 5, nivel: 1 }, { titulo: "1.1", pagina: 7, nivel: 2 }, { titulo: "Cap 2", pagina: 30, nivel: 1 }, { titulo: "Cap 3", pagina: 60, nivel: 1 }];
  const secoes = secoesDoLivro(sumario, 100);
  assert.deepEqual(secoes.map((s) => [s.de, s.ate]), [[5, 29], [30, 59], [60, 100]], "o nível mais alto do sumário, até a próxima seção");
  const dez = faixasDosAndares(secoes, 10);
  assert.equal(dez.length, 10);
  for (let i = 1; i < dez.length; i++) assert.ok(dez[i].de > dez[i - 1].de, "na ordem do livro");
  assert.equal(dez[0].de, 5);
  assert.equal(dez.at(-1).ate, 100);
  const dois = faixasDosAndares(secoes, 2);
  assert.deepEqual(dois.map((f) => [f.de, f.ate]), [[5, 29], [30, 100]], "mais seções que andares: juntam");
  assert.equal(secoesDoLivro([], 40).length, 4, "sem sumário: fatias de umas 10 páginas");
  assert.deepEqual(andaresPermitidosDoLivro(3, 30), { min: 10, max: 15 }, "um andar a cada duas páginas");
  assert.equal(andaresPermitidosDoLivro(5, 400).max, 100);
  assert.equal(paginasDaFaixa({ de: 4, ate: 4 }), "p. 4");
});

caso("migração 024: só acrescenta (o diário, o livro da torre e o tipo diario)", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const sql = ler("../db/024-diario-e-torre-do-livro.sql");
  const tipos = (texto) => [...texto.match(/proof_eventos_tipo_check check \(tipo in \(([\s\S]*?)\)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const antes = tipos(ler("../db/023-cartoes-turma-e-torres-de-tema.sql"));
  for (const t of antes) assert.ok(tipos(sql).includes(t), `o tipo ${t} continua`);
  assert.ok(tipos(sql).includes("diario"));
  assert.match(sql, /create table if not exists public\.proof_diario/);
  assert.match(sql, /add column if not exists livro_id uuid/);
  assert.doesNotMatch(sql, /drop table|drop column/i);
});

// ---------------------------------------------------------------- o desenho de diagrama (31/10/2026)

caso("diagrama: o desafio da IA conferido (tipo, coleção do quadro, requisitos)", () => {
  const d = validarDesafioDeDiagrama({
    titulo: "Pedidos da loja", tipo: "dados", cenario: "Uma loja online vende produtos para clientes.",
    requisitos: ["CLIENTE com PK", "PEDIDO com FK para CLIENTE", "N:N entre PEDIDO e PRODUTO resolvido", "", "x".repeat(400)],
    criterios: ["notação"], dicas: ["comece pelas entidades"],
  });
  assert.equal(d.motor, "diagrama");
  assert.equal(d.colecao, "db", "o tipo diz a coleção que abre no quadro");
  assert.equal(d.requisitos.length, 4, "o vazio sai");
  assert.equal(d.requisitos[3].length, 260, "e o longo é cortado");
  assert.equal(validarDesafioDeDiagrama({ tipo: "inventado", cenario: "c", requisitos: ["a", "b", "c"] }).tipo, "fluxograma");
  assert.equal(validarDesafioDeDiagrama({ tipo: "nuvem", cenario: "c", requisitos: ["1", "2", "3", "4", "5", "6", "7", "8"] }).requisitos.length, 7);
  assert.throws(() => validarDesafioDeDiagrama({ tipo: "bpmn", cenario: "", requisitos: ["a", "b", "c"] }), /cenário/);
  assert.throws(() => validarDesafioDeDiagrama({ tipo: "bpmn", cenario: "c", requisitos: ["a", "b"] }), /requisitos/);
  assert.equal(motorDo({ motor: "diagrama" }), "diagrama");
  assert.ok(!corrigeNoServidor("diagrama"), "quem corrige é a Lisa");
  assert.equal(tentativasDe({ tipo: "exercicio", conteudo: { motor: "diagrama" } }), 5, "cinco tentativas, vale a melhor nota");
});

const formaDeTeste = (id, type, text, x = 0, y = 0, w = 120, h = 60) => ({ id, type, text, x, y, w, h, color: "purple" });

caso("diagrama: o documento do quadro conferido (vazio, tamanho, imagens coladas, formato antigo)", () => {
  assert.equal(conferirDiagrama(null).ok, false);
  assert.match(conferirDiagrama({ pages: [{ shapes: [formaDeTeste("a", "process", "só uma")], connections: [] }] }).motivo, /pelo menos duas/);
  const tinta = { pages: [{ shapes: [formaDeTeste("a", "ink", ""), formaDeTeste("b", "ink", ""), formaDeTeste("c", "process", "x")], connections: [] }] };
  assert.equal(conferirDiagrama(tinta).ok, false, "rabisco à mão não conta como forma");
  const comImagem = {
    name: "Meu fluxo", pages: [{ id: "p1", name: "Página 1", shapes: [formaDeTeste("a", "process", "A"), formaDeTeste("b", "decision", "B?"), { ...formaDeTeste("i", "image", ""), src: "data:image/png;base64,AAAA" }],
      connections: [{ id: "c1", from: "a", to: "b" }, { id: "c2", from: "a" }] }],
  };
  const ok = conferirDiagrama(comImagem);
  assert.ok(ok.ok);
  assert.equal(ok.formas, 3);
  assert.equal(ok.ligacoes, 1, "a ligação sem destino sai");
  assert.equal(ok.doc.pages[0].shapes.find((s) => s.id === "i").src, "", "a imagem colada não é guardada");
  assert.equal(ok.doc.format, "processmap");
  assert.equal(ok.doc.version, 4);
  const antigo = conferirDiagrama({ shapes: [formaDeTeste("a", "process", "A"), formaDeTeste("b", "process", "B")], connections: [] });
  assert.ok(antigo.ok && antigo.doc.pages.length === 1, "o formato sem abas vira uma aba");
  const muitas = { pages: [{ shapes: Array.from({ length: LIMITES_DO_DIAGRAMA.formas + 1 }, (_, i) => formaDeTeste(`f${i}`, "process", "")), connections: [] }] };
  assert.match(conferirDiagrama(muitas).motivo, /formas/);
  const pesado = { pages: [{ shapes: [formaDeTeste("a", "note", "x".repeat(LIMITES_DO_DIAGRAMA.caracteres)), formaDeTeste("b", "process", "B")], connections: [] }] };
  assert.match(conferirDiagrama(pesado).motivo, /grande demais/);
});

caso("diagrama: o desenho em texto para a Lisa (formas, tabelas, raias, pontas e rótulos)", () => {
  const doc = {
    pages: [{
      name: "Modelo",
      shapes: [
        formaDeTeste("raia", "lane", "Financeiro", 0, 0, 800, 200),
        formaDeTeste("t1", "dbTable", "CLIENTE\nPK id: int\nnome: varchar(120)", 20, 20, 200, 120),
        formaDeTeste("t2", "dbTable", "PEDIDO\nPK id: int\nFK id_cliente: int", 400, 20, 200, 120),
        formaDeTeste("fora", "process", "Conferir", 20, 400),
        formaDeTeste("rabisco", "ink", ""),
      ],
      connections: [
        { id: "c1", from: "t1", to: "t2", arrow: "many", arrowStart: "oneOnly", labelFrom: "1", labelTo: "N", label: "faz" },
        { id: "c2", from: "t2", to: "fora", dashed: true, arrow: "none" },
      ],
    }],
  };
  const t = descreverDiagrama(doc);
  assert.match(t, /ABA "Modelo" — 4 formas, 2 ligações/, "o rabisco não entra");
  assert.match(t, /\[t1\] tabela: "CLIENTE \| PK id: int \| nome: varchar\(120\)"/, "as linhas da tabela, uma a uma");
  assert.match(t, /\[raia\] raia: "Financeiro" — contém: \[t1\], \[t2\]/);
  assert.match(t, /\[t2\] tabela: .*\(dentro de \[raia\]\)/);
  assert.doesNotMatch(t, /\[fora\] processo: "Conferir" \(dentro/, "o que está fora da raia não está dentro");
  assert.match(t, /- \[t1\] tabela "CLIENTE" → \[t2\] tabela "PEDIDO" \(ponta no destino: muitos; ponta na origem: um e somente um; rótulo "faz"; na origem "1"; no destino "N"\)/);
  assert.match(t, /- \[t2\] tabela "PEDIDO" → \[fora\] processo "Conferir" \(ponta no destino: sem ponta; tracejada\)/);
  assert.equal(descreverDiagrama({ pages: [] }), "(o desenho está vazio)");
});

caso("diagrama: entra na prática de programação e do perfil livre só na área de arquitetura e computação", () => {
  const dia = "2026-10-30";
  const opcoes = (perfil, tema, titulo) => [...new Set([1, 2, 3, 4, 5, 6].map((rodada) => motorDoExercicio({ perfil, rodada, dia, tema, assunto: { titulo } })))].sort();
  assert.deepEqual(opcoes("programacao", "Arquitetura de software", "Microsserviços e mensageria"), ["codigo", "diagrama"]);
  assert.deepEqual(opcoes("programacao", "Python para iniciantes", "Listas e dicionários"), ["codigo"], "fora da área: só código, como antes");
  assert.deepEqual(opcoes("programacao", "Python para iniciantes", "Fluxogramas e algoritmos"), ["codigo", "diagrama"], "o assunto de desenho vale em qualquer curso");
  assert.deepEqual(opcoes("livre", "Gestão de processos", "Mapeamento de processos com BPMN"), ["aberto", "diagrama"]);
  assert.deepEqual(opcoes("livre", "Culinária", "Massas frescas"), ["aberto"]);
  assert.deepEqual(opcoes("idiomas", "Arquitetura de software em inglês", "No aeroporto"), ["aberto", "conversa", "ditado"], "os outros perfis não mudam");
  // assunto de desenho: o diagrama é o primeiro da roda; curso da área num assunto de código: um dia em três
  assert.deepEqual(motoresComDiagrama(["codigo"], { assunto: { titulo: "Modelagem de dados" } }), ["diagrama", "codigo"]);
  assert.deepEqual(motoresComDiagrama(["codigo"], { tema: "Ciência da Computação", assunto: { titulo: "Ponteiros" } }), ["codigo", "codigo", "diagrama"]);
  const tresDias = ["2026-10-30", "2026-10-31", "2026-11-01"].map((d) => motorDoExercicio({ perfil: "programacao", dia: d, tema: "Ciência da Computação", assunto: { titulo: "Ponteiros" } }));
  assert.equal(tresDias.filter((m) => m === "diagrama").length, 1);
  assert.equal(motorDoExercicio({ perfil: "programacao", rodada: 2 }), "codigo", "sem tema nem assunto, como sempre");
  assert.ok(pedeDiagrama({ tema: "Engenharia de Software" }) && !pedeDiagrama({ tema: "Violão" }));
});

caso("diagrama: o tipo sugerido pelo assunto, as formas de cada tipo e a notação", () => {
  assert.equal(tiposSugeridos({ assunto: { titulo: "Modelo entidade-relacionamento e normalização" } })[0], "dados");
  assert.equal(tiposSugeridos({ assunto: { titulo: "Notação BPMN: eventos e gateways" } })[0], "bpmn");
  assert.equal(tiposSugeridos({ assunto: { titulo: "Herança e polimorfismo" } })[0], "classes");
  assert.equal(tiposSugeridos({ assunto: { titulo: "Alta disponibilidade na AWS" } })[0], "nuvem");
  assert.equal(tiposSugeridos({ tema: "Arquitetura de software", assunto: { titulo: "Introdução" } })[0], "arquitetura", "sem pista no assunto, vale o curso");
  assert.deepEqual(tiposSugeridos({ assunto: { titulo: "Introdução" } }), ["fluxograma", "arquitetura"]);
  for (const t of ORDEM_DOS_DIAGRAMAS) {
    assert.ok(formasDoTipo(t).length >= 4, `o tipo ${t} tem formas no quadro`);
    assert.ok(NOTACAO_DO_TIPO[t], `o tipo ${t} tem a notação`);
  }
  assert.ok(formasDoTipo("dados").includes("tabela"));
  assert.ok(formasDoTipo("nuvem").includes("balanceador de carga"));
});

caso("diagrama: toda forma das coleções do quadro tem nome para a Lisa, e o middleware deixa o quadro passar", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const biblioteca = ler("../public/diagramas/js/ShapeLibrary.js");
  const colecoes = [...biblioteca.matchAll(/\{ id: '([a-z0-9]+)', label: '[^']+', order: \[([^\]]+)\] \}/g)].map((m) => [m[1], [...m[2].matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1])]);
  assert.ok(colecoes.length >= 8, "as coleções do quadro (fluxo, UML, casos de uso, banco, arquitetura, BPMN, nuvem, C4)");
  for (const [id, formas] of colecoes) {
    for (const f of formas) assert.ok(NOMES_DAS_FORMAS[f], `a forma ${f} (coleção ${id}) tem nome`);
  }
  const doTipo = new Set(Object.values(TIPOS_DE_DIAGRAMA).map((t) => t.colecao));
  for (const c of doTipo) assert.ok(colecoes.some(([id]) => id === c), `a coleção ${c} existe no quadro`);
  assert.match(ler("../src/middleware.js"), /diagramas\//, "o quadro é arquivo estático: sem sessão no caminho");
  assert.match(ler("../public/diagramas/index.html"), /js\/Ponte\.js/);
});

// ---------------------------------------------------------------- a Lisa jogadora (BEYOND-0014)
caso("lisa jogadora: um curso de tecnologia por mês, sem repetir", () => {
  assert.equal(temaDoMes([]), TEMAS_DE_TECNOLOGIA[0]);
  assert.equal(temaDoMes([TEMAS_DE_TECNOLOGIA[0], TEMAS_DE_TECNOLOGIA[1].toUpperCase()]), TEMAS_DE_TECNOLOGIA[2], "sem ligar para maiúsculas");
  assert.ok(TEMAS_DE_TECNOLOGIA.includes(temaDoMes(TEMAS_DE_TECNOLOGIA)), "todos feitos: recomeça a lista");
  assert.match(CONTA_DA_LISA.apelido, /Lisa/);
});
caso("lisa jogadora: a assertividade cresce com o curso e os erros ensinam", () => {
  const dia0 = chanceDeAcerto({ diasNoCurso: 0 });
  const dia10 = chanceDeAcerto({ diasNoCurso: 10 });
  const dia30 = chanceDeAcerto({ diasNoCurso: 30 });
  assert.ok(dia0 >= 0.5 && dia0 <= 0.6, `começa aprendendo (${dia0})`);
  assert.ok(dia0 < dia10 && dia10 < dia30 && dia30 <= 0.92, `sobe com o mês (${dia0} → ${dia10} → ${dia30})`);
  assert.ok(chanceDeAcerto({ diasNoCurso: 10, errosRecentes: 1 }) < dia10, "quem errou muito ontem acerta um pouco menos hoje");
  const sortear = sorteioDaLisa(sementeDe("2026-11-03:quiz"));
  const perguntas = Array.from({ length: 200 }, () => ({ opcoes: ["a", "b", "c", "d"], correta: 2 }));
  const escolhas = respostasDoQuiz(perguntas, 0.7, sortear);
  const taxa = escolhas.filter((e) => e === 2).length / escolhas.length;
  assert.ok(taxa > 0.6 && taxa < 0.8, `acerta perto da chance (${taxa})`);
  assert.ok(escolhas.every((e) => e >= 0 && e <= 3), "quando erra, marca uma opção que existe");
  assert.deepEqual(respostasDoQuiz(perguntas.slice(0, 5), 0.7, sorteioDaLisa(7)), respostasDoQuiz(perguntas.slice(0, 5), 0.7, sorteioDaLisa(7)), "a mesma semente, as mesmas escolhas");
});
caso("lisa jogadora: a agenda do dia, como uma pessoa", () => {
  assert.deepEqual(oQueFazerAgora({ hora: 6, diaDaSemana: 2 }), [], "de madrugada, nada");
  assert.deepEqual(oQueFazerAgora({ hora: 8, diaDaSemana: 2 }), ["curso", "mina", "teoria"]);
  assert.ok(!oQueFazerAgora({ hora: 9, diaDaSemana: 2 }).includes("bolsa") && oQueFazerAgora({ hora: 10, diaDaSemana: 2 }).includes("bolsa"));
  assert.ok(!oQueFazerAgora({ hora: 17, diaDaSemana: 2 }).includes("bolsa"), "a Bolsa só negocia até as 17h");
  // mais vezes no dia (03/11/2026: "quero ver ela jogando mais vezes"), com intervalo entre uma e outra
  const agora = Date.parse("2026-11-03T15:00:00Z");
  const horas = (h) => agora - h * 3_600_000;
  assert.ok(oQueFazerAgora({ hora: 12, diaDaSemana: 2, agora, jogadas: { reino: { vezes: 1, ultima: horas(3) } } }).includes("reino"), "o Reino de novo depois de 3 h");
  assert.ok(!oQueFazerAgora({ hora: 12, diaDaSemana: 2, agora, jogadas: { reino: { vezes: 1, ultima: horas(1) } } }).includes("reino"), "mas não antes");
  assert.ok(!oQueFazerAgora({ hora: 20, diaDaSemana: 2, agora, jogadas: { reino: { vezes: 4, ultima: horas(9) } } }).includes("reino"), "até 4 vezes no dia");
  assert.ok(!oQueFazerAgora({ hora: 14, diaDaSemana: 2, agora, jogadas: { quiz: { vezes: 1, ultima: horas(9) } } }).includes("quiz"), "o quiz é uma vez só");
  assert.ok(oQueFazerAgora({ hora: 13, diaDaSemana: 2 }).includes("minigame"), "o minigame do dia entra na agenda");
  const vezesNoDia = AGENDA_DA_LISA.reduce((s, a) => s + (a.vezes || 1), 0);
  assert.ok(vezesNoDia >= 25, `ela joga muitas vezes no dia (${vezesNoDia})`);
  assert.ok(!oQueFazerAgora({ hora: 22, diaDaSemana: 2 }).includes("acervo"), "o Acervo é só no domingo");
  assert.ok(oQueFazerAgora({ hora: 22, diaDaSemana: 0 }).includes("acervo") && oQueFazerAgora({ hora: 22, diaDaSemana: 0 }).includes("caderno"));
  const n = itensDaTeoriaHoje(sorteioDaLisa(3));
  assert.ok(n >= 2 && n <= 5, "de 2 a 5 itens da teoria por dia");
});
caso("lisa jogadora: no Reino e na Bolsa, com reserva; invade alguém do tamanho dela", () => {
  const opcoes = [{ chave: "muralha", custo: 400, prioridade: 1 }, { chave: "mina", custo: 250, prioridade: 3 }, { chave: "quartel", custo: 900, prioridade: 5 }];
  assert.equal(melhoriaDaVez(opcoes, 500).chave, "mina", "a de maior prioridade que cabe, deixando a reserva");
  assert.equal(melhoriaDaVez(opcoes, 300), null, "sem sobra além da reserva, não gasta");
  const acoes = [{ codigo: "ASTRO", preco: 55 }, { codigo: "NEURO", preco: 900 }];
  const sempre = () => 0.9;
  assert.deepEqual(compraNaBolsa(acoes, 420, sempre), { codigo: "ASTRO", quantidade: 2 });
  assert.equal(compraNaBolsa(acoes, 320, sempre), null, "sem sobra além da reserva");
  assert.equal(compraNaBolsa(acoes, 5000, () => 0.1), null, "nem todo dia ela mexe na Bolsa");
  const reinos = [{ usuarioId: "eu", trofeus: 100 }, { usuarioId: "a", trofeus: 10 }, { usuarioId: "b", trofeus: 95 }, { usuarioId: "c", trofeus: 400 }, { usuarioId: "d", trofeus: 120 }, { usuarioId: "e", trofeus: 80 }];
  const alvo = alvoDaInvasao(reinos, "eu", 100, sorteioDaLisa(1));
  assert.ok(["b", "d", "e"].includes(alvo.usuarioId), `um dos três mais parecidos (${alvo.usuarioId})`);
  assert.equal(alvoDaInvasao([{ usuarioId: "eu", trofeus: 1 }], "eu", 1, sorteioDaLisa(1)), null, "nunca ela mesma");
});

caso("lisa jogadora: o diagrama dela vira um documento que o quadro aceita", () => {
  const doc = documentoDoDiagrama({ titulo: "Rede da empresa", formas: [
    { id: "a", tipo: "terminal", texto: "Internet" }, { id: "b", tipo: "process", texto: "Roteador" }, { id: "c", tipo: "database", texto: "Servidor" },
    { id: "d", tipo: "inventado", texto: "Switch" }, { id: "e", tipo: "note", texto: "  " },
  ], ligacoes: [{ de: "a", para: "b", rotulo: "WAN" }, { de: "b", para: "c" }, { de: "b", para: "x" }, { de: "c", para: "c" }] });
  const r = conferirDiagrama(doc);
  assert.ok(r.ok, r.motivo);
  assert.equal(r.formas, 4, "forma sem texto sai");
  assert.equal(r.ligacoes, 2, "ligação para forma que não existe (ou para si mesma) sai");
  assert.equal(doc.pages[0].shapes.find((s) => s.id === "d").type, "process", "tipo desconhecido vira processo");
  assert.equal(conferirDiagrama(documentoDoDiagrama({ formas: [{ id: "a", texto: "só uma" }] })).ok, false, "uma forma só não é diagrama");
});
caso("lisa jogadora: a rotina, a conta-robô e a página pública", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const script = ler("../src/lib/lisaRotina.js");
  assert.match(script, /oQueFazerAgora\(\{ hora, diaDaSemana, jogadas: await jogadasDeHoje\(id\), agora: agora\.getTime\(\) \}\)\.slice\(0, maximo\)/, "faz o que está na vez (até algumas por rodada)");
  assert.ok(script.includes("await registrarNoDiario(id, acao, `Tentei ${NOME_DA_ACAO[acao] || acao} e não deu desta vez.`"), "falhou: fica no diário e não insiste");
  for (const f of ["marcarItem", "responderQuiz", "entregarEvidencia", "melhorarConstrucao", "invadir", "comprarAcao", "criarMaterial", "criarPagina"]) {
    assert.ok(script.includes(`${f}(`), `joga pelas mesmas funções das telas: ${f}`);
  }
  assert.match(script, /no_ranking: true, meta_diaria: 30, robo: true/, "a conta nasce marcada como robô");
  assert.ok(!/senha_hash: ["'`]/.test(script), "a senha dela é aleatória (ninguém entra pela tela)");
  assert.match(ler("../db/026-lisa-jogadora.sql"), /add column if not exists robo boolean not null default false[\s\S]*create table if not exists public\.proof_lisa_diario[\s\S]*enable row level security/);
  assert.match(ler("../src/app/api/lisa/route.js"), /await exigirUsuario\(req\);\s*return json\(\{ ok: true, \.\.\.\(await perfilDaLisa\(\)\) \}\)/);
  assert.match(ler("../src/componentes/Moldura.js"), /\{ href: "\/lisa", rotulo: "Lisa joga", Icone: IconeLisa, grupo: "Jogo" \}/);
  assert.match(ler("../package.json"), /"lisa-joga": "node --env-file=\.env\.local --import \.\/scripts\/alias-loader\.mjs scripts\/lisa-joga\.mjs"/);
  assert.match(ler("../src/lib/lisaJogadora.js"), /link: m\.status === "aprovado" \? m\.link : null/, "link do Acervo só depois de aprovado");
});

// ---------------------------------------------------------------- o correio (BEYOND-0016)
caso("correio: o recado, para quem dá para escrever, e ninguém pergunta para a Lisa", () => {
  assert.deepEqual(conferirRecado("  valeu pela dica  "), { ok: true, texto: "valeu pela dica" });
  assert.equal(conferirRecado("oi").ok, false);
  assert.equal(conferirRecado("x".repeat(CORREIO.recadoMaximo + 1)).ok, false);
  assert.equal(podeEscreverPara({ de: "a", para: "a", tipo: "recado" }).ok, false, "não para si mesmo");
  assert.equal(podeEscreverPara({ de: "a", para: "lisa", tipo: "pergunta", paraEhRobo: true }).ok, false, "a Lisa não recebe pergunta");
  assert.equal(podeEscreverPara({ de: "a", para: "lisa", tipo: "recado", paraEhRobo: true }).ok, true, "recado para a Lisa pode");
});
caso("correio: o quiz termina com 3 respondidas e 2 pelo correio, valendo menos e sem o bônus", () => {
  const perguntas = Array.from({ length: 5 }, () => ({ opcoes: ["a", "b", "c", "d"], correta: 1 }));
  const normal = contaDoQuiz(perguntas, { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, [], pontosDoQuiz, PONTOS_DA_PRATICA.acertoNoQuiz);
  assert.deepEqual([normal.terminou, normal.nota, normal.pontos], [true, 100, pontosDoQuiz(5, 5)], "sem correio, como sempre");
  const comCorreio = contaDoQuiz(perguntas, { 0: 1, 2: 1, 4: 0 }, [1, 3], pontosDoQuiz, PONTOS_DA_PRATICA.acertoNoQuiz);
  assert.equal(comCorreio.terminou, true);
  assert.equal(comCorreio.nota, 67, "a nota é sobre as 3 que ficaram (2 de 3)");
  assert.equal(comCorreio.pontos, Math.round(2 * PONTOS_DA_PRATICA.acertoNoQuiz * CORREIO.fatorDoQuizComCorreio), "só os acertos, reduzidos");
  assert.ok(comCorreio.pontos < pontosDoQuiz(2, 5), "vale menos que responder tudo");
  const errouEMandou = contaDoQuiz(perguntas, { 0: 0, 1: 1, 2: 1, 3: 1 }, [0], pontosDoQuiz, PONTOS_DA_PRATICA.acertoNoQuiz);
  assert.equal(errouEMandou.terminou, false, "falta a 5ª");
  assert.equal(errouEMandou.acertos, 3, "a errada que foi pelo correio sai do placar");
  assert.equal(contaDoQuiz(perguntas, { 0: 1 }, [], pontosDoQuiz, 15).pontos, 0, "sem terminar, sem pontos");
});
caso("correio: quando dá para mandar uma pergunta do quiz", () => {
  const perguntas = Array.from({ length: 5 }, () => ({ correta: 2 }));
  assert.equal(podeMandarPergunta({ perguntas, indice: 0 }).ok, true, "a que ainda não respondeu");
  assert.equal(podeMandarPergunta({ perguntas, escolhas: { 0: 1 }, indice: 0 }).ok, true, "a que errou");
  assert.equal(podeMandarPergunta({ perguntas, escolhas: { 0: 2 }, indice: 0 }).ok, false, "a que acertou, não");
  assert.equal(podeMandarPergunta({ perguntas, enviadas: [0, 1], indice: 2 }).ok, false, "até 2 por quiz");
  assert.equal(podeMandarPergunta({ perguntas, indice: 0, status: "concluido" }).ok, false, "quiz terminado, não");
  assert.equal(podeMandarPergunta({ perguntas: perguntas.slice(0, 4), enviadas: [0], indice: 1 }).ok, false, "sobram pelo menos 3 para responder");
  assert.equal(podeMandarPergunta({ perguntas, enviadas: [3], indice: 3 }).ok, false, "a mesma duas vezes, não");
  assert.ok(!("correta" in perguntaNaCarta({ pergunta: "?", opcoes: [], correta: 1 })), "a carta não leva a resposta antes de responder");
});
caso("correio: recompensas, com teto para não virar mina de moedas", () => {
  assert.deepEqual(recompensaDoRecado({ util: true }), { remetente: CORREIO.recompensaDoRecado, destinatario: CORREIO.recompensaDoRecado });
  assert.deepEqual(recompensaDoRecado({ util: false }), { remetente: 0, destinatario: 0 });
  assert.equal(recompensaDoRecado({ util: true, pagosHojeAoRemetente: CORREIO.recadosPagosPorDia }).remetente, 0, "quem manda ganha de poucos por dia");
  assert.deepEqual(recompensaDoRecado({ util: true, parJaPagouHoje: true }), { remetente: 0, destinatario: 0 }, "o mesmo par rende uma vez por dia");
  assert.deepEqual(recompensaDaPergunta(true), { destinatario: CORREIO.recompensaDaPergunta, remetente: CORREIO.ajudaDaPergunta });
  assert.deepEqual(recompensaDaPergunta(false), { destinatario: 0, remetente: 0 });
});
caso("correio: as rotas, a tela, o quiz e a Lisa", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const lib = ler("../src/lib/correio.js");
  assert.match(lib, /\.eq\("id", c\.id\)\.is\("avaliacao", null\)/, "a avaliação marca antes de pagar (dois cliques não pagam duas vezes)");
  assert.match(lib, /\.eq\("id", c\.id\)\.is\("escolha", null\)/);
  assert.match(lib, /creditarMoedas\(usuarioId, "correio"/);
  assert.match(lib, /return gravarQuiz\(\{ usuarioId, d, escolhas, enviadas: \[\.\.\.enviadas, i\] \}\)/, "a pergunta mandada pode fechar o quiz");
  const pratica = ler("../src/lib/pratica.js");
  assert.match(pratica, /const c = contaDoQuiz\(perguntas, escolhas, enviadas, pontosDoQuiz, PONTOS_DA_PRATICA\.acertoNoQuiz\);/);
  assert.match(pratica, /if \(enviadas\.includes\(i\)\) throw new ErroDeAcesso\(409, "esta pergunta foi pelo correio"\)/);
  assert.match(ler("../db/027-correio.sql"), /create table if not exists public\.proof_correio[\s\S]*proof_correio_pergunta_unica[\s\S]*'estorno', 'correio'\)\);[\s\S]*'estorno', 'correio'\)\);/);
  const quiz = ler("../src/componentes/Desafios.js");
  assert.match(quiz, /const valem = perguntas\.filter\(\(p\) => !p\.enviada\);/, "o placar final sem as que foram pelo correio");
  assert.match(quiz, /<MandarPorCorreio desafioId=\{desafio\.id\}/);
  assert.match(ler("../src/componentes/Moldura.js"), /\{ href: "\/correio", rotulo: "Correio", Icone: IconeCorreio, grupo: "Jogo" \}/);
  assert.match(ler("../src/lib/lisaRotina.js"), /const ACOES = \{[^}]*correio[,}]/);
  assert.ok(oQueFazerAgora({ hora: 18, diaDaSemana: 2 }).includes("correio"), "a Lisa passa no correio no fim da tarde");
});

caso("projeto em arquivos (sem GitHub): a conferência dos arquivos", () => {
  const ok = arquivosDoProjeto([{ caminho: "/src/app.py", conteudo: "print(1)" }, { caminho: "README.md", conteudo: "# Projeto" }]);
  assert.deepEqual(ok, { ok: true, arquivos: [{ caminho: "src/app.py", conteudo: "print(1)" }, { caminho: "README.md", conteudo: "# Projeto" }] });
  assert.equal(arquivosDoProjeto([]).ok, false);
  assert.equal(arquivosDoProjeto([{ caminho: "../segredo", conteudo: "x" }]).ok, false, "nada de subir pastas");
  assert.equal(arquivosDoProjeto([{ caminho: "a.js", conteudo: "1" }, { caminho: "a.js", conteudo: "2" }]).ok, false, "o mesmo arquivo duas vezes");
  assert.equal(arquivosDoProjeto([{ caminho: "a.js", conteudo: "  " }]).ok, false, "arquivo vazio");
  assert.equal(arquivosDoProjeto(Array.from({ length: 21 }, (_, i) => ({ caminho: `f${i}.js`, conteudo: "x" }))).ok, false, "até 20 arquivos");
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const pratica = ler("../src/lib/pratica.js");
  assert.match(pratica, /export async function entregarProjetoEmArquivos\(\{ usuarioId, id, arquivos \}\)[\s\S]*?avaliarProjeto\(\{ tema: trilha\.tema, projeto: d\.conteudo, repositorio \}\)/, "a mesma correção do repositório");
  const script = ler("../src/lib/lisaRotina.js");
  assert.match(script, /await entregarProjetoEmArquivos\(\{ usuarioId: id, id: d\.id, arquivos \}\)/, "a Lisa entrega o projeto de programação em arquivos");
  assert.match(script, /await enviarExercicio\(\{ usuarioId: id, id: d\.id, codigo: await codigoDaEntrega/, "e o exercício de código");
  assert.match(script, /const criado = await criarCurso\(\{ usuarioId: id, proposta: r\.proposta,/, "o perfil do curso é o que a IA propôs");
  assert.ok(TEMAS_DE_TECNOLOGIA.some((t) => /python|javascript|sql/i.test(t)), "com cursos de programação na lista");
});
caso("modo espectador: as telas da Lisa por dentro, só para olhar", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const sessao = ler("../src/lib/sessao.js");
  assert.match(sessao, /if \(req\.method !== "GET" && req\.method !== "HEAD"\) throw new ErroDeAcesso\(403/, "nada se escreve espiando");
  assert.match(sessao, /if \(!perfil\?\.robo\) return null;/, "só a conta-robô pode ser espiada");
  assert.ok(sessao.includes(String.raw`const SO_DELA = [/^\/api\/correio`), "o correio e os chamados dela ficam de fora");
  assert.ok(sessao.includes(String.raw`const DA_PESSOA = [/^\/api\/auth`), "o login e o próprio modo seguem com a pessoa");
  assert.match(ler("../src/app/api/espiar/route.js"), /await exigirUsuarioReal\(req\)/);
  assert.match(ler("../src/componentes/Moldura.js"), /<FaixaDoEspectador \/>/);
  assert.match(ler("../src/app/(app)/lisa/page.js"), /<BotaoDeEspiar \/>/);
});
caso("correio no Reino: a caixa com o pombo-carteiro, a bandeirinha e a folha das cartas", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const mundo = ler("../src/componentes/reino/Mundo3D.js");
  assert.match(mundo, /function caixaDeCorreio\(p\)/);
  assert.match(mundo, /g\.traverse\(\(o\) => \{ o\.userData\.chave = "correio"; \}\);/, "tocar na caixa escolhe o correio");
  assert.match(mundo, /correio\.userData\.bandeira\.rotation\.z = novas \? 0 : Math\.PI \/ 2;/, "a bandeirinha sobe com carta nova");
  assert.match(mundo, /api\.current\?\.definirCartas\(cartas\);/);
  const pagina = ler("../src/app/(app)/reino/page.js");
  assert.match(pagina, /if \(chave === "correio"\) \{ setCorreioAberto\(true\); return; \}/);
  assert.match(pagina, /cartas=\{vendo \|\| naIlha \? null : cartas\}/, "na visita a outro reino (e numa ilha), a caixa não aparece");
  assert.match(ler("../src/componentes/reino/CorreioDoReino.js"), /<Recebidas cartas=\{caixa\.recebidas\.slice\(0, 10\)\} agir=\{agir\} \/>/);
  assert.match(CONTA_DA_LISA.reino, /Lisa/, "o reino da Lisa tem nome próprio");
  assert.match(ler("../src/lib/lisaRotina.js"), /await renomearReino\(id, CONTA_DA_LISA\.reino\)/);
});

caso("Raposão: o personagem azul e branco, à venda por 610, e a área de presentes", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  assert.equal(PERSONAGENS.raposao.emoji, "🦊");
  assert.ok(ORDEM_DOS_PERSONAGENS.indexOf("raposao") > ORDEM_DOS_PERSONAGENS.indexOf("astronauta") && ORDEM_DOS_PERSONAGENS.indexOf("raposao") < ORDEM_DOS_PERSONAGENS.indexOf("mago"), "na vitrine, pelo preço");
  assert.match(ler("../src/componentes/Neuro.js"), /<g className="acc acc-raposao">/, "o desenho por cima do Neuro");
  const css = ler("../src/app/neuro.css");
  assert.match(css, /\.neuro\[data-personagem="raposao"\] \.acc-raposao/);
  assert.match(css, /\.neuro\[data-personagem="raposao"\] \{ --neuro-rosa: #1E4FB8;/, "azul");
  const reino = ler("../src/lib/reino.js");
  assert.match(reino, /export function darPersonagem\(usuarioId, id\)[\s\S]*?noMundo\("real"[\s\S]*?lancarEGravar\(reino, \[\], \{ personagens:/, "presente entra na coleção sem cobrar, no mundo de verdade");
  const presentes = ler("../src/lib/presentes.js");
  assert.match(presentes, /\.eq\("id", id\)\.is\("aberto_em", null\)/, "abrir marca antes de entregar (dois cliques não entregam duas vezes)");
  assert.match(presentes, /update\(\{ aberto_em: null \}\)/, "se a entrega falhar, o presente volta a ficar fechado");
  assert.match(ler("../db/028-presentes.sql"), /create unique index if not exists proof_presentes_um_por_item on public\.proof_presentes \(usuario_id, tipo, item\)/);
  assert.match(ler("../src/componentes/Moldura.js"), /\{ href: "\/presentes", rotulo: "Presentes", Icone: IconePresentes, grupo: "Você" \}/);
  const novidades = ler("../src/componentes/Novidades.js");
  // as edições seguintes trocaram o Raposão pelo clima e, depois, pelo anúncio da versão 1.0
  assert.match(novidades, /EDICAO_DAS_NOVIDADES = "2026-11-03-versao-1-banner"/, "a edição nova aparece de novo para todo mundo");
  // o banner da 1.0 no topo do modal (03/11/2026), servido sem passar pelo portão de login
  assert.match(novidades, /srcSet="\/novidades\/lisa-proof-1-0\.webp"/);
  assert.ok(fs.existsSync(new URL("../public/novidades/lisa-proof-1-0.webp", import.meta.url)) && fs.existsSync(new URL("../public/novidades/lisa-proof-1-0-900.webp", import.meta.url)));
  assert.match(fs.readFileSync(new URL("../src/middleware.js", import.meta.url), "utf8"), /diagramas\/\|novidades\/\|/);
  assert.match(novidades, /O Lisa_Proof chegou à versão 1\.0!/);
  for (const t of ["Temporada das Ilhas", "Arena Lúdica de Programação", "O exemplo da Lisa nos exercícios", "Reino maior", "Chefões com dentes"]) assert.ok(novidades.includes(t), t);
});
caso("modo espectador: a tela também não deixa escolher nada (só olhar)", () => {
  const moldura = fs.readFileSync(new URL("../src/componentes/Moldura.js", import.meta.url), "utf8");
  assert.match(moldura, /const ONDE_TRAVA = "\.pf-principal, \.folha";/, "o conteúdo e as folhas (que abrem por portal)");
  assert.match(moldura, /for \(const tipo of \["click", "submit", "change"\]\) document\.addEventListener\(tipo, travar, true\);/);
  assert.match(moldura, /document\.addEventListener\("focusin", tirarFoco, true\);/, "campos não recebem foco");
  assert.match(moldura, /const LIVRES = 'a\[href\], \[role="tab"\], summary, \[aria-expanded\], \.pf-espectador, \.rn-mundo__rotulo/, "navegar, abas, seções e as construções continuam");
});

caso("clima do Reino: a luz pela hora de Brasília e o tempo por blocos de 3 horas, igual para todos", () => {
  assert.equal(luzDaHora(3).periodo, "madrugada");
  assert.equal(luzDaHora(3).sol, 0);
  assert.equal(luzDaHora(6).periodo, "amanhecer");
  assert.ok(luzDaHora(6).sol > 0 && luzDaHora(6).sol < 1 && luzDaHora(6).quente > 0.5, "o amanhecer é dourado");
  assert.equal(luzDaHora(12).sol, 1);
  assert.equal(luzDaHora(12).quente, 0);
  assert.equal(luzDaHora(18).periodo, "entardecer");
  assert.equal(luzDaHora(20).periodo, "noite");
  assert.equal(luzDaHora(20).sol, 0);
  assert.ok(luzDaHora(7).lado < 0 && luzDaHora(17).lado > 0, "o sol nasce de um lado e se põe do outro");
  assert.deepEqual(luzDaHora(26), luzDaHora(2), "a hora dá a volta");
  // Brasília: 23h UTC são 20h aqui
  assert.deepEqual(agoraEmBrasilia(new Date("2026-11-03T23:30:00Z")), { hora: 20.5, dia: "2026-11-03", mes: 11 });
  assert.deepEqual(agoraEmBrasilia(new Date("2026-11-04T02:00:00Z")).dia, "2026-11-03", "à meia-noite UTC ainda é o dia anterior aqui");
  // o mesmo bloco dá o mesmo tempo para todos; dentro do bloco, não muda
  assert.deepEqual(tempoDoBloco("2026-11-03", 13, 11), tempoDoBloco("2026-11-03", 14.9, 11));
  const contar = (mes) => {
    const n = {};
    for (let d = 1; d <= 28; d++) for (let b = 0; b < 8; b++) {
      const { tempo, vento, intensidade } = tempoDoBloco(`2026-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`, b * 3, mes);
      assert.ok(TEMPOS[tempo]);
      assert.ok(vento.forca >= 0 && vento.forca <= 1 && vento.direcao >= 0 && vento.direcao <= Math.PI * 2);
      assert.ok(intensidade >= 0.75 && intensidade <= 1);
      n[tempo] = (n[tempo] || 0) + 1;
    }
    return n;
  };
  const novembro = contar(11), julho = contar(7);
  assert.ok(Object.keys(novembro).length >= 5, "o tempo varia ao longo do mês");
  assert.ok(novembro.limpo > (novembro.chuva || 0), "céu limpo é o mais comum");
  assert.ok((julho.neve || 0) > (novembro.neve || 0), "neve é mais comum no inverno daqui");
  // o desenho: nuvens, chuva, neve, raios; e o selo
  const c = climaDoReino(new Date("2026-11-03T23:30:00Z"), { tempo: "tempestade" });
  assert.equal(c.tempo, "tempestade");
  assert.equal(c.raios, true);
  assert.ok(c.chuva > 0.7 && c.neve === 0 && c.escurece === 0.4);
  assert.match(textoDoClima(c), /^⛈️ Tempestade · .+ · noite$/);
  assert.match(textoDoClima(climaDoReino(new Date("2026-11-03T23:30:00Z"), { tempo: "limpo" })), /^🌙 Noite limpa · /, "de noite, céu limpo é lua");
  assert.match(textoDoClima(climaDoReino(new Date(), { tempo: "neve", hora: 12 })), /^🌨️ Neve · .+ · dia$/);
  assert.equal(climaDoReino(new Date(), { tempo: "inventado" }).tempo in TEMPOS, true, "tempo desconhecido não passa");
  const mundo = fs.readFileSync(new URL("../src/componentes/reino/Mundo3D.js", import.meta.url), "utf8");
  assert.doesNotMatch(mundo, /dataset\.tema === "escuro"/, "a noite do Reino é a do relógio, não a do tema");
  assert.match(mundo, /const PINGOS = semMovimento \? 0 : 700, FLOCOS = semMovimento \? 0 : 450;/, "sem movimento, nada cai");
  assert.match(mundo, /if \(clima\.raios && !cenarioDaIlha && !semMovimento\)/, "relâmpago só com movimento e fora das expedições");
  assert.match(fs.readFileSync(new URL("../src/app/reino.css", import.meta.url), "utf8"), /background: var\(--rn-ceu, linear-gradient/);
});

caso("humor do Neuro: a sequência faz ele evoluir (mina com bônus); sumir por dias o revolta e fecha as expedições", () => {
  assert.equal(diasSemEstudo(null, "2026-11-03"), null);
  assert.equal(diasSemEstudo("2026-11-03", "2026-11-03"), 0);
  assert.equal(diasSemEstudo("2026-11-02", "2026-11-03"), 1);
  assert.equal(diasSemEstudo("2026-10-30", "2026-11-03"), 4, "atravessa o mês");
  assert.equal(evolucaoDa(0).id, "comum");
  assert.equal(evolucaoDa(3).id, "animado");
  assert.equal(evolucaoDa(13).id, "radiante");
  assert.equal(evolucaoDa(30).id, "lendario");
  assert.ok(EVOLUCOES_DO_NEURO.every((e, i, l) => !i || (e.minimo > l[i - 1].minimo && e.bonus > l[i - 1].bonus)), "cada estágio pede mais dias e dá mais");
  assert.ok(EVOLUCOES_DO_NEURO.at(-1).bonus <= 0.2, "bônus moderado");
  const contente = humorDoNeuro({ ofensiva: { atual: 8, estudouHoje: true }, semEstudo: 0 });
  assert.equal(contente.estado, "contente");
  assert.equal(contente.humor, "comemorando");
  assert.equal(contente.bonusDaMina, 0.1);
  assert.equal(contente.expedicoesFechadas, false);
  assert.equal(contente.proximo.id, "brilhante");
  assert.equal(contente.proximo.faltam, 6);
  assert.equal(fatorDaMinaDoHumor(contente), 1.1);
  const risco = humorDoNeuro({ ofensiva: { atual: 4, estudouHoje: false }, semEstudo: 1 });
  assert.equal(risco.estado, "em-risco");
  assert.equal(risco.bonusDaMina, 0.05, "a sequência ainda vale até o dia acabar");
  const chateado = humorDoNeuro({ ofensiva: { atual: 0, estudouHoje: false }, semEstudo: DIAS_PARA_REVOLTAR - 1 });
  assert.equal(chateado.estado, "chateado");
  assert.equal(chateado.humor, "triste");
  assert.equal(chateado.expedicoesFechadas, false, "chateado só avisa");
  const revoltado = humorDoNeuro({ ofensiva: { atual: 0, estudouHoje: false }, semEstudo: 5 });
  assert.equal(revoltado.estado, "revoltado");
  assert.equal(revoltado.humor, "bravo");
  assert.equal(revoltado.expedicoesFechadas, true);
  assert.equal(revoltado.bonusDaMina, 0);
  assert.match(revoltado.texto, /5 dias sem estudo/);
  const novo = humorDoNeuro({ ofensiva: { atual: 0, estudouHoje: false }, semEstudo: null });
  assert.equal(novo.estado, "novo");
  assert.equal(novo.expedicoesFechadas, false, "quem nunca estudou não começa com o Neuro revoltado");
  // voltou a estudar: no mesmo dia ele desarma
  assert.equal(humorDoNeuro({ ofensiva: { atual: 1, estudouHoje: true }, semEstudo: 0 }).estado, "contente");
  const lib = fs.readFileSync(new URL("../src/lib/reino.js", import.meta.url), "utf8");
  assert.match(lib, /if \(humor\.expedicoesFechadas\) throw new ErroDeAcesso\(400/, "o servidor barra a expedição, não só a tela");
  assert.match(lib, /fatorDaMinaNaPaz\(\(await pazDeAgora\(\)\)\.paz, agora\) \* fatorDaMinaDoHumor\(await humorDoNeuroDe\(usuarioId\)\)/, "a coleta usa o bônus");
  assert.match(lib, /if \(emTeste\(\)\) return \{ \.\.\.h, bonusDaMina: 0, expedicoesFechadas: false/, "no Reino de Teste só aparece");
  assert.match(fs.readFileSync(new URL("../src/componentes/Neuro.js", import.meta.url), "utf8"), /export const HUMORES = \[[^\]]*"bravo"\]/);
});

caso("Forja de Artefatos: estudo vira mana; a poção rende +50% por 2 h (com teto) e o escudo protege 24 h, um a cada 3 dias", () => {
  assert.equal(PONTOS_POR_MANA, 10);
  assert.deepEqual(manaDe({ pontos: 435, gasta: 30 }), { ganha: 43, gasta: 30, disponivel: 13, proxima: 5 });
  assert.equal(manaDe({ pontos: 100, gasta: 400 }).disponivel, 0, "nunca negativa");
  assert.equal(pontosQueContam([{ tipo: "quiz", pontos: 90 }, { tipo: "conquista", pontos: 500 }, { tipo: "item", pontos: 10 }]), 100, "conquista não é tempo de estudo");
  const agora = new Date("2026-11-03T15:00:00Z");
  assert.equal(podeForjar({ item: "pocao", mana: 29, agora }).ok, false);
  assert.match(podeForjar({ item: "pocao", mana: 29, agora }).motivo, /faltam 1 de mana/);
  assert.equal(podeForjar({ item: "pocao", mana: 30, agora }).ok, true);
  assert.equal(podeForjar({ item: "pocao", mana: 90, agora, forjados: [{ item: "pocao", inicio: "2026-11-03T14:00:00Z", ate: "2026-11-03T16:00:00Z" }] }).ok, false, "uma poção de cada vez");
  assert.equal(podeForjar({ item: "pocao", mana: 90, agora, forjados: [{ item: "pocao", inicio: "2026-11-03T12:00:00Z", ate: "2026-11-03T14:00:00Z" }] }).ok, true);
  assert.match(podeForjar({ item: "escudo", mana: 90, agora, forjados: [{ item: "escudo", inicio: "2026-11-02T15:00:00Z", ate: "2026-11-03T15:00:00Z" }] }).motivo, /próximo Escudo de Folga fica pronto em 48 h/);
  assert.equal(podeForjar({ item: "escudo", mana: 90, agora, forjados: [{ item: "escudo", inicio: "2026-10-31T14:00:00Z", ate: "2026-11-01T14:00:00Z" }] }).ok, true, "passaram 3 dias");
  assert.match(podeForjar({ item: "escudo", mana: 90, agora, escudoAte: "2026-11-04T10:00:00Z" }).motivo, /já está protegido/);
  assert.equal(podeForjar({ item: "espada", mana: 999, agora }).ok, false);
  assert.deepEqual(efeitoDe("pocao", agora), { inicio: "2026-11-03T15:00:00.000Z", ate: "2026-11-03T17:00:00.000Z" });
  assert.equal(efeitoDe("escudo", agora, "2026-11-03T20:00:00Z").ate, "2026-11-04T20:00:00.000Z", "o escudo soma ao que resta");
  assert.equal(bonusDaPocao(120), 60);
  assert.equal(bonusDaPocao(5000), ARTEFATOS.pocao.tetoDoBonus, "com teto");
  assert.equal(bonusDaPocao(0), 0);
  const lib = fs.readFileSync(new URL("../src/lib/forja.js", import.meta.url), "utf8");
  assert.match(lib, /update\(\{ liquidado_em: marca \}\)\.eq\("id", f\.id\)\.is\("liquidado_em", null\)/, "a poção paga uma vez só");
  assert.match(lib, /await creditarMoedas\(usuarioId, "forja", bonus/);
  assert.match(fs.readFileSync(new URL("../src/lib/reino.js", import.meta.url), "utf8"), /export function protegerReino\(usuarioId, ate\)[\s\S]*?noMundo\("real"/, "o escudo vai para o reino de verdade");
});

caso("Chefões da Procrastinação: o atraso vira chefão; os estudos (Prática e Cadernos em dobro) derrubam e pagam", () => {
  assert.equal(pesoDoAtraso({ atrasados: 2, revisoesVencidas: 4 }), 10);
  assert.equal(chefaoDoAtraso({ atrasados: 0, revisoesVencidas: 2 }), null, "atraso pequeno não vira chefão");
  assert.equal(chefaoDoAtraso({ atrasados: 1, revisoesVencidas: 0 }).id, "lesma");
  assert.equal(chefaoDoAtraso({ atrasados: 2, revisoesVencidas: 4 }).id, "hidra");
  assert.equal(chefaoDoAtraso({ atrasados: 9, revisoesVencidas: 0 }).id, "tita");
  assert.ok(CHEFOES_DA_PROCRASTINACAO.every((c, i, l) => !i || (c.vida > l[i - 1].vida && c.recompensa > l[i - 1].recompensa)));
  const agora = new Date("2026-11-03T15:00:00Z");
  assert.equal(podeNascer({ vivo: { id: "x" }, atraso: { atrasados: 9 }, agora }).ok, false, "um vivo por vez");
  assert.equal(podeNascer({ ultimoDerrotadoEm: "2026-11-03T00:00:00Z", atraso: { atrasados: 9 }, agora }).ok, false, "descanso depois da vitória");
  assert.equal(podeNascer({ ultimoDerrotadoEm: new Date(agora.getTime() - (HORAS_ATE_O_PROXIMO + 1) * 3_600_000).toISOString(), atraso: { atrasados: 1 }, agora }).ok, true);
  assert.equal(danoDosEstudos([{ tipo: "quiz", pontos: 30 }, { tipo: "item", pontos: 10 }, { tipo: "conquista", pontos: 300 }, { tipo: "meta_diaria", pontos: 20 }, { tipo: "diario", pontos: 15 }]), 60 + 10 + 30);
  assert.equal(danoDosCadernos(3, 300), 75);
  assert.equal(danoDosCadernos(50, 300), 150, "Cadernos dão até metade da vida");
  assert.deepEqual(situacaoDoChefao({ vida: 150, dano: 40 }), { vida: 150, dano: 40, restante: 110, derrotado: false, parte: 110 / 150 });
  assert.equal(situacaoDoChefao({ vida: 150, dano: 999 }).derrotado, true);
  const lib = fs.readFileSync(new URL("../src/lib/chefoes.js", import.meta.url), "utf8");
  assert.match(lib, /update\(\{ derrotado_em: marca \}\)\.eq\("id", c\.id\)\.is\("derrotado_em", null\)/, "cai e paga uma vez só");
  assert.match(lib, /creditarMoedas\(usuarioId, "chefao", total, \{ chefao: c\.id, tipo: c\.tipo, recompensa: c\.recompensa/);
  const sql = fs.readFileSync(new URL("../db/029-forja-chefoes-duelos.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists proof_chefoes_um_vivo on public\.proof_chefoes \(usuario_id\) where derrotado_em is null/);
  assert.equal((sql.match(/'correio',\s+'forja', 'chefao', 'duelo'\)\);/g) || []).length, 2, "os tipos novos entram no livro-caixa dos dois mundos");
  assert.match(fs.readFileSync(new URL("../src/componentes/reino/Mundo3D.js", import.meta.url), "utf8"), /rn-mundo__rotulo rn-mundo__rotulo--chefao/);
});

caso("Duelo de Lógica: o gabarito confere, a Lisa erra às vezes e quem acerta mais leva a aposta", () => {
  const ids = new Set();
  for (const p of PERGUNTAS_DO_DUELO) {
    assert.ok(!ids.has(p.id), "id repetido: " + p.id); ids.add(p.id);
    assert.equal(p.opcoes.length, 4, p.id);
    assert.equal(new Set(p.opcoes).size, 4, "opções repetidas em " + p.id);
    assert.ok(Number.isInteger(p.certa) && p.certa >= 0 && p.certa < 4, p.id);
    assert.ok([1, 2, 3].includes(p.dificuldade), p.id);
  }
  for (const d of [1, 2, 3]) assert.ok(PERGUNTAS_DO_DUELO.filter((p) => p.dificuldade === d).length >= DUELO.mistura.filter((x) => x === d).length + 3, "perguntas de sobra na dificuldade " + d);
  // o gabarito das perguntas que dá para rodar aqui: roda e confere
  const certa = (id) => { const p = PERGUNTAS_DO_DUELO.find((x) => x.id === id); return p.opcoes[p.certa]; };
  assert.equal(certa("js-soma-texto"), String(2 + "2"));
  assert.equal(certa("js-length"), String([1, 2, 3].length));
  assert.equal(certa("js-typeof-null"), '"' + typeof null + '"');
  assert.equal(certa("js-ponto-flutuante"), String(0.1 + 0.2 === 0.3));
  assert.equal(certa("js-sort-texto"), "[" + [10, 1, 3].sort().join(", ") + "]");
  assert.equal(certa("binario-1011"), String(parseInt("1011", 2)));
  assert.equal(certa("apertos-de-mao"), String((5 * 4) / 2));
  assert.equal(certa("seq-n-n1"), String(6 * 7));
  assert.equal(certa("horas-minutos"), String(2.5 * 60));
  { const a = [1, 2, 3]; const b = a; b.push(4); assert.equal(certa("js-referencia"), String(a.length)); }
  // o sorteio: 5 perguntas, sem repetir, na mistura de dificuldades
  let semente = 7;
  const s = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  for (let k = 0; k < 30; k++) {
    const sorteadas = montarDuelo(s);
    assert.equal(new Set(sorteadas).size, DUELO.perguntas);
    assert.deepEqual(sorteadas.map((id) => PERGUNTAS_DO_DUELO.find((p) => p.id === id).dificuldade), DUELO.mistura);
  }
  // a Lisa acerta mais nas fáceis, erra às vezes
  let certas = 0, total = 0;
  for (let k = 0; k < 400; k++) { const sorteadas = montarDuelo(s); certas += corrigir(sorteadas, respostasDaLisa(sorteadas, s)).acertos; total += 5; }
  const media = (certas / total) * 5;
  assert.ok(media > 3.2 && media < 4.1, "a Lisa acerta em média ~3,7 de 5 (deu " + media.toFixed(2) + ")");
  assert.equal("certa" in perguntaParaTela("py-len"), false, "a tela não vê o gabarito");
  const c = corrigir(["py-len", "seq-dobro", "html-link"], [1, 0, "x"]);
  assert.equal(c.acertos, 1);
  assert.equal(c.detalhe[2].resposta, null, "resposta que não é índice vale como sem resposta");
  assert.equal(resultadoDoDuelo(4, 3), "venceu");
  assert.equal(resultadoDoDuelo(3, 3), "empate");
  assert.equal(resultadoDoDuelo(2, 3), "perdeu");
  assert.deepEqual(movimentosDoDuelo("venceu", 50), { jogador: 100, lisa: -50 });
  assert.deepEqual(movimentosDoDuelo("empate", 50), { jogador: 50, lisa: 0 });
  assert.deepEqual(movimentosDoDuelo("perdeu", 50), { jogador: 0, lisa: 50 });
  assert.equal(podeDuelar({ aposta: 50, saldo: 100, saldoDaLisa: 100, feitosHoje: 0 }).ok, true);
  assert.match(podeDuelar({ aposta: 35, saldo: 100, saldoDaLisa: 100, feitosHoje: 0 }).motivo, /escolha uma aposta/);
  assert.match(podeDuelar({ aposta: 50, saldo: 100, saldoDaLisa: 100, feitosHoje: 3 }).motivo, /3 duelos de hoje/);
  assert.match(podeDuelar({ aposta: 100, saldo: 60, saldoDaLisa: 500, feitosHoje: 0 }).motivo, /faltam 40 moedas/);
  assert.match(podeDuelar({ aposta: 100, saldo: 600, saldoDaLisa: 50, feitosHoje: 0 }).motivo, /a Lisa não tem moedas/);
  assert.match(podeDuelar({ aposta: 20, saldo: 600, saldoDaLisa: 500, feitosHoje: 0, temAberto: true }).motivo, /já está aberto/);
  assert.equal(segundosDoDuelo(), 5 * 25 + 10);
  const lib = fs.readFileSync(new URL("../src/lib/duelo.js", import.meta.url), "utf8");
  assert.match(lib, /\.eq\("id", d\.id\)\.eq\("status", "aberto"\)\.select\(CAMPOS\)/, "encerra uma vez só");
  assert.match(lib, /grava antes de cobrar/);
  // a Forja mora no Reino (03/11/2026: "não num menu à parte"), com os selos do que está em efeito por cima do 3D
  const reinoPagina = fs.readFileSync(new URL("../src/app/(app)/reino/page.js", import.meta.url), "utf8");
  assert.match(reinoPagina, /forja: \(\) => \(teste \? null : <ForjaDoReino dados=\{forja\}/);
  assert.match(reinoPagina, /<EfeitosDaForja forja=\{forja\}/);
  assert.match(fs.readFileSync(new URL("../src/app/(app)/forja/page.js", import.meta.url), "utf8"), /redirect\("\/reino#forja"\)/);
  assert.doesNotMatch(fs.readFileSync(new URL("../src/componentes/Moldura.js", import.meta.url), "utf8"), /href: "\/forja"/, "sem item à parte no menu");
});

caso("BEYOND-0019: moedas com no máximo 2 casas (o bônus do humor do Neuro não vaza ponto flutuante)", () => {
  const reino = { construcoes: { mina: 3 }, coletado_em: new Date(Date.now() - 100 * 3_600_000).toISOString() };
  for (const fator of [1, 1.05, 1.1, 1.15, 1.2, 2 * 1.05]) {
    const v = producaoAcumulada(reino, new Date(), fator);
    assert.ok(Number.isInteger(v), "a mina cheia é inteira (fator " + fator + "): " + v);
  }
  const lib = fs.readFileSync(new URL("../src/lib/reino.js", import.meta.url), "utf8");
  assert.match(lib, /porHora: centavos\(taxaDeProducao\(n\) \* fatorDaMina\)/);
  assert.match(lib, /capacidade: Math\.floor\(taxaDeProducao\(n\) \* fatorDaMina \* HORAS_ATE_ENCHER\)/);
  const tela = fs.readFileSync(new URL("../src/app/(app)/reino/page.js", import.meta.url), "utf8");
  assert.match(tela, /Produz \{formatarMoedas\(reino\.mina\.porHora\)\} moeda\(s\) por hora/);
  assert.match(fs.readFileSync(new URL("../src/componentes/reino/pecas.js", import.meta.url), "utf8"), /maximumFractionDigits: 2/);
});

caso("BEYOND-0018: o chefão de pé rouba pouco por dia (com teto) e devolve tudo quando cai", () => {
  const nasceu = "2026-11-01T12:00:00Z";
  assert.equal(roubosVencidos({ nasceuEm: nasceu, agora: new Date("2026-11-02T11:59:00Z") }).vezes, 0, "as primeiras 24 h são de graça");
  const dois = roubosVencidos({ nasceuEm: nasceu, agora: new Date("2026-11-03T13:00:00Z") });
  assert.equal(dois.vezes, 2);
  assert.equal(dois.relogio, "2026-11-03T12:00:00.000Z", "o relógio anda em passos de 24 h");
  assert.equal(roubosVencidos({ nasceuEm: nasceu, ultimoRouboEm: dois.relogio, agora: new Date("2026-11-03T20:00:00Z") }).vezes, 0, "o mesmo roubo não vale duas vezes");
  assert.equal(valorDoRoubo({ tipo: "hidra", vezes: 1, saldo: 1000 }), 15);
  assert.equal(valorDoRoubo({ tipo: "hidra", vezes: 1, saldo: 100 }), 5, "nunca mais que 5% do saldo");
  assert.equal(valorDoRoubo({ tipo: "hidra", vezes: 1, saldo: 0 }), 0);
  assert.equal(valorDoRoubo({ tipo: "tita", vezes: 30, saldo: 9999 }), 200, "no total, nunca mais que a recompensa");
  assert.equal(valorDoRoubo({ tipo: "lesma", vezes: 3, saldo: 9999, jaRoubado: 55 }), 5, "o teto conta o que já foi roubado");
  assert.ok(CHEFOES_DA_PROCRASTINACAO.every((c) => c.rouboPorDia > 0 && c.rouboPorDia * 7 <= c.recompensa * 1.5), "pouco por dia");
  const lib = fs.readFileSync(new URL("../src/lib/chefoes.js", import.meta.url), "utf8");
  assert.match(lib, /creditarMoedas\(usuarioId, "chefao", -valor, \{ chefao: c\.id, tipo: c\.tipo, roubo: true \}\)/);
  assert.match(lib, /const total = c\.recompensa \+ \(c\.roubado \|\| 0\);/, "derrubado, devolve o que roubou");
  assert.match(lib, /q = c\.ultimo_roubo_em \? q\.eq\("ultimo_roubo_em", c\.ultimo_roubo_em\) : q\.is\("ultimo_roubo_em", null\);/, "duas abas não roubam duas vezes");
});

caso("BEYOND-0022: o exemplo da Lisa vale para exercícios e projetos, e chega conferido", () => {
  assert.equal(temExemploDaLisa("exercicio", "codigo"), true);
  assert.equal(temExemploDaLisa("exercicio", undefined), true, "sem motor é código");
  assert.equal(temExemploDaLisa("projeto_semanal", "aberto"), true);
  assert.equal(temExemploDaLisa("exercicio", "ritmo"), false, "treino de música não tem o que aplicar");
  assert.equal(temExemploDaLisa("quiz", "codigo"), false);
  const e = validarExemploDaLisa({ titulo: "Estoque", conceitos: [{ nome: "laço", explicacao: "repete" }, { nome: "", explicacao: "x" }], linguagem: "Python",
    codigo: "```python\nfor livro in livros:\n    print(livro)\n```", comoFunciona: ["percorre a lista"], paraOSeu: "troque a lista" });
  assert.equal(e.conceitos.length, 1, "conceito sem nome cai fora");
  assert.equal(e.codigo, "for livro in livros:\n    print(livro)", "sem as cercas do markdown, com a indentação");
  assert.equal(e.linguagem, "python");
  assert.throws(() => validarExemploDaLisa({ conceitos: [{ nome: "a", explicacao: "b" }], codigo: "x" }), /não conseguiu montar o exemplo/);
  const semCodigo = validarExemploDaLisa({ conceitos: [{ nome: "a", explicacao: "b" }], passos: ["um", "dois"], codigo: "ignorado" }, { comCodigo: false });
  assert.equal(semCodigo.codigo, "");
  assert.deepEqual(semCodigo.passos, ["um", "dois"]);
  const tela = fs.readFileSync(new URL("../src/componentes/Desafios.js", import.meta.url), "utf8");
  assert.match(tela, /\{temExemploDaLisa\(desafio\.tipo, desafio\.motor\) && <ExemploDaLisa desafio=\{desafio\} \/>\}/, "em todo exercício que tem o que aplicar");
  assert.match(tela, /<ExemploDaLisa key=\{`exemplo-/, "e nos projetos");
  assert.match(fs.readFileSync(new URL("../src/lib/pratica.js", import.meta.url), "utf8"), /if \(d\.conteudo\?\.aplicacao\) return d\.conteudo\.aplicacao;/, "gera uma vez só");
  assert.match(fs.readFileSync(new URL("../src/app/api/desafios/[id]/exemplo/route.js", import.meta.url), "utf8"), /exemploDaLisa\(\{ usuarioId: usuario\.id, id \}\)/, "a rota existe");
});

caso("BEYOND-0020: tropas, construções e defesas novas no Reino (e a tripulação das ilhas fora do Quartel)", () => {
  for (const t of ["lanceiro", "cavaleiro", "grifo", "colosso"]) {
    assert.ok(TROPAS[t] && ORDEM_DAS_TROPAS.includes(t), t);
    assert.ok(!TROPAS[t].temporada, `${t} é do Reino`);
  }
  for (const t of ["pirata", "arpoadora", "polvorista", "papagaio"]) {
    assert.equal(TROPAS[t].temporada, "ilhas", t);
    assert.ok(!ORDEM_DAS_TROPAS.includes(t), `${t} não aparece no Quartel`);
    assert.ok(ORDEM_DA_TRIPULACAO.includes(t), t);
  }
  assert.deepEqual(contagens({ pirata: 3, guerreiro: 2, inventado: 9 }), { guerreiro: 2, pirata: 3 }, "o motor conta as duas listas");
  const niveis = { ...NIVEIS_INICIAIS, quartel: 5, castelo: 5, acampamento: 4 };
  assert.match(podeTreinar({ tropa: "pirata", quantidade: 1, destino: "exercito", niveis, reservas: {}, saldo: 9999 }).motivo, /tripulação das ilhas/);
  assert.equal(podeTreinar({ tropa: "colosso", quantidade: 1, destino: "exercito", niveis, reservas: {}, saldo: 9999 }).ok, true);
  for (const chave of ["pomar", "lancaChamas", "torreDeGelo", "catapulta"]) {
    assert.ok(CONSTRUCOES[chave] && ORDEM_DAS_CONSTRUCOES.includes(chave) && chave in NIVEIS_INICIAIS, chave);
    const [x, z] = LUGARES[chave];
    const raio = Math.hypot(x, z);
    assert.ok(raio < raioDaIlha(CONSTRUCOES[chave].terreno) - 0.2, `${chave} cabe na terra do Terreno ${CONSTRUCOES[chave].terreno}`);
    for (const [outra, [ox, oz]] of Object.entries(LUGARES)) if (outra !== chave) assert.ok(Math.hypot(ox - x, oz - z) > 1.6, `${chave} longe de ${outra}`);
    assert.ok(typeof CONSTRUCOES[chave].efeito(1) === "string", chave);
  }
  assert.equal(taxaDeProducao({ mina: 2, biblioteca: 1, pomar: 3 }), 2 + 2 + 6, "o Pomar rende junto com a Mina");
  const exp = EXPEDICOES.filter((x) => ["pantano-gosmas", "vale-uivante", "cemiterio-esquecido", "fortaleza-ogros", "jardim-aguas-vivas", "desfiladeiro-golems"].includes(x.id));
  assert.equal(exp.length, 6, "seis expedições novas");
  assert.equal(VEICULOS.navio.destino, "A Temporada das Ilhas");
  assert.equal(fazExpedicao("navio"), false);
  assert.equal(fazExpedicao("barco"), true);
});

caso("BEYOND-0020: a Temporada das Ilhas — conquista, construção com conchas, tripulação, ataques e pactos", () => {
  assert.equal(ARQUIPELAGO.length, 12);
  assert.equal(new Set(ARQUIPELAGO.map((i) => i.id)).size, 12);
  for (const i of ARQUIPELAGO) {
    assert.ok(i.x >= 0 && i.x <= 100 && i.y >= 0 && i.y <= 100 && i.nivel >= 1 && i.nivel <= 5, i.id);
    for (const k of Object.keys(i.construcoes)) assert.ok(CONSTRUCOES_DA_ILHA[k] && (CONSTRUCOES[k]?.terreno || 0) <= 1, `${i.id}: ${k} cabe na ilha (Terreno 1)`);
    assert.ok(Object.keys(contagensDeMonstros(i.nativos)).length > 0, `${i.id} tem nativos`);
  }
  assert.equal(CONCHAS_POR_MOEDA, 10, "a moeda das ilhas é bem mais barata");
  // a primeira ilha cai com a tripulação de quem acabou de comprar o navio; a lendária, não
  const coqueiro = { id: "coqueiro", dono_id: null };
  const inicial = { pirata: 16 };
  assert.ok(espacoUsado(inicial) <= capacidadeDaTripulacao([]));
  let conquistas = 0;
  for (let s = 1; s <= 8; s++) if (batalhaNaIlha({ tripulacao: inicial, ilha: coqueiro, semente: s * 7919 }).estrelas >= 2) conquistas++;
  assert.ok(conquistas >= 6, `16 piratas conquistam o Coqueiro (${conquistas}/8)`);
  assert.equal(batalhaNaIlha({ tripulacao: inicial, ilha: { id: "grande-tiki", dono_id: null }, semente: 7 }).estrelas < 2, true, "a lendária pede muito mais");
  assert.deepEqual(desfechoNaIlha({ estrelas: 2, ilha: coqueiro }), { tipo: "conquista", moedas: 20, conchas: 100 });
  assert.equal(desfechoNaIlha({ estrelas: 1, ilha: { id: "tesouro", dono_id: "x" } }).tipo, "saque");
  assert.equal(desfechoNaIlha({ estrelas: 0, ilha: coqueiro }).tipo, "derrota");
  assert.deepEqual(guardasDaConquista("tesouro"), { nativo: 5, xama: 2, chefeTiki: 1 }, "metade dos nativos fica de guarda");
  assert.deepEqual(construcoesAposConquista({ castelo: 1, mina: 3, torre: 1 }), { castelo: 1, mina: 2 }, "trocou de dono: cada uma perde um nível");
  const def = defensorDaIlha({ id: "coqueiro", dono_id: "dono", construcoes: { castelo: 2 }, guardas: { nativo: 2 } });
  assert.equal(def.cenario, null, "a ilha luta no estilo do reino (03/11/2026)");
  assert.equal(def.construcoes.terreno, 1);
  assert.deepEqual(def.monstros, { nativo: 2 }, "a ilha de jogador é defendida pelos guardas");
  // produção e coleta
  assert.deepEqual(producaoDaIlha({ mina: 2, biblioteca: 3 }), { conchas: 50, moedas: 6 });
  const agora = new Date("2026-11-03T20:00:00Z");
  assert.deepEqual(juntadoNaIlha({ mina: 2, biblioteca: 1 }, "2026-11-01T00:00:00Z", agora), { conchas: 600, moedas: 24, horas: 12 }, "enche em 12 horas");
  // construir
  const base = { castelo: 1, mina: 1 };
  assert.match(podeConstruirNaIlha({ souDono: false, construcoes: base, chave: "mina", conchas: 9999 }).motivo, /não é sua/);
  assert.match(podeConstruirNaIlha({ souDono: true, construcoes: base, chave: "mina", conchas: 9999 }).motivo, /Cabana do Chefe/);
  assert.deepEqual(podeConstruirNaIlha({ souDono: true, construcoes: base, chave: "castelo", conchas: 600 }), { ok: true, custo: 600 });
  assert.match(podeConstruirNaIlha({ souDono: true, construcoes: base, chave: "torre", conchas: 100 }).motivo, /faltam 250 conchas/);
  // tripulação
  assert.equal(capacidadeDaTripulacao([{ construcoes: { quartel: 2 } }, { construcoes: { quartel: 1 } }]), 16 + 36);
  assert.match(podeTreinarTripulacao({ tropa: "guerreiro", quantidade: 1, tripulacao: {}, conchas: 999 }).motivo, /não é da tripulação/);
  assert.match(podeTreinarTripulacao({ tropa: "papagaio", quantidade: 1, tripulacao: {}, conchas: 9999 }).motivo, /Porto no nível 3/);
  assert.match(podeTreinarTripulacao({ tropa: "pirata", quantidade: 17, tripulacao: {}, conchas: 9999 }).motivo, /só cabe mais 16/);
  assert.deepEqual(podeTreinarTripulacao({ tropa: "pirata", quantidade: 5, tripulacao: {}, conchas: 300 }), { ok: true, custo: 300, quantidade: 5 });
  // atacar
  const ok = { usuarioId: "eu", ilha: { id: "coqueiro", dono_id: null }, temNavio: true, tripulacao: { pirata: 5 }, ataquesHoje: 0, agora };
  assert.equal(podeAtacarIlha(ok).ok, true);
  assert.match(podeAtacarIlha({ ...ok, temNavio: false }).motivo, /Navio/);
  assert.match(podeAtacarIlha({ ...ok, ataquesHoje: 3 }).motivo, /3 ataques de hoje/);
  assert.match(podeAtacarIlha({ ...ok, tripulacao: {} }).motivo, /tripulação/);
  assert.match(podeAtacarIlha({ ...ok, ilhasMinhas: [{}, {}, {}] }).motivo, /3 ilhas/);
  assert.match(podeAtacarIlha({ ...ok, ilha: { id: "coqueiro", dono_id: "eu" } }).motivo, /já é sua/);
  assert.match(podeAtacarIlha({ ...ok, ilha: { id: "coqueiro", dono_id: "ele", escudo_ate: "2026-11-04T00:00:00Z" } }).motivo, /escudo/);
  const pacto = { de_id: "ele", para_id: "eu", aceito_em: "2026-11-02T00:00:00Z", ate: "2026-11-09T00:00:00Z", criado_em: "2026-11-02T00:00:00Z" };
  assert.match(podeAtacarIlha({ ...ok, ilha: { id: "coqueiro", dono_id: "ele" }, pactos: [pacto] }).motivo, /pacto/, "o pacto é a única paz das ilhas");
  assert.equal(pactoVigente([pacto], "eu", "ele", new Date("2026-11-10T00:00:00Z")), null, "o pacto vence");
  assert.equal(pactoPendente({ criado_em: "2026-11-03T00:00:00Z", aceito_em: null }, agora), true);
  assert.equal(saqueDeConchas(2000, protecaoDoBau([{ construcoes: { cofre: 2 } }])), 280, "20% do que passa do Baú");
  assert.equal(saqueDeConchas(99999, 0), 1500, "com teto");
  // o banco e a tela
  const lib = fs.readFileSync(new URL("../src/lib/ilhas.js", import.meta.url), "utf8");
  assert.match(lib, /\.eq\("id", ilha\.id\)\.eq\("versao", ilha\.versao\)/, "duas conquistas juntas: só a primeira vale");
  assert.match(lib, /if \(desfecho\.tipo === "conquista"\) \{\s*await gravarIlha/, "a conquista grava a ilha antes de tudo");
  assert.match(fs.readFileSync(new URL("../src/componentes/reino/cenariosDasExpedicoes.js", import.meta.url), "utf8"), /"ilha-tropical": \{/);
  assert.match(fs.readFileSync(new URL("../src/componentes/reino/Mundo3D.js", import.meta.url), "utf8"), /id === "barco" \|\| id === "navio"/);
  // as ilhas moram no Reino, nas Grandes Expedições, em 3D no mesmo mundo do reino (cenário parado + guardas)
  const doReino = fs.readFileSync(new URL("../src/app/(app)/reino/page.js", import.meta.url), "utf8");
  assert.match(doReino, /ilhas: \(\) => \(teste \? null : \(\s*<GrandesExpedicoes/);
  // "a ilha deve ser igual ao modo reino": a mesma ilha flutuante, só com os guardas (sem cenário de expedição)
  assert.match(doReino, /cenario=\{null\} guardas=\{naIlha \? naIlha\.defensores \|\| \{\} : null\}/);
  const mundo3d = fs.readFileSync(new URL("../src/componentes/reino/Mundo3D.js", import.meta.url), "utf8");
  assert.match(mundo3d, /function definirCenarioFixo\(c\)/);
  assert.match(mundo3d, /if \(fixo\.ativo\) aplicarCenarioFixo\(\);/, "depois da luta, a ilha parada volta");
  // o cenário tropical usa lugares(), r() e R do terreno: no desenho da cabana ele quebrava a tela (03/11/2026)
  const cenarios = fs.readFileSync(new URL("../src/componentes/reino/cenariosDasExpedicoes.js", import.meta.url), "utf8");
  const noTerreno = cenarios.indexOf("const lugares = (n, de, ate, folga)");
  assert.ok(noTerreno > 0 && cenarios.indexOf('case "ilha-tropical"') > noTerreno, "a decoração da ilha fica no terreno, onde lugares() existe");
  assert.match(fs.readFileSync(new URL("../src/app/(app)/ilhas/page.js", import.meta.url), "utf8"), /redirect\("\/reino#grandes-expedicoes"\)/);
  assert.doesNotMatch(fs.readFileSync(new URL("../src/componentes/Moldura.js", import.meta.url), "utf8"), /href: "\/ilhas"/, "sem item à parte no menu");
  assert.match(fs.readFileSync(new URL("../src/lib/lisaRotina.js", import.meta.url), "utf8"), /const ACOES = \{[^}]*ilhas, minigame \};/, "a Lisa tem a ilha dela (e joga o minigame)");
  assert.match(fs.readFileSync(new URL("../db/030-versao-1.sql", import.meta.url), "utf8"), /'ilhas', 'arena'\)\);/);
});

caso("BEYOND-0023: a Arena Lúdica — todo bug quebra, toda solução passa, o mascote e o Parsons conferem certo", () => {
  // roda o arnês como o navegador e o Node rodam: o código inteiro, com um console que guarda as linhas
  const rodar = (codigo) => {
    const linhas = [];
    try { new Function("console", codigo)({ log: (...a) => linhas.push(a.join(" ")), error: () => {}, warn: () => {}, info: () => {} }); } catch { /* sintaxe quebrada: os testes nem rodam */ }
    return linhas.join("\n");
  };
  const LENTOS = new Set(["fibonacci-lento", "tem-repetido"]); // o quebrado não termina a tempo: só a solução roda aqui
  for (const [id, bug] of Object.entries(BUGS)) {
    assert.ok(["porta", "armadilha", "inimigo"].includes(bug.obstaculo) && ["sintaxe", "logica", "desempenho"].includes(bug.tipo), id);
    if (!LENTOS.has(id)) {
      const quebrado = lerArnes(rodar(arnesDoBug(id, bug.codigo, "s1")), "s1");
      assert.ok(!quebrado || quebrado.some((t) => !t.ok), `${id}: o código quebrado não passa`);
    }
    const certo = lerArnes(rodar(arnesDoBug(id, SOLUCOES_DOS_BUGS[id], "s2")), "s2");
    assert.ok(certo && certo.every((t) => t.ok), `${id}: a solução de referência passa (${JSON.stringify(certo)})`);
  }
  assert.equal(lerArnes("ARENA:outra:[{\"ok\":true}]", "s3"), null, "a linha precisa da senha desta conferência");
  assert.ok(ANDARES_DA_MASMORRA.every((a) => a.bugs.length === 2 && a.bugs.every((b) => BUGS[b])));
  for (const a of ANDARES_DA_MASMORRA) for (const c of "HABS") assert.ok(a.mapa.some((l) => l.includes(c)), `${a.id} tem ${c}`);
  // o mascote: o código inicial perde, a referência vence todos os níveis (direto e pelo arnês)
  const decidirDe = (codigo) => new Function(codigo + "; return decidir;")();
  for (const n of NIVEIS_DO_MASCOTE) {
    assert.equal(simularMascote(n, decidirDe(CODIGO_INICIAL_DO_MASCOTE)).venceu, false, `${n.id}: só andar não basta`);
    assert.equal(simularMascote(n, decidirDe(SOLUCAO_DO_MASCOTE)).venceu, true, `${n.id}: a referência vence`);
    const r = lerArnes(rodar(arnesDoMascote(n.id, SOLUCAO_DO_MASCOTE, "m1")), "m1");
    assert.equal(r?.venceu, true, `${n.id}: pelo arnês também`);
  }
  assert.match(simularMascote(NIVEIS_DO_MASCOTE[3], () => "andar").motivo, /caiu na água/);
  assert.match(simularMascote(NIVEIS_DO_MASCOTE[1], () => "andar").motivo, /bateu na parede/);
  assert.match(simularMascote(NIVEIS_DO_MASCOTE[0], () => "pular").motivo, /devolveu "pular"/);
  assert.match(simularMascote(NIVEIS_DO_MASCOTE[0], () => { throw new Error("ops"); }).motivo, /deu erro: ops/);
  // o Parsons: embaralhado nunca vem na ordem certa; a ordem e o recuo certos passam; o "}" vale em qualquer posição dele
  for (const p of PUZZLES_DE_PARSONS) {
    const blocos = blocosEmbaralhados(p.id, "alguém");
    assert.equal(blocos.length, p.linhas.length);
    assert.ok(blocos.some((b, i) => b.id !== `b${i}`), `${p.id} vem embaralhado`);
    assert.ok(blocos.every((b) => !("recuo" in b)), "o recuo não vem junto");
    const certa = p.linhas.map(([, recuo], i) => ({ id: `b${i}`, recuo }));
    assert.equal(conferirParsons(p.id, certa).ok, true, p.id);
    assert.equal(conferirParsons(p.id, certa.map((r, i) => (i === 1 ? { ...r, recuo: r.recuo + 1 } : r))).ok, false, `${p.id}: recuo errado não passa`);
  }
  const fz = PUZZLES_DE_PARSONS.find((p) => p.id === "contar-vogais");
  const iguais = fz.linhas.map(([t], i) => (t === "}" ? i : -1)).filter((i) => i >= 0);
  const trocada = fz.linhas.map(([, recuo], i) => ({ id: `b${i}`, recuo }));
  [trocada[iguais[0]].id, trocada[iguais[1]].id] = [trocada[iguais[1]].id, trocada[iguais[0]].id];
  trocada[iguais[0]].recuo = fz.linhas[iguais[0]][1];
  trocada[iguais[1]].recuo = fz.linhas[iguais[1]][1];
  assert.equal(conferirParsons("contar-vogais", trocada).ok, true, "dois \"}\" trocados de lugar continuam certos");
  assert.equal(conferirParsons("contar-vogais", [{ id: "b0", recuo: 0 }]).ok, false, "incompleta não passa");
  // as fases liberam em ordem
  assert.equal(faseLiberada("mascote", "nivel-1"), true);
  assert.equal(faseLiberada("mascote", "nivel-2"), false);
  assert.equal(faseLiberada("mascote", "nivel-2", new Set(["mascote:nivel-1"])), true);
  const lib = fs.readFileSync(new URL("../src/lib/arena.js", import.meta.url), "utf8");
  assert.match(lib, /const NODE = "nodejs-20\.17\.0";/, "o servidor confere no Node do Wandbox, nunca no nosso");
  assert.match(lib, /update\(\{ concluida_em: new Date\(\)\.toISOString\(\), recompensa: valor \}\)\.eq\("id", id\)\.is\("concluida_em", null\)/, "paga uma vez só");
  assert.match(lib, /creditarMoedas\(usuarioId, "arena", valor/);
  // a Arena é o minigame do dia da Prática: vale pontos uma vez por dia, como o quiz
  assert.equal(PONTOS_DO_MINIGAME, 30);
  assert.equal(jogoDoDia("2026-11-02"), "masmorra", "segunda");
  assert.equal(jogoDoDia("2026-11-03"), "mascote", "terça");
  assert.equal(jogoDoDia("2026-11-08"), "parsons", "domingo");
  assert.match(lib, /tipo: "arena", chave: chaveDoMinigame\(diaDe\(\)\), pontos: PONTOS_DO_MINIGAME/);
  assert.match(fs.readFileSync(new URL("../src/app/(app)/pratica/page.js", import.meta.url), "utf8"), /<MinigameDoDia \/>/);
  assert.match(fs.readFileSync(new URL("../db/031-minigame-do-dia.sql", import.meta.url), "utf8"), /'diario', 'arena'/);
  assert.match(fs.readFileSync(new URL("../src/app/(app)/arena/page.js", import.meta.url), "utf8"), /redirect\("\/pratica#minigame"\)/);
});

caso("o menu do Reino em abas: cada aba com as suas partes, nada solto embaixo do mundo", () => {
  const pagina = fs.readFileSync(new URL("../src/app/(app)/reino/page.js", import.meta.url), "utf8");
  assert.match(pagina, /const ABAS_DO_REINO = \[/);
  for (const [aba, secoes] of [["reino", "construcoes"], ["batalha", "invadir"], ["expedicoes", "ilhas"], ["forja", "forja"], ["bolsa", "bolsa"]]) {
    assert.match(pagina, new RegExp(`id: "${aba}"[^\\n]*secoes: \\[[^\\]]*"${secoes}"`), aba);
  }
  assert.match(pagina, /role="tablist" aria-label="Menu do reino"/);
  assert.doesNotMatch(pagina, /\{secoes\.paz\(\)\}\n\s*\{secoes\.minas\(\)\}/, "as seções não ficam mais todas empilhadas");
  assert.match(pagina, /setAba\(abaDaSecao\(id\)\)/, "mostrar uma seção abre a aba dela");
});

caso("a Lisa joga sozinha: o relógio da nuvem chama a rodada a cada 20 minutos, com segredo", () => {
  const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const wrangler = ler("../wrangler.jsonc");
  assert.match(wrangler, /"main": "worker-proof\.js"/);
  assert.match(wrangler, /"triggers": \{ "crons": \["\*\/20 \* \* \* \*"\] \}/);
  const worker = ler("../worker-proof.js");
  assert.match(worker, /async scheduled\(evento, env, ctx\)/);
  assert.match(worker, /"x-proof-relogio": env\.PROOF_SEGREDO_DO_RELOGIO/);
  // o portão de login deixa só esta rota passar sem sessão (o relógio não tem cookie); a rota exige o segredo
  assert.ok(ehLivre("/api/lisa/rodada"), "o relógio passa pelo portão");
  for (const fechado of ["/api/lisa", "/api/lisa/rodadas", "/api/lisa/duelo", "/lisa"]) assert.ok(!ehLivre(fechado), fechado);
  assert.match(worker, /export \{ DOQueueHandler, DOShardedTagCache, BucketCachePurge \} from "\.\/\.open-next\/worker\.js";/);
  const rota = ler("../src/app/api/lisa/rodada/route.js");
  assert.match(rota, /segredo\.length < 16 \|\| req\.headers\.get\("x-proof-relogio"\) !== segredo/, "sem o segredo, ninguém roda a Lisa");
  assert.match(ler("../src/lib/arena.js"), /if \(!perfil\?\.robo\) throw new ErroDeAcesso\(403/, "a jogada sem conferir é só para robô");
  assert.match(ler("./lisa-joga.mjs"), /import \{ rodadaDaLisa, criarConta \} from "@\/lib\/lisaRotina\.js";/, "o script vira atalho");
});

caso("a semana da ofensiva: de domingo a sábado, com hoje e os dias que faltam", () => {
  const s = semanaDaOfensiva(["2026-11-01", "2026-11-02", "2026-10-31"], "2026-11-03");
  assert.deepEqual(s.map((d) => d.letra).join(""), "DSTQQSS");
  assert.equal(s[0].dia, "2026-11-01", "começa no domingo");
  assert.deepEqual(s.map((d) => d.estudou), [true, true, false, false, false, false, false]);
  assert.equal(s.findIndex((d) => d.hoje), 2, "terça é hoje");
  assert.deepEqual(s.map((d) => d.futuro), [false, false, false, true, true, true, true]);
  assert.equal(semanaDaOfensiva([], "2026-11-01")[0].hoje, true, "no domingo, hoje é o primeiro");
});

console.log(`\n${passou} caso(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`);
