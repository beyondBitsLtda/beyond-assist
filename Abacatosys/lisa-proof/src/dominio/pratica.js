// A parte prática: quiz e exercício do dia, projeto da semana e do mês.
//
// Puro, como o resto de src/dominio: períodos, pontuação, conferência do que a IA devolve e o
// desenho do mapa da trilha. Tudo testado por `npm run dominio-check`.

import { somarDias, inicioDaSemana, fimDaSemana, inicioDoMes, fimDoMes, diaValido, diaDaSemana } from "./datas.js";

export const TIPOS_DE_DESAFIO = ["quiz", "exercicio", "projeto_semanal", "projeto_mensal"];

export const NOMES_DOS_DESAFIOS = {
  quiz: "Quiz do dia",
  exercicio: "Exercício do dia",
  projeto_semanal: "Projeto da semana",
  projeto_mensal: "Projeto do mês",
};

/** Pontuação da prática. A parte prática vale mais que a teórica de propósito: dá mais trabalho. */
export const PONTOS_DA_PRATICA = {
  acertoNoQuiz: 5,
  quizPerfeito: 10,       // bônus por acertar todas
  exercicio: 40,          // nota 100 = 40 pontos
  projeto_semanal: 150,
  projeto_mensal: 400,
};

export const NOTA_DE_APROVACAO = 60;
// Exercício: 5 tentativas (eram 3 — pedido de 20/10/2026).
export const TENTATIVAS = { exercicio: 5, projeto_semanal: 5, projeto_mensal: 5 };

// ---------------------------------------------------------------- rodadas extras do dia
//
// Quem quiser pode fazer até 3 quizzes e 3 exercícios por dia, em cada trilha (pedido de
// 20/10/2026). Cada rodada é um desafio novo sobre o assunto do dia, sem repetir as perguntas
// das anteriores. A 2ª e a 3ª valem METADE dos pontos (e das moedas do reino): praticar mais
// sempre compensa, mas repetir quiz fácil não sobe o ranking como estudar o assunto seguinte.
export const RODADAS_POR_DIA = { quiz: 3, exercicio: 3 };
export const fatorDaRodada = (rodada) => ((Number(rodada) || 1) <= 1 ? 1 : 0.5);
export const comFatorDaRodada = (pontos, rodada) => Math.round((pontos || 0) * fatorDaRodada(rodada));

// ---------------------------------------------------------------- perguntas repetidas
// Chamado de 20/10/2026: nas rodadas extras do quiz, a IA devolvia as mesmas perguntas (às vezes
// idênticas, às vezes só reformuladas). O pedido já dizia "não repita"; agora o código confere.
// Duas perguntas são "a mesma" se as palavras que importam se sobrepõem muito, ou se o código
// delas é praticamente o mesmo (a mesma pergunta sobre o mesmo programa, com outras palavras).

// palavras que não dizem nada do conteúdo (e o "Analise o código abaixo" de toda pergunta)
const VAZIAS = new Set((
  "a o as os e de do da dos das um uma uns umas que qual quais quem como onde quando porque por para pra " +
  "com sem em no na nos nas ao aos se ser sera esta este essa esse isso isto ha tem mais menos ou nao sim " +
  "sobre entre apos depois antes pode podem deve devem seguinte seguintes seguir abaixo acima trecho codigo " +
  "programa analise observe considere veja exemplo resultado saida exibido impresso exibida impressa valor " +
  "opcao opcoes alternativa correta corretamente principal the of to in is and"
).split(" "));

export function palavrasDe(texto) {
  return new Set(String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").split(" ").filter((p) => p.length > 2 && !VAZIAS.has(p)));
}
const sobreposicao = (a, b) => {
  if (!a.size || !b.size) return 0;
  let comum = 0;
  for (const p of a) if (b.has(p)) comum++;
  return comum / Math.min(a.size, b.size);
};
const tokensDoCodigo = (codigo) => new Set(String(codigo || "").replace(/s+/g, " ").split(/[^A-Za-z0-9_]+/).filter((p) => p.length > 1));

/** A pergunta `p` é repetição de `q`? (`{ pergunta, codigo }` nos dois) */
export function perguntaRepetida(p, q) {
  const a = palavrasDe(p?.pergunta), b = palavrasDe(q?.pergunta);
  if (sobreposicao(a, b) >= 0.6 && Math.min(a.size, b.size) >= 2) return true;
  const ca = tokensDoCodigo(p?.codigo), cb = tokensDoCodigo(q?.codigo);
  if (ca.size >= 3 && cb.size >= 3 && sobreposicao(ca, cb) >= 0.8) return true;
  return String(p?.pergunta || "").trim().toLowerCase() === String(q?.pergunta || "").trim().toLowerCase();
}

/** As perguntas que não repetem nenhuma de `anteriores` nem uma da outra, na ordem em que vieram. */
export function perguntasNovas(perguntas, anteriores = []) {
  const aceitas = [];
  for (const p of perguntas || []) {
    if (anteriores.some((q) => perguntaRepetida(p, q)) || aceitas.some((q) => perguntaRepetida(p, q))) continue;
    aceitas.push(p);
  }
  return aceitas;
}

/** O exercício novo repete um de antes? (mesmo título, ou enunciado quase igual) */
export function exercicioRepetido(novo, anteriores = []) {
  const t = palavrasDe(`${novo?.titulo || ""} ${String(novo?.enunciado || "").slice(0, 400)}`);
  return anteriores.some((a) => sobreposicao(t, palavrasDe(`${a.titulo || ""} ${String(a.enunciado || "").slice(0, 400)}`)) >= 0.7);
}

/** O foco de cada rodada extra, para a IA ir por outro caminho (e não só "não repita"). */
export const FOCO_DA_RODADA = {
  2: "foque em APLICAÇÃO: situações práticas, casos de uso do dia a dia e erros comuns de iniciante",
  3: "foque em DESAFIO: leitura de código um pouco mais longo, pegadinhas, comparações entre duas formas de fazer e \"o que acontece se…\"",
};

/** Dá para abrir mais uma rodada hoje? `doDia`: os desafios deste tipo, trilha e dia. */
export function podeAbrirRodada(tipo, doDia) {
  const maximo = RODADAS_POR_DIA[tipo] || 1;
  const lista = doDia || [];
  if (!lista.length) return { ok: true, rodada: 1 };
  const ultima = lista.reduce((m, d) => ((d.rodada || 1) > (m.rodada || 1) ? d : m));
  if ((ultima.rodada || 1) >= maximo) return { ok: false, motivo: `hoje você já fez as ${maximo} rodadas — amanhã tem mais` };
  if (ultima.status !== "concluido") return { ok: false, motivo: "termine a rodada atual antes de abrir outra" };
  return { ok: true, rodada: (ultima.rodada || 1) + 1 };
}

/**
 * Ainda dá para mandar outra solução?
 *
 * Exercício do dia: enquanto houver tentativa — MESMO APROVADO. Vale a melhor nota, então tentar
 * de novo só pode subir a nota, nunca derrubar (pedido de 20/10/2026: antes o exercício travava no
 * primeiro aprovado, e quem tirou 70 não podia buscar o 100 com as tentativas que sobravam).
 * Projetos: entregam em PARTES (pedido de 21/10/2026) — dá para mandar de novo enquanto faltar algum
 * requisito ou extra (`completo`) e sobrar tentativa. O que já foi cumprido fica garantido.
 */
export function podeReenviar(desafio) {
  const maximo = TENTATIVAS[desafio?.tipo] || 0;
  if ((desafio?.tentativas || 0) >= maximo) return false;
  if (desafio.tipo === "exercicio") return true;
  return !desafio.completo;
}

/** Concluído (conta como feito nas metas, na agenda e nas conquistas): a MELHOR nota aprovou, ou
 *  as tentativas acabaram. Pela melhor, e não pela última — reenviar e ir pior não desfaz o feito. */
export function entregaConcluida({ tipo, melhorNota, tentativas }) {
  return (Number(melhorNota) || 0) >= NOTA_DE_APROVACAO || tentativas >= (TENTATIVAS[tipo] || 0);
}

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

function texto(valor, limite) {
  const t = String(valor ?? "").trim();
  return t.length > limite ? `${t.slice(0, limite).trim()}…` : t;
}

function listaDeTextos(valor, limite, maximo) {
  return (Array.isArray(valor) ? valor : []).map((v) => texto(v, limite)).filter(Boolean).slice(0, maximo);
}

// ---------------------------------------------------------------- períodos

/** O período de um desafio que começa em `dia`: o próprio dia, a segunda da semana ou o dia 1. */
export function periodoDe(tipo, dia) {
  if (tipo === "projeto_semanal") return inicioDaSemana(dia);
  if (tipo === "projeto_mensal") return inicioDoMes(dia);
  return dia;
}

export function fimDoPeriodo(tipo, periodo) {
  if (tipo === "projeto_semanal") return fimDaSemana(periodo);
  if (tipo === "projeto_mensal") return fimDoMes(periodo);
  return periodo;
}

/** O período pedido existe e não está no futuro? Projeto de semana que ainda não chegou fica
 *  trancado — senão o mapa inteiro viraria uma lista de projetos para fazer de uma vez. */
export function periodoPermitido(tipo, periodo, hoje) {
  if (!TIPOS_DE_DESAFIO.includes(tipo) || !diaValido(periodo)) return false;
  if (tipo === "projeto_semanal" && diaDaSemana(periodo) !== 1) return false;
  if (tipo === "projeto_mensal" && !periodo.endsWith("-01")) return false;
  if (tipo === "quiz" || tipo === "exercicio") return periodo === hoje;
  return periodo <= periodoDe(tipo, hoje);
}

// ---------------------------------------------------------------- pontos

export function pontosDoQuiz(acertos, total) {
  return acertos * PONTOS_DA_PRATICA.acertoNoQuiz + (total > 0 && acertos === total ? PONTOS_DA_PRATICA.quizPerfeito : 0);
}

export function pontosDaNota(tipo, nota) {
  return Math.round((limitar(Number(nota) || 0, 0, 100) / 100) * (PONTOS_DA_PRATICA[tipo] || 0));
}

// ---------------------------------------------------------------- projetos: pontos por parte e complexidade
//
// Pedido de 21/10/2026: pontuação CLARA para entregas parciais, e complexidade ajustável. Cada
// requisito obrigatório tem um valor visível (a base do projeto dividida entre eles) e cada extra
// soma um bônus. Entregar em partes soma: o que uma entrega cumpriu fica garantido, e a próxima só
// acrescenta o que for novo. A complexidade pode CAIR sem perder pontos (quem está começando não é
// punido por isso) e SUBIR valendo mais. Só dá para trocar antes da primeira entrega.

export const COMPLEXIDADES = {
  simples: { nome: "Mais simples", fator: 1 },
  padrao: { nome: "Padrão", fator: 1 },
  desafiador: { nome: "Desafiador", fator: 1.5 },
};
export const ORDEM_DAS_COMPLEXIDADES = ["simples", "padrao", "desafiador"];
export const TROCAS_DE_COMPLEXIDADE = 3;
export const BONUS_POR_EXTRA = 0.1; // cada extra vale 10% da base

export const complexidadeDe = (conteudo) => (COMPLEXIDADES[conteudo?.complexidade] ? conteudo.complexidade : "padrao");

/** Quanto vale cada parte do projeto. A divisão sobra no máximo 1 ponto, que vai para os primeiros. */
export function tabelaDePontos(tipo, conteudo) {
  const base = Math.round((PONTOS_DA_PRATICA[tipo] || 0) * COMPLEXIDADES[complexidadeDe(conteudo)].fator);
  const n = (conteudo?.requisitos || []).length;
  const cada = n ? Math.floor(base / n) : 0;
  const resto = n ? base - cada * n : 0;
  const bonus = Math.round(base * BONUS_POR_EXTRA);
  const extras = (conteudo?.extras || []).map(() => bonus);
  return {
    base,
    requisitos: Array.from({ length: n }, (_, i) => cada + (i < resto ? 1 : 0)),
    extras,
    maximo: base + extras.reduce((s, v) => s + v, 0),
  };
}

/** As partes que a avaliação deu como cumpridas: posições (0, 1, …) dos requisitos e dos extras.
 *  A IA numera cada item (1 = o primeiro); sem número, vale a ordem em que veio. */
export function cumpridosNaAvaliacao(avaliacao, conteudo) {
  const pegar = (itens, total) => {
    const ok = new Set();
    (Array.isArray(itens) ? itens : []).forEach((r, i) => {
      if (!r?.atendido) return;
      const n = Number.isInteger(r.numero) && r.numero >= 1 ? r.numero - 1 : i;
      if (n < total) ok.add(n);
    });
    return [...ok].sort((a, b) => a - b);
  };
  return {
    requisitos: pegar(avaliacao?.requisitos, (conteudo?.requisitos || []).length),
    extras: pegar(avaliacao?.extras, (conteudo?.extras || []).length),
  };
}

/** O que já estava garantido mais o desta entrega: entregar em partes soma, nunca tira. */
export function juntarCumpridos(antes, agora) {
  const unir = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort((x, y) => x - y);
  return { requisitos: unir(antes?.requisitos, agora?.requisitos), extras: unir(antes?.extras, agora?.extras) };
}

export function pontosDoProjeto(tabela, cumpridos) {
  const somar = (valores, posicoes) => (posicoes || []).reduce((s, i) => s + (valores[i] || 0), 0);
  return somar(tabela.requisitos, cumpridos?.requisitos) + somar(tabela.extras, cumpridos?.extras);
}

/** Tudo cumprido (requisitos e extras): não há mais o que entregar. */
export function projetoCompleto(tabela, cumpridos) {
  return tabela.requisitos.length > 0
    && (cumpridos?.requisitos || []).length >= tabela.requisitos.length
    && (cumpridos?.extras || []).length >= tabela.extras.length;
}

/** Dá para trocar a complexidade? Só antes da primeira entrega, e no máximo TROCAS_DE_COMPLEXIDADE vezes. */
export function podeTrocarComplexidade({ tipo, tentativas, conteudo }, nivel) {
  if (tipo !== "projeto_semanal" && tipo !== "projeto_mensal") return { ok: false, motivo: "só os projetos têm complexidade" };
  if (!COMPLEXIDADES[nivel]) return { ok: false, motivo: "complexidade inválida" };
  if ((tentativas || 0) > 0) return { ok: false, motivo: "a complexidade fica fixa depois da primeira entrega" };
  if (complexidadeDe(conteudo) === nivel) return { ok: false, motivo: "o projeto já está nessa complexidade" };
  if ((conteudo?.trocas || 0) >= TROCAS_DE_COMPLEXIDADE) return { ok: false, motivo: `as ${TROCAS_DE_COMPLEXIDADE} trocas de complexidade deste projeto já foram usadas` };
  return { ok: true };
}

// ---------------------------------------------------------------- o que a IA devolve

// ---------------------------------------------------------------- o código das perguntas
//
// O código de uma pergunta mora num campo próprio (`codigo` + `linguagem`), e não dentro do
// texto. Antes ele vinha numa cerca ``` dentro da pergunta, e de dois jeitos dava errado (vistos
// em 20/10/2026): o modelo escrevia "Observe o bloco de código C abaixo" e não mandava código
// nenhum; ou mandava a cerca grudada numa linha só, e a tela mostrava as crases cruas.

/** Texto de código: tira só as bordas em branco (a indentação da primeira linha fica) e uma
 *  cerca ``` que o modelo tenha posto em volta. */
export function textoDeCodigo(valor, limite) {
  let t = String(valor ?? "").replace(/\r\n/g, "\n");
  const cerca = /^\s*```[A-Za-z][\w#+.-]*[ \t]*\n?([\s\S]*?)\n?```\s*$/.exec(t) || /^\s*```\n?([\s\S]*?)\n?```\s*$/.exec(t);
  if (cerca) t = cerca[1];
  t = t.replace(/^\s*\n/, "").replace(/\s+$/, "");
  return t.length > limite ? t.slice(0, limite) : t;
}

/** Tira de dentro do texto o primeiro bloco ``` (inteiro ou grudado numa linha só) e devolve
 *  { texto, codigo, linguagem }. Sem bloco, devolve o texto como veio. */
export function separarCodigoDaPergunta(pergunta) {
  const t = String(pergunta ?? "");
  const m = /```([A-Za-z][\w#+.-]*)?[ \t]*\n?([\s\S]*?)```/.exec(t);
  if (!m) return { texto: t.trim(), codigo: "", linguagem: "" };
  let linguagem = m[1] || "";
  let codigo = m[2];
  // "```let x" sem nome de linguagem: o regex leu "let" como linguagem
  if (linguagem && !/^(js|jsx|ts|tsx|javascript|typescript|python|py|java|c|cpp|c\+\+|cs|csharp|c#|sql|html|css|php|json|go|golang|rust|rs|kotlin|kt|dart|bash|sh|shell|ruby|rb|swift|xml|mysql|postgresql)$/i.test(linguagem)) {
    codigo = `${linguagem} ${codigo}`;
    linguagem = "";
  }
  const texto = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`.replace(/[ \t]{2,}/g, " ").replace(/\s*\n\s*/g, " ").trim();
  return { texto, codigo: textoDeCodigo(codigo, 3000), linguagem };
}

// "Observe o código abaixo", "analise o trecho a seguir", "o que o programa seguinte imprime":
// a pergunta só faz sentido com o código na tela.
const PEDE_CODIGO = /\b(c[oó]digo|trecho|bloco|programa|fun[cç][aã]o|script|consulta|comando|snippet|exemplo)\b[^.?!:]{0,40}\b(abaixo|a seguir|seguinte)\b|\b(seguinte|abaixo:?)\s+(c[oó]digo|trecho|bloco|programa|consulta)\b|\b(observe|analise|considere|veja|leia)\s+(o|este|esse|a|esta|essa)\s+(c[oó]digo|trecho|bloco|programa|consulta|fun[cç][aã]o|script)\b/i;
export function perguntaPedeCodigo(texto) {
  return PEDE_CODIGO.test(String(texto || ""));
}

/** A pergunta com o código no lugar certo — também para quizzes antigos, salvos com a cerca
 *  dentro do texto. */
export function normalizarPergunta(p) {
  const sep = separarCodigoDaPergunta(p?.pergunta);
  const codigo = textoDeCodigo(p?.codigo, 3000) || sep.codigo;
  return { pergunta: sep.texto, codigo, linguagem: String(p?.linguagem || "").trim().slice(0, 30) || sep.linguagem };
}

/** Quiz de múltipla escolha: 3 a 6 perguntas, 4 opções, uma certa. Pergunta torta é descartada,
 *  e menos de 3 boas derruba o quiz inteiro (melhor pedir de novo que dar um quiz de uma pergunta).
 *  "Torta" inclui a que pede para ler um código que não veio. */
export function validarQuiz(bruto) {
  const perguntas = (Array.isArray(bruto?.perguntas) ? bruto.perguntas : [])
    .map((p) => {
      const opcoes = listaDeTextos(p?.opcoes, 300, 4);
      const correta = Number.parseInt(p?.correta, 10);
      if (opcoes.length !== 4 || !(correta >= 0 && correta <= 3) || new Set(opcoes).size !== 4) return null;
      const { pergunta: textoDaPergunta, codigo, linguagem } = normalizarPergunta(p);
      const pergunta = texto(textoDaPergunta, 1200);
      if (!pergunta) return null;
      if (!codigo && perguntaPedeCodigo(pergunta)) return null; // "observe o código abaixo" — e não há código
      return { pergunta, codigo, linguagem, opcoes, correta, explicacao: texto(p?.explicacao, 800) };
    })
    .filter(Boolean)
    .slice(0, 6);
  if (perguntas.length < 3) throw new Error("a IA não montou perguntas suficientes — tente de novo");
  return { perguntas };
}

export function validarExercicio(bruto) {
  const enunciado = texto(bruto?.enunciado, 4000);
  if (!enunciado) throw new Error("a IA não devolveu o enunciado — tente de novo");
  return {
    titulo: texto(bruto?.titulo, 120) || "Exercício do dia",
    enunciado,
    linguagem: texto(bruto?.linguagem, 40) || "",
    exemplo: texto(bruto?.exemplo, 1500),
    dicas: listaDeTextos(bruto?.dicas, 240, 4),
    criterios: listaDeTextos(bruto?.criterios, 240, 6),
  };
}

export function validarProjeto(bruto) {
  const requisitos = listaDeTextos(bruto?.requisitos, 300, 10);
  if (requisitos.length < 2) throw new Error("a IA não devolveu requisitos suficientes — tente de novo");
  return {
    titulo: texto(bruto?.titulo, 120) || "Projeto",
    contexto: texto(bruto?.contexto, 2000),
    requisitos,
    extras: listaDeTextos(bruto?.extras, 300, 5),
    entrega: texto(bruto?.entrega, 600),
    criterios: listaDeTextos(bruto?.criterios, 240, 6),
  };
}

/**
 * As "Dicas da Lisa" de um projeto, conferidas: o passo a passo básico (em ordem), dicas soltas e o
 * que vale revisar antes. Sem passo a passo não serve — é o coração do guia.
 */
export function validarGuia(bruto) {
  const passos = listaDeTextos(bruto?.passos, 400, 10);
  if (passos.length < 3) throw new Error("a Lisa não conseguiu montar o passo a passo — tente de novo");
  return {
    passos,
    dicas: listaDeTextos(bruto?.dicas, 300, 6),
    estudar: listaDeTextos(bruto?.estudar, 120, 6),
  };
}

/**
 * A avaliação da IA, conferida. `aprovado` sai da NOTA, não do que o modelo disse: um "aprovado"
 * com nota 40 (ou o contrário) é contradição que a tela não teria como explicar.
 */
function itensAvaliados(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 12).map((r) => {
    const numero = Math.round(Number(r?.numero));
    return {
      ...(numero >= 1 && numero <= 12 ? { numero } : {}),
      requisito: texto(r?.requisito, 300),
      atendido: Boolean(r?.atendido),
      observacao: texto(r?.observacao, 400),
    };
  }).filter((r) => r.requisito);
}

export function validarAvaliacao(bruto) {
  const nota = limitar(Math.round(Number(bruto?.nota) || 0), 0, 100);
  return {
    nota,
    aprovado: nota >= NOTA_DE_APROVACAO,
    comentario: texto(bruto?.comentario, 2000),
    pontosFortes: listaDeTextos(bruto?.pontosFortes, 300, 6),
    melhorias: listaDeTextos(bruto?.melhorias, 300, 6),
    requisitos: itensAvaliados(bruto?.requisitos),
    extras: itensAvaliados(bruto?.extras).slice(0, 5),
  };
}

/**
 * O quiz como a tela pode ver: a resposta certa e a explicação só aparecem depois que a pergunta
 * foi respondida. Mandar o gabarito junto seria deixar a resposta no código-fonte da página.
 */
export function quizParaTela(conteudo, resposta) {
  const escolhas = resposta?.escolhas || {};
  return conteudo.perguntas.map((p, i) => {
    const escolha = escolhas[i];
    const respondida = escolha !== undefined && escolha !== null;
    const { pergunta, codigo, linguagem } = normalizarPergunta(p);
    return {
      pergunta,
      codigo,
      linguagem,
      // quiz salvo antes da correção, com a pergunta pedindo um código que a IA não mandou
      faltouCodigo: !codigo && perguntaPedeCodigo(pergunta),
      opcoes: p.opcoes,
      respondida,
      escolha: respondida ? escolha : null,
      correta: respondida ? p.correta : null,
      explicacao: respondida ? p.explicacao : null,
    };
  });
}

// ---------------------------------------------------------------- assuntos de referência

/**
 * O assunto da prática de hoje: o primeiro pendente que já começou (atrasado antes); se nada
 * começou, o próximo; se a trilha acabou, o último — praticar o que já se estudou ainda vale.
 *
 * @param etapas  `{ cardId, ordem, inicio, fim, concluido }`
 */
export function assuntoAtual(etapas, hoje) {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const pendentes = ordenadas.filter((e) => !e.concluido);
  return (
    pendentes.find((e) => e.inicio && e.inicio <= hoje) ||
    pendentes.find((e) => e.inicio) ||
    pendentes[0] ||
    ordenadas.at(-1) ||
    null
  );
}

/** Os assuntos planejados que encostam no período [de, ate]. */
export function assuntosDoPeriodo(etapas, de, ate) {
  return [...etapas]
    .filter((e) => e.inicio && e.inicio <= ate && e.fim >= de)
    .sort((a, b) => a.ordem - b.ordem);
}

// ---------------------------------------------------------------- o mapa da trilha

function estadoDoAssunto(e, atualId, hoje) {
  if (e.concluido) return "feito";
  if (e.cardId === atualId) return e.fim && e.fim < hoje ? "atrasado" : "atual";
  if (!e.inicio) return "bloqueado";
  if (e.fim < hoje) return "atrasado";
  if (e.inicio <= hoje) return "disponivel";
  return "bloqueado";
}

function estadoDoProjeto(desafio, tipo, periodo, hoje) {
  if (periodo > periodoDe(tipo, hoje)) return "bloqueado";
  if (!desafio) return "disponivel";
  if (desafio.status === "concluido") return desafio.nota >= NOTA_DE_APROVACAO ? "feito" : "entregue";
  return "em_andamento";
}

/**
 * Os nós do mapa, na ordem em que aparecem de cima para baixo.
 *
 * Cada semana da trilha vira uma "unidade": um cabeçalho, os assuntos dela e, no fim, o baú do
 * projeto da semana. Quando o mês vira, entra o troféu do projeto do mês. A bandeira de chegada
 * fecha o caminho. Assuntos já concluídos antes de a trilha existir abrem o mapa.
 *
 * @param etapas    `{ cardId, ordem, semana, inicio, fim, concluido, titulo }`
 * @param desafios  `{ tipo, periodo, status, nota, id }` (só projetos interessam aqui)
 * @param base      início da trilha (a semana 1 é a semana dele)
 */
export function mapaDaTrilha({ etapas, desafios = [], hoje, base }) {
  const atual = assuntoAtual(etapas, hoje);
  const atualId = atual && !atual.concluido ? atual.cardId : null;
  const projeto = new Map(desafios.map((d) => [`${d.tipo}@${d.periodo}`, d]));
  const nos = [];

  const antes = etapas.filter((e) => !e.inicio).sort((a, b) => a.ordem - b.ordem);
  if (antes.length) {
    nos.push({ tipo: "unidade", chave: "antes", titulo: "Já concluídos", de: null, ate: null });
    for (const e of antes) nos.push({ tipo: "assunto", chave: e.cardId, etapa: e, estado: estadoDoAssunto(e, atualId, hoje) });
  }

  const semanas = new Map();
  for (const e of etapas.filter((x) => x.inicio)) {
    if (!semanas.has(e.semana)) semanas.set(e.semana, []);
    semanas.get(e.semana).push(e);
  }
  const ordem = [...semanas.keys()].sort((a, b) => a - b);
  const semanaBase = inicioDaSemana(base);

  ordem.forEach((n, i) => {
    const de = somarDias(semanaBase, (n - 1) * 7);
    const ate = somarDias(de, 6);
    nos.push({ tipo: "unidade", chave: `semana-${n}`, titulo: `Semana ${n}`, numero: n, de, ate });
    for (const e of semanas.get(n).sort((a, b) => a.ordem - b.ordem)) {
      nos.push({ tipo: "assunto", chave: e.cardId, etapa: e, estado: estadoDoAssunto(e, atualId, hoje) });
    }
    const d = projeto.get(`projeto_semanal@${de}`);
    nos.push({ tipo: "projeto_semanal", chave: `ps-${de}`, periodo: de, desafio: d || null, estado: estadoDoProjeto(d, "projeto_semanal", de, hoje) });

    // O troféu do mês entra na última semana que termina naquele mês.
    const mes = inicioDoMes(ate);
    const proxima = ordem[i + 1];
    const mesDaProxima = proxima ? inicioDoMes(somarDias(semanaBase, (proxima - 1) * 7 + 6)) : null;
    if (mesDaProxima !== mes) {
      const m = projeto.get(`projeto_mensal@${mes}`);
      nos.push({ tipo: "projeto_mensal", chave: `pm-${mes}`, periodo: mes, desafio: m || null, estado: estadoDoProjeto(m, "projeto_mensal", mes, hoje) });
    }
  });

  const tudoFeito = etapas.length > 0 && etapas.every((e) => e.concluido);
  nos.push({ tipo: "chegada", chave: "chegada", estado: tudoFeito ? "feito" : "bloqueado" });
  return nos;
}
