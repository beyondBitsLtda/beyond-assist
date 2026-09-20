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
