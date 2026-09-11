// Regras do "Mundo da Lisa": o quintal e a casinha dela, que vão ganhando coisas conforme você
// interage com ela nos modos interativos.
//
// O progresso NÃO é uma moeda inventada: sai do que você já fez de verdade e que já está
// gravado — partidas dos joguinhos (lisa_games), quiz e pair programming (lisa_quiz,
// lisa_pair_sessions). Quem joga e estuda com ela constrói a casa dela; quem não joga vê um
// quintal vazio. É honesto e não precisou de tabela nova.
//
// Fica fora do componente porque é regra, não desenho: assim dá pra testar a escada de
// construções sem navegador (npm run world-check).

/** XP do mundo a partir das estatísticas REAIS já existentes. */
export function worldXp({ games, quiz, pair } = {}) {
  const played = Math.max(0, games?.total || 0);
  const wins = Math.max(0, games?.wins || 0);
  const quizPts = Math.max(0, quiz?.points || 0);
  const pairPts = Math.max(0, pair?.points || 0);
  // jogar já conta (é interação), ganhar conta um pouco mais; quiz e pair entram com o valor
  // que já valem nas telas de pontuação, pra não existirem duas moedas diferentes no app
  return played * 8 + wins * 6 + quizPts + pairPts;
}

/**
 * A escada de construções. `xp` é quanto custa pra ela conseguir aquilo.
 *
 * Os degraus do começo são baratos de propósito: umas poucas partidas já mudam alguma coisa na
 * tela, senão o modo abre vazio e não dá vontade de voltar. Os do fim são caros porque são a
 * recompensa longa.
 */
export const WORLD_ITEMS = [
  { key: "horta", xp: 40, label: "Horta", note: "canteiro pra ela regar" },
  { key: "arvore", xp: 90, label: "Árvore", note: "sombra no quintal" },
  { key: "casinha", xp: 160, label: "Casinha da Nala", note: "onde a Nala dorme" },
  { key: "varal", xp: 240, label: "Varal", note: "roupa secando ao vento" },
  { key: "banco", xp: 330, label: "Banco", note: "lugar pra ela descansar" },
  { key: "poste", xp: 430, label: "Poste de luz", note: "acende quando escurece" },
  { key: "radio", xp: 540, label: "Rádio", note: "ela ouve música no quintal" },
  { key: "cerca", xp: 660, label: "Cerca", note: "fecha o terreno" },
  { key: "correio", xp: 790, label: "Caixa de correio", note: "chega carta de vez em quando" },
  { key: "antena", xp: 930, label: "Antena", note: "é por ela que o Steve aparece" },
  { key: "chamine", xp: 1100, label: "Chaminé", note: "fumacinha no telhado" },
  { key: "sobrado", xp: 1400, label: "Segundo andar", note: "a casa cresce" },
];

/** Chaves já construídas com esse XP. */
export function unlockedItems(xp) {
  return WORLD_ITEMS.filter((i) => xp >= i.xp).map((i) => i.key);
}

/** Próxima construção e quanto falta — é o que a interface mostra como objetivo. */
export function nextItem(xp) {
  const next = WORLD_ITEMS.find((i) => xp < i.xp);
  if (!next) return null;
  const prev = [...WORLD_ITEMS].reverse().find((i) => xp >= i.xp);
  const from = prev ? prev.xp : 0;
  return { ...next, falta: next.xp - xp, progresso: Math.max(0, Math.min(1, (xp - from) / (next.xp - from))) };
}

/** Nível da casa: o telhado e o tamanho mudam com as construções grandes. */
export function houseLevel(xp) {
  if (xp >= 1400) return 3;
  if (xp >= 1100) return 2;
  return 1;
}

/**
 * O que ela faz no quintal. `needs` é a construção necessária — sem ela a atividade nem entra
 * no sorteio, que é o que faz o mundo ficar mais movimentado conforme cresce.
 *
 * `at` é onde ela vai fazer aquilo (coluna do cenário, ver SPOTS em worldScene.js);
 * null = onde ela estiver.
 */
export const ACTIVITIES = [
  { key: "passear", label: "passeando pelo quintal", ms: 7000, needs: null, at: null },
  { key: "varrer", label: "varrendo o quintal", ms: 9000, needs: null, at: 42, tool: "vassoura" },
  { key: "nala", label: "brincando com a Nala", ms: 13000, needs: null, at: 28 },
  { key: "ceu", label: "olhando o céu", ms: 6000, needs: null, at: null },
  { key: "regar", label: "regando as plantas", ms: 9000, needs: "horta", at: 64, tool: "regador" },
  { key: "varal", label: "estendendo roupa", ms: 8000, needs: "varal", at: 70 },
  { key: "descansar", label: "descansando no banco", ms: 11000, needs: "banco", at: 114, sit: true },
  { key: "musica", label: "ouvindo música", ms: 11000, needs: "radio", at: 108 },
  { key: "correio", label: "vendo se chegou carta", ms: 6000, needs: "correio", at: 14 },
  { key: "steve", label: "recebendo o Steve", ms: 15000, needs: "antena", at: 98 },
  { key: "obra", label: "construindo", ms: 9000, needs: null, at: 76, tool: "martelo", onlyOnBuild: true },
];

/** As atividades possíveis agora (a obra não entra no sorteio: ela só acontece quando algo
 * NOVO acaba de ser construído). */
export function availableActivities(unlocked) {
  const have = new Set(unlocked || []);
  return ACTIVITIES.filter((a) => !a.onlyOnBuild && (!a.needs || have.has(a.needs)));
}

export const BUILD_ACTIVITY = ACTIVITIES.find((a) => a.key === "obra");
