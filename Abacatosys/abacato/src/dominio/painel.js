// Os números de um quadro, e o que eles significam.
//
// Puro: recebe o quadro montado e devolve contagens. Nenhuma tela calcula nada por conta
// própria — porque três telas mostram os mesmos números (o dashboard, o topo do quadro e o
// link do cliente) e "atrasado" precisa querer dizer a mesma coisa nas três.
//
// A regra do que é atrasado, concluído ou para hoje mora no próprio card
// (`Card.estadoDoPrazo`). Aqui é só a soma.

import { Quadro } from "./Quadro.js";

const DIA = 24 * 60 * 60 * 1000;

/** Uma data sem hora, para comparar dias sem o fuso atrapalhar. */
function soODia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * O painel de um quadro.
 *
 * `agora` entra por parâmetro para o teste poder fixar o dia — uma função que lê o relógio por
 * dentro só dá para testar torcendo.
 */
export function painelDoQuadro(dadosDoQuadro, agora = new Date()) {
  const quadro = dadosDoQuadro instanceof Quadro ? dadosDoQuadro : new Quadro(dadosDoQuadro);
  const cards = quadro.todosOsCards();

  const porEstado = { atrasado: 0, hoje: 0, proximo: 0, "no-prazo": 0, "sem-prazo": 0, concluido: 0 };
  for (const c of cards) porEstado[c.estadoDoPrazo(agora)]++;

  const feitos = porEstado.concluido;
  const abertos = cards.length - feitos;

  return {
    nome: quadro.nome,
    id: quadro.id,
    total: cards.length,
    abertos,
    feitos,
    // A porcentagem de um quadro VAZIO é 0, e não 100. Um quadro sem nenhum card não está
    // pronto — ele está vazio, e mostrar 100% diria que o trabalho acabou.
    progresso: cards.length ? Math.round((feitos / cards.length) * 100) : 0,
    porEstado,
    colunas: porColuna(quadro, agora),
    etiquetas: porEtiqueta(quadro, agora),
    pessoas: porPessoa(quadro, agora),
    semana: proximosDias(cards, agora, 14),
    atrasadosDetalhe: maisAtrasados(cards, agora, 8),
    // Para quem acompanha de fora: o que está rodando, o que vem e o que saiu.
    emAndamento: emAndamento(quadro, agora, 12),
    proximasEntregas: proximasEntregas(cards, agora, 8),
    entregues: entreguesRecentes(cards, 8),
  };
}

/** Quantos cards em cada coluna, e quantos deles estão atrasados. */
export function porColuna(quadro, agora = new Date()) {
  return quadro.colunas.map((col) => {
    const contagem = col.contarPorPrazo(agora);
    return {
      id: col.id,
      nome: col.nome,
      capa: col.capa,
      total: col.total,
      atrasados: contagem.atrasado,
      feitos: contagem.concluido,
    };
  });
}

/**
 * Quantos cards ABERTOS por etiqueta.
 *
 * Abertos, e não todos: a pergunta que uma etiqueta responde num painel é "quanto trabalho de
 * cliente ainda tenho", e não "quantas vezes usei esta cor".
 */
export function porEtiqueta(quadro, agora = new Date()) {
  const conta = new Map();
  for (const e of quadro.etiquetas) {
    conta.set(e.id, { id: e.id, nome: e.nome || "(sem nome)", cor: e.cor, total: 0, atrasados: 0 });
  }
  for (const c of quadro.todosOsCards()) {
    const estado = c.estadoDoPrazo(agora);
    if (estado === "concluido") continue;
    for (const e of c.etiquetas) {
      const linha = conta.get(e.id);
      if (!linha) continue;
      linha.total++;
      if (estado === "atrasado") linha.atrasados++;
    }
  }
  return [...conta.values()].filter((l) => l.total > 0).sort((a, b) => b.total - a.total);
}

/** Quantos cards abertos por pessoa, mais os que não têm dono. */
export function porPessoa(quadro, agora = new Date()) {
  const conta = new Map();
  let semDono = 0;

  for (const c of quadro.todosOsCards()) {
    const estado = c.estadoDoPrazo(agora);
    if (estado === "concluido") continue;
    if (!c.responsaveis.length) { semDono++; continue; }
    for (const u of c.responsaveis) {
      if (!conta.has(u.id)) conta.set(u.id, { id: u.id, nome: u.nome || u.email, iniciais: u.iniciais, total: 0, atrasados: 0 });
      const linha = conta.get(u.id);
      linha.total++;
      if (estado === "atrasado") linha.atrasados++;
    }
  }

  const lista = [...conta.values()].sort((a, b) => b.total - a.total);
  // "Sem responsável" é uma linha de verdade, e costuma ser a maior. Escondê-la faria o painel
  // dizer que o trabalho está todo distribuído quando ele está todo sem dono.
  if (semDono) lista.push({ id: null, nome: "Sem responsável", iniciais: "—", total: semDono, atrasados: 0 });
  return lista;
}

/**
 * Quantas entregas em cada um dos próximos dias.
 *
 * O primeiro balde é "atrasado" e junta TUDO que já venceu, de ontem a dois anos atrás. Separar
 * por dia o que já passou daria uma fila de barras de altura 1 que não ajuda ninguém a decidir
 * nada — o que importa do passado é o tamanho da dívida, não o formato dela.
 */
export function proximosDias(cards, agora = new Date(), dias = 14) {
  const hoje = soODia(agora);
  const baldes = [{ rotulo: "atrasado", dia: null, total: 0 }];
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoje.getTime() + i * DIA);
    baldes.push({ rotulo: i === 0 ? "hoje" : i === 1 ? "amanhã" : null, dia: d.toISOString().slice(0, 10), total: 0 });
  }

  for (const c of cards) {
    if (!c.fimEm) continue;
    const estado = c.estadoDoPrazo(agora);
    if (estado === "concluido") continue;

    // O balde de vencidos segue o ESTADO, e não o calendário.
    //
    // Contar pelo dia parecia natural e fazia a agenda discordar dos contadores: um card que
    // vencia hoje às 12h, olhado às 15h, aparecia como "atrasado" nas pílulas e como "hoje" na
    // agenda, na mesma tela. Dois números certos que se contradizem são piores que um errado,
    // porque não dá nem para saber em qual acreditar.
    if (estado === "atrasado") { baldes[0].total++; continue; }

    // E o balde de HOJE também. Esta linha faltava, e a contradição era a mesma de cima, só
    // que um dia à frente: `estadoDoPrazo` chama de "hoje" o que vence dentro de 24 horas, e
    // a agenda contava por dia do calendário. Um prazo marcado para daqui a três horas às
    // 22h cai no dia seguinte — e o card aparecia como "hoje" nas pílulas e "amanhã" na
    // agenda, na mesma tela.
    //
    // Quem manda é o ESTADO, porque é ele que as pílulas mostram. A alternativa seria mudar
    // o significado de "hoje" no card, que é usado em toda parte.
    if (estado === "hoje") { baldes[1].total++; continue; }

    const distancia = Math.round((soODia(c.fimEm).getTime() - hoje.getTime()) / DIA);
    if (distancia >= 0 && distancia < dias) baldes[distancia + 1].total++;
    // Além do horizonte não entra: um prazo para daqui a seis meses não é notícia hoje.
  }
  return baldes;
}

/** Os que mais venceram, do mais antigo para o menos. É a lista que vira ação. */
export function maisAtrasados(cards, agora = new Date(), quantos = 8) {
  return cards
    .filter((c) => c.estadoDoPrazo(agora) === "atrasado")
    .sort((a, b) => a.fimEm - b.fimEm)
    .slice(0, quantos)
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      fimEm: c.fimEm.toISOString(),
      diasAtrasado: Math.floor((soODia(agora) - soODia(c.fimEm)) / DIA),
      etiquetas: c.etiquetas.map((e) => ({ nome: e.nome, cor: e.cor })),
      responsaveis: c.responsaveis.map((u) => u.iniciais),
    }));
}

/** Junta os painéis de vários quadros num só. É o que a tela de Dashboards mostra no topo. */
/* ==========================================================================================
 * O QUE UM CLIENTE PRECISA SABER
 *
 * Contadores respondem "como vai?". Quem está do lado de fora tem três outras perguntas, e
 * nenhuma delas é um número:
 *
 *   O que vocês estão fazendo AGORA?
 *   O que vem a seguir, e quando?
 *   O que já ficou pronto?
 *
 * As três funções abaixo respondem cada uma delas. Todas devolvem só título e data: sem id,
 * sem responsável, sem descrição. O cliente precisa acompanhar o projeto, não a equipe — e
 * cada campo a mais aqui é um campo que vaza por um link que não pede senha.
 * ========================================================================================== */

/**
 * Palavras que denunciam uma coluna de ESPERA.
 *
 * A primeira coluna de um quadro quase sempre é a fila, mas "quase" não serve: num quadro
 * real de CRM a fila era a SEGUNDA coluna, chamada "🎯 Alvos (Backlog da Semana)", e o painel
 * do cliente anunciou doze itens de backlog como doze frentes em execução.
 *
 * Por isso o nome também conta. É heurística, e heurística erra — mas erra para o lado certo:
 * na dúvida, uma coluna a menos em "andamento" é melhor que prometer trabalho que não começou.
 */
const NOMES_DE_FILA = [
  "backlog", "a fazer", "afazer", "to do", "todo", "fila", "entrada", "ideias", "ideia",
  "aguardando", "espera", "pendente", "planejad", "futuro", "proximos", "próximos", "alvos",
];

/**
 * E as que denunciam uma coluna de TRABALHO TERMINADO.
 *
 * Um card pode estar numa coluna "Fechados" sem ter a marca de concluído — é muito comum:
 * a pessoa arrasta o card para o fim e não clica em nada. Sem esta lista, um quadro de CRM
 * anunciou ao cliente doze tickets FECHADOS como doze frentes em execução.
 *
 * As duas listas juntas dizem a mesma coisa por lados opostos: em andamento é o que não está
 * esperando nem terminado.
 */
const NOMES_DE_PRONTO = [
  "feito", "feitos", "concluid", "concluíd", "done", "pronto", "prontos", "finalizad",
  "entregue", "entregues", "fechad", "encerrad", "arquivad", "cancelad", "aprovad",
];

function ehFila(nome) {
  const limpo = String(nome || "").toLowerCase();
  return NOMES_DE_FILA.some((p) => limpo.includes(p));
}

function ehPronto(nome) {
  const limpo = String(nome || "").toLowerCase();
  return NOMES_DE_PRONTO.some((p) => limpo.includes(p));
}

/**
 * O que está em andamento.
 *
 * "Em andamento" é o card que NÃO está concluído e NÃO está numa coluna de espera. O que
 * está na fila ainda não começou: mostrá-lo como andamento faria um quadro com duzentos itens
 * de backlog parecer duzentas frentes abertas — e um cliente lendo isso acharia que a equipe
 * está fazendo duzentas coisas ao mesmo tempo, o que não é elogio nenhum.
 *
 * Num quadro de uma coluna só não há fila, e aí tudo que está aberto está em andamento.
 */
export function emAndamento(quadro, agora = new Date(), quantos = 12) {
  const colunas = quadro.colunas || [];
  // POSIÇÃO só para a primeira coluna; o resto é pelo NOME.
  //
  // Eu tinha acrescentado "a última coluna também é pronto", e ela derrubou o caso de três
  // colunas onde a última é trabalho de verdade — num quadro [Entrada, Backlog, Em contato]
  // sobrava zero. A posição só é confiável na ponta de entrada: todo quadro começa por uma
  // fila, mas nem todo quadro termina numa coluna de pronto.
  const trabalho = colunas.length > 1
    ? colunas.filter((c, i) => i !== 0 && !ehFila(c.nome) && !ehPronto(c.nome))
    : colunas;

  const itens = [];
  for (const coluna of trabalho) {
    for (const card of coluna.cards || []) {
      if (card.concluido) continue;
      itens.push({
        titulo: card.titulo,
        etapa: coluna.nome,
        estado: card.estadoDoPrazo(agora),
        fimEm: card.fimEm ? card.fimEm.toISOString() : null,
      });
    }
  }

  // Quem tem prazo vem primeiro, e o mais apertado na frente: é a ordem em que o cliente
  // quer ler. Sem prazo vai para o fim, na ordem em que estava.
  return itens
    .sort((a, b) => {
      if (a.fimEm && b.fimEm) return a.fimEm < b.fimEm ? -1 : 1;
      if (a.fimEm) return -1;
      if (b.fimEm) return 1;
      return 0;
    })
    .slice(0, quantos);
}

/**
 * As próximas entregas: o que tem prazo à frente, do mais próximo ao mais distante.
 *
 * Não inclui o que já venceu — isso é "atrasado", tem seção própria, e misturar os dois faria
 * a próxima entrega aparecer como se ainda estivesse por vir.
 */
export function proximasEntregas(cards, agora = new Date(), quantos = 8) {
  const hoje = soODia(agora);
  return cards
    .filter((c) => !c.concluido && c.fimEm && soODia(c.fimEm) >= hoje)
    .sort((a, b) => a.fimEm - b.fimEm)
    .slice(0, quantos)
    .map((c) => ({
      titulo: c.titulo,
      fimEm: c.fimEm.toISOString(),
      // Dias até vencer. 0 é hoje — e "hoje" é o que o cliente lê, não "em 0 dias".
      emDias: Math.round((soODia(c.fimEm) - hoje) / DIA),
      estado: c.estadoDoPrazo(agora),
    }));
}

/**
 * O que já foi entregue.
 *
 * Sem isto o painel só mostra dívida: atrasos, pendências, prazos vindo. Um acompanhamento que
 * nunca mostra o que ficou pronto dá a impressão de que nada anda — e é a parte que o cliente
 * mais gosta de ver.
 */
export function entreguesRecentes(cards, quantos = 8) {
  return cards
    .filter((c) => c.concluido)
    // Os concluídos com prazo saem pelo prazo, do mais recente; os sem prazo vêm depois.
    .sort((a, b) => {
      if (a.fimEm && b.fimEm) return b.fimEm - a.fimEm;
      if (a.fimEm) return -1;
      if (b.fimEm) return 1;
      return 0;
    })
    .slice(0, quantos)
    .map((c) => ({ titulo: c.titulo, fimEm: c.fimEm ? c.fimEm.toISOString() : null }));
}

export function painelGeral(paineis) {
  const somar = (chave) => paineis.reduce((s, p) => s + p[chave], 0);
  const porEstado = { atrasado: 0, hoje: 0, proximo: 0, "no-prazo": 0, "sem-prazo": 0, concluido: 0 };
  for (const p of paineis) for (const k of Object.keys(porEstado)) porEstado[k] += p.porEstado[k];

  const total = somar("total");
  return {
    quadros: paineis.length,
    total,
    abertos: somar("abertos"),
    feitos: somar("feitos"),
    progresso: total ? Math.round((somar("feitos") / total) * 100) : 0,
    porEstado,
  };
}
