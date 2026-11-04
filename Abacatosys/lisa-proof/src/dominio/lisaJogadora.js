// A Lisa jogadora (03/11/2026, BEYOND-0014): "quero que a Lisa jogue: escolha um curso de tecnologia
// todo mês e finalize, faça os quizzes e exercícios diários e as entregas semanais, jogue o modo Reino
// (melhore o reino, compre ações, ataque outros jogadores), alimente o Acervo toda semana com vídeos e
// artigos de tecnologia (sem subir arquivos), crie os cadernos dela — imitando um jogador de verdade,
// melhorando a assertividade e aprendendo com o processo. O reino dela deve ser visível para todos."
//
// Aqui fica só o que se decide sem banco nem rede (testado em scripts/dominio-check.mjs): o tema do
// mês, a chance de acerto que cresce com o curso e com os erros, a agenda do dia e as escolhas no Reino.
// Quem executa é scripts/lisa-joga.mjs, no relógio do iMac, pela conta própria dela. O sorteio com
// semente é o da Bolsa (sorteio) e a semente de um texto é a do Domínio (sementeDe): os mesmos de sempre.

export { sorteio } from "./bolsa.js";
export { sementeDe } from "./modoDominio.js";

/** A conta dela: um e-mail que não recebe nada, para ninguém confundir com a conta de uma pessoa. */
export const CONTA_DA_LISA = { email: "lisa.jogadora@proof.beyond.dev.br", nome: "Lisa", apelido: "Lisa robô", reino: "Cidadela da Lisa" }; // (o apelido só aceita letras; o 🤖 vem da marca de robô)

/**
 * Os cursos que ela faz, um por mês, na ordem (sem repetir enquanto houver tema novo): de tecnologia,
 * alternando programação e o resto. O perfil é o que a IA propuser — nos de programação o exercício é
 * código e o projeto vai em ARQUIVOS (ela não tem GitHub: entregarProjetoEmArquivos, src/lib/pratica.js);
 * nos outros, a entrega é por texto ou diagrama.
 */
export const TEMAS_DE_TECNOLOGIA = [
  "Redes de computadores",
  "Python do zero ao intermediário",
  "Segurança da informação",
  "JavaScript moderno",
  "Computação em nuvem",
  "SQL e modelagem de dados",
  "Testes de software",
  "Git e GitHub na prática",
  "Engenharia de requisitos",
  "APIs REST com Node.js",
  "Experiência do usuário (UX)",
  "Algoritmos e estruturas de dados",
  "Inteligência artificial: conceitos e ética",
  "Docker e containers",
  "Linux na linha de comando",
];

/** O tema do mês: o primeiro da lista que ela ainda não fez (os feitos vêm pelos títulos das trilhas dela). */
export function temaDoMes(feitos = []) {
  const ja = new Set((feitos || []).map((t) => String(t).toLowerCase().trim()));
  return TEMAS_DE_TECNOLOGIA.find((t) => !ja.has(t.toLowerCase())) || TEMAS_DE_TECNOLOGIA[ja.size % TEMAS_DE_TECNOLOGIA.length];
}

/**
 * A chance de ela acertar uma questão: começa como quem está aprendendo (~55%) e sobe com os dias
 * no curso (até ~90% no fim do mês). Errar ensina: o que ela errou nos últimos dias (taxa de 0 a 1)
 * puxa a chance um pouco para baixo hoje — ela revisa e erra menos amanhã, e não acerta tudo de cara.
 */
export function chanceDeAcerto({ diasNoCurso = 0, errosRecentes = 0 } = {}) {
  const dias = Math.max(0, Number(diasNoCurso) || 0);
  const base = 0.55 + 0.35 * (1 - Math.exp(-dias / 12));
  const erro = Math.min(1, Math.max(0, Number(errosRecentes) || 0));
  return Math.round(Math.min(0.92, Math.max(0.45, base - erro * 0.08)) * 100) / 100;
}

/** As escolhas do quiz: em cada questão, acerta com a chance do dia; quando erra, marca outra opção. */
export function respostasDoQuiz(perguntas, chance, sortear) {
  return (perguntas || []).map((p) => {
    const n = (p.opcoes || []).length || 4;
    if (sortear() < chance) return p.correta;
    const erradas = Array.from({ length: n }, (_, i) => i).filter((i) => i !== p.correta);
    return erradas[Math.floor(sortear() * erradas.length)];
  });
}

/**
 * A agenda dela num dia (horário de Brasília), como uma pessoa que estuda e joga: de manhã recolhe a
 * mina e estuda a teoria; no meio da manhã passa na Bolsa (que só abre das 7h às 17h); no almoço faz o quiz; à tarde o exercício;
 * à noite o Reino. O
 * projeto da semana sai na segunda à tarde; o Acervo e o caderno, no domingo. Cada hora, o relógio
 * pergunta o que está na vez e ela faz o que ainda não fez hoje.
 */
/**
 * A agenda do dia (desde 03/11/2026, várias coisas mais de uma vez: "quero ver ela jogando mais vezes"). `de`:
 * a hora em que começa; `ate`: a última hora (a Bolsa só negocia das 7h às 17h); `vezes`: quantas no dia;
 * `intervalo`: horas entre uma e outra; `dias`: só nesses dias da semana (0 = domingo).
 */
export const AGENDA = [
  { acao: "curso", de: 7 },           // o curso do mês: escolhe/gera se não tem (no dia 1 ou quando o anterior acabou)
  { acao: "mina", de: 7, vezes: 6, intervalo: 2 },
  { acao: "teoria", de: 8, vezes: 4, intervalo: 3 },
  { acao: "reino", de: 9, vezes: 5, intervalo: 2 },
  { acao: "bolsa", de: 10, ate: 16, vezes: 3, intervalo: 2 },
  { acao: "ilhas", de: 11, vezes: 4, intervalo: 3 },  // a Temporada das Ilhas (BEYOND-0020): a ilha dela
  { acao: "quiz", de: 12, vezes: 3, intervalo: 3 },   // as 3 rodadas de quiz do dia (as extras valem metade)
  { acao: "minigame", de: 13, vezes: 3, intervalo: 3 }, // o minigame do dia da Prática (a Arena)
  { acao: "exercicio", de: 14, vezes: 3, intervalo: 3 }, // as 3 rodadas de exercício do dia
  { acao: "projeto", de: 16, dias: [1, 2, 3, 4, 5, 6, 0] }, // o projeto aberto: entrega quando dá
  { acao: "correio", de: 17, vezes: 2, intervalo: 4 },  // o correio (BEYOND-0016): um recadinho e avalia os que chegaram
  { acao: "acervo", de: 9, vezes: 2, intervalo: 5 }, // todo dia, vídeos e artigos da internet para o Acervo
  { acao: "caderno", de: 21, dias: [0, 3] },    // domingo e quarta: as anotações do que estudou
];

/**
 * A reserva (03/11/2026): quando nada da agenda está na vez — de madrugada, ou com tudo do dia feito —, ela ainda
 * joga uma destas, a que está esperando há mais tempo. Assim, a cada rodada do relógio (30 min), sempre faz algo.
 */
export const SEMPRE = ["reino", "mina", "ilhas", "minigame", "correio"];

/**
 * As próximas jogadas de uma rodada: do que está na vez (`naVez`, na ordem da agenda), primeiro o que ainda não
 * fez hoje e depois o que está esperando há mais tempo; nada na vez, uma da reserva (SEMPRE), também a que
 * está esperando há mais tempo.
 */
export function proximasJogadas({ naVez = [], jogadas = {}, maximo = 1 }) {
  const ultima = (acao) => jogadas?.[acao]?.ultima || 0;
  const ordenar = (lista) => lista.map((acao, i) => ({ acao, i })).sort((a, b) => ultima(a.acao) - ultima(b.acao) || a.i - b.i).map((x) => x.acao);
  const daAgenda = ordenar(naVez).slice(0, maximo);
  return daAgenda.length ? daAgenda : ordenar(SEMPRE).slice(0, 1);
}

/**
 * O que está na vez nesta hora e dia da semana. `jogadas`: o que ela já fez hoje ({ acao: { vezes, ultima } },
 * `ultima` em ms); `feito` (lista de ações) ainda vale, como "uma vez cada". Tentar e não dar também conta.
 */
export function oQueFazerAgora({ hora, diaDaSemana, feito = [], jogadas = null, agora = Date.now() }) {
  const ja = jogadas || Object.fromEntries(feito.map((a) => [a, { vezes: 1, ultima: 0 }]));
  return AGENDA.filter((a) => {
    if (hora < a.de || (a.ate !== undefined && hora > a.ate)) return false;
    if (a.dias && !a.dias.includes(diaDaSemana)) return false;
    const j = ja[a.acao];
    if (!j) return true;
    return j.vezes < (a.vezes || 1) && agora - j.ultima >= (a.intervalo || 0) * 3_600_000;
  }).map((a) => a.acao);
}

/**
 * Quantos itens da teoria ela marca hoje: um dia bom, um dia corrido. Entre 2 e 5, nunca a trilha
 * inteira de uma vez — é o ritmo de quem estuda todo dia.
 */
export const itensDaTeoriaHoje = (sortear) => 2 + Math.floor(sortear() * 4);

/**
 * No Reino, o que melhorar: das melhorias que dá para pagar (`opcoes`: [{ chave, custo, prioridade }]),
 * a de maior prioridade, deixando uma reserva (ela não gasta tudo — quer comprar ações e treinar).
 */
export function melhoriaDaVez(opcoes, saldo, { reserva = 150 } = {}) {
  const cabe = (opcoes || []).filter((o) => o.custo > 0 && o.custo <= saldo - reserva);
  if (!cabe.length) return null;
  return [...cabe].sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0) || a.custo - b.custo)[0];
}

/** Na Bolsa: com sobra, compra 1 ou 2 ações de uma empresa sorteada entre as que cabem no bolso; senão, nada. */
export function compraNaBolsa(acoes, saldo, sortear, { reserva = 300 } = {}) {
  const livre = saldo - reserva;
  const cabe = (acoes || []).filter((a) => a.preco > 0 && a.preco <= livre);
  if (!cabe.length || sortear() < 0.35) return null; // nem todo dia ela mexe na Bolsa
  const escolhida = cabe[Math.floor(sortear() * cabe.length)];
  const quantidade = Math.max(1, Math.min(2, Math.floor(livre / escolhida.preco)));
  return { codigo: escolhida.codigo, quantidade };
}

/** O alvo de uma invasão: um reino de troféus parecidos (nem o mais fraco, nem o mais forte), nunca o dela. */
export function alvoDaInvasao(reinos, meuId, meusTrofeus, sortear) {
  const outros = (reinos || []).filter((r) => r.usuarioId !== meuId);
  if (!outros.length) return null;
  const perto = [...outros].sort((a, b) => Math.abs(a.trofeus - meusTrofeus) - Math.abs(b.trofeus - meusTrofeus)).slice(0, 3);
  return perto[Math.floor(sortear() * perto.length)];
}

/**
 * O exercício de diagrama: a IA devolve a estrutura (formas com tipo e texto, e as ligações) e aqui ela
 * vira o documento do quadro (o formato do ProcessMap), em colunas de cima para baixo — o que a correção
 * lê é o texto e as ligações, não o capricho do traço.
 */
export const TIPOS_DO_DIAGRAMA = ["terminal", "process", "decision", "database", "document", "data", "note"];
export function documentoDoDiagrama({ titulo = "Diagrama", formas = [], ligacoes = [] } = {}) {
  const lista = (formas || []).filter((f) => f && String(f.texto || "").trim()).slice(0, 40);
  const porColuna = 6;
  const shapes = lista.map((f, i) => ({
    id: String(f.id || `f${i + 1}`),
    type: TIPOS_DO_DIAGRAMA.includes(f.tipo) ? f.tipo : "process",
    x: 80 + Math.floor(i / porColuna) * 300, y: 60 + (i % porColuna) * 140, w: 220, h: 80,
    text: String(f.texto).slice(0, 200),
  }));
  const ids = new Set(shapes.map((s) => s.id));
  const connections = (ligacoes || []).filter((l) => ids.has(String(l?.de)) && ids.has(String(l?.para)) && l.de !== l.para).slice(0, 60)
    .map((l, i) => ({ id: `c${i + 1}`, from: String(l.de), to: String(l.para), label: String(l.rotulo || "").slice(0, 60) }));
  return { format: "processmap", version: 4, name: String(titulo).slice(0, 120), mode: "diagram", pages: [{ id: "p1", name: "Página 1", shapes, connections }] };
}
