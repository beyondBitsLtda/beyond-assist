// Quanto vale cada coisa. Num lugar só, para a tela e o servidor nunca discordarem.

export const PONTOS = {
  item: 10,          // um item de checklist marcado
  card: 30,          // bônus por concluir um assunto inteiro
  meta_diaria: 20,   // bônus, uma vez por dia, ao bater a meta
};

export const META_DIARIA_PADRAO = 30;
export const METAS_DIARIAS = [10, 20, 30, 50, 80, 120];

/** A chave que impede pontuar duas vezes pela mesma coisa (ver proof_eventos). */
export const chaveDoEvento = {
  item: (itemId) => `item:${itemId}`,
  card: (cardId) => `card:${cardId}`,
  meta: (dia) => `meta:${dia}`,
};

/**
 * Os pontos que contam para a meta do dia: o que a pessoa FEZ hoje. O bônus da própria meta e os
 * pontos de conquista ficam de fora — senão uma conquista desbloqueada "batia" a meta sozinha.
 */
export function pontosDoDiaParaMeta(eventosDoDia) {
  return eventosDoDia
    .filter((e) => e.tipo !== "meta_diaria" && e.tipo !== "conquista")
    .reduce((s, e) => s + e.pontos, 0);
}

/** Nível a cada 200 pontos. Simples de propósito: o número que motiva é a ofensiva. */
export const PONTOS_POR_NIVEL = 200;
export function nivelPorPontos(total) {
  const t = Math.max(0, Number(total) || 0);
  return {
    nivel: 1 + Math.floor(t / PONTOS_POR_NIVEL),
    noNivel: t % PONTOS_POR_NIVEL,
    proximo: PONTOS_POR_NIVEL,
  };
}

export const NOMES_DOS_EVENTOS = {
  item: "Tarefa concluída",
  card: "Assunto concluído",
  meta_diaria: "Meta do dia batida",
  quiz: "Quiz",
  exercicio: "Exercício",
  projeto_semanal: "Projeto da semana",
  projeto_mensal: "Projeto do mês",
  conquista: "Conquista",
};
