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
export const CONTA_DA_LISA = { email: "lisa.jogadora@proof.beyond.dev.br", nome: "Lisa", apelido: "Lisa robô" }; // (o apelido só aceita letras; o 🤖 vem da marca de robô)

/**
 * Os cursos que ela faz, um por mês, na ordem (sem repetir enquanto houver tema novo). Todos de
 * tecnologia, sem ser de programação, e a rotina cria o curso no perfil "livre" (PERFIL_DO_CURSO, ver
 * src/dominio/perfis.js): o exercício e o projeto são entregues por texto, que ela escreve. Nos de
 * programação o projeto é um repositório público no GitHub — e uma rotina não cria repositório na conta
 * de ninguém —, então ela pararia na primeira semana.
 */
export const TEMAS_DE_TECNOLOGIA = [
  "Redes de computadores",
  "Segurança da informação",
  "Computação em nuvem",
  "Testes de software",
  "Engenharia de requisitos",
  "Experiência do usuário (UX)",
  "Gestão ágil de projetos",
  "Inteligência artificial: conceitos e ética",
  "Internet das coisas",
  "Sistemas operacionais",
  "Governança de TI",
  "LGPD para equipes de tecnologia",
  "Transformação digital",
  "Arquitetura de computadores",
];

/** O perfil do curso dela, qualquer que seja o que a IA propôs (a entrega por texto). */
export const PERFIL_DO_CURSO = "livre";

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
export const AGENDA = [
  { acao: "curso", de: 7 },          // o curso do mês: escolhe/gera se não tem (no dia 1 ou quando o anterior acabou)
  { acao: "mina", de: 7 },
  { acao: "teoria", de: 8 },
  { acao: "quiz", de: 12 },
  { acao: "exercicio", de: 15 },
  { acao: "projeto", de: 16, dias: [1, 2, 3, 4, 5, 6, 0] }, // o projeto aberto: entrega quando dá
  { acao: "reino", de: 19 },
  { acao: "bolsa", de: 10 },         // a Bolsa só negocia das 7h às 17h
  { acao: "caderno", de: 21, dias: [0, 3] },   // domingo e quarta: as anotações do que estudou
  { acao: "acervo", de: 18, dias: [0] },       // domingo: vídeos e artigos da semana
];

/** O que está na vez nesta hora e dia da semana, tirando o que já foi feito hoje. */
export function oQueFazerAgora({ hora, diaDaSemana, feito = [] }) {
  const ja = new Set(feito);
  return AGENDA.filter((a) => hora >= a.de && (!a.dias || a.dias.includes(diaDaSemana)) && !ja.has(a.acao)).map((a) => a.acao);
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
