// Uso: npm run world-check
//
// Confere as REGRAS do Mundo da Lisa (src/lib/lisaWorld.js) sem navegador: a escada de
// construções, o XP tirado das estatísticas reais e quais atividades ficam disponíveis em cada
// etapa. Importa o módulo direto — é o mesmo que o componente usa.
//
// O que isso protege: se a escada ficar mal calibrada, o modo abre vazio e nunca muda (degraus
// caros demais) ou entrega tudo na primeira visita (baratos demais). A tabela impressa no fim
// mostra quanto de jogo/estudo cada construção custa.
import {
  WORLD_ITEMS, ACTIVITIES, availableActivities, houseLevel, nextItem, unlockedItems, worldXp,
} from "../src/lib/lisaWorld.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASSA" : "FALHA"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

// --- escada coerente ---
const xps = WORLD_ITEMS.map((i) => i.xp);
ok("escada sempre sobe", xps.every((v, i) => i === 0 || v > xps[i - 1]), xps.join(" < "));
ok("chaves não se repetem", new Set(WORLD_ITEMS.map((i) => i.key)).size === WORLD_ITEMS.length);
ok("quintal começa vazio", unlockedItems(0).length === 0);
ok("tudo destravado no fim", unlockedItems(xps.at(-1)).length === WORLD_ITEMS.length);

// --- XP só sobe, e cada fonte conta ---
const base = worldXp({ games: { total: 0, wins: 0 }, quiz: { points: 0 }, pair: { points: 0 } });
ok("sem nada feito, XP é 0", base === 0);
ok("jogar conta", worldXp({ games: { total: 1, wins: 0 } }) > 0);
ok("ganhar conta mais que só jogar", worldXp({ games: { total: 1, wins: 1 } }) > worldXp({ games: { total: 1, wins: 0 } }));
ok("quiz conta", worldXp({ quiz: { points: 25 } }) === 25);
ok("pair conta", worldXp({ pair: { points: 70 } }) === 70);
ok("dados faltando não quebram", worldXp({}) === 0 && worldXp() === 0);
ok("número negativo não vira XP", worldXp({ games: { total: -5, wins: -5 } }) === 0);

// --- nextItem aponta pro degrau certo ---
const n0 = nextItem(0);
ok("no começo o objetivo é o primeiro item", n0.key === WORLD_ITEMS[0].key, `${n0.label}, falta ${n0.falta}`);
ok("progresso fica entre 0 e 1", WORLD_ITEMS.every((i) => { const n = nextItem(i.xp - 1); return !n || (n.progresso >= 0 && n.progresso <= 1); }));
ok("com tudo construído não há próximo", nextItem(99999) === null);

// --- casa cresce ---
ok("casa começa térrea", houseLevel(0) === 1);
ok("chaminé sobe a casa pro nível 2", houseLevel(1100) === 2);
ok("segundo andar é nível 3", houseLevel(1400) === 3);

// --- atividades acompanham as construções ---
const semNada = availableActivities([]);
const comTudo = availableActivities(WORLD_ITEMS.map((i) => i.key));
ok("já tem o que fazer com o quintal vazio", semNada.length >= 3, `${semNada.length} atividades`);
ok("o quintal cheio tem mais o que fazer", comTudo.length > semNada.length, `${semNada.length} → ${comTudo.length}`);
ok("a obra não entra no sorteio", !comTudo.some((a) => a.key === "obra"));
ok("toda atividade com `needs` aponta pra uma construção que existe",
  ACTIVITIES.every((a) => !a.needs || WORLD_ITEMS.some((i) => i.key === a.needs)));

// --- quanto de jogo isso custa na prática ---
console.log("\nquanto custa cada construção (só jogando partidas, metade ganha):");
const perGame = worldXp({ games: { total: 2, wins: 1 } }) / 2; // XP médio por partida
for (const i of WORLD_ITEMS) {
  const partidas = Math.ceil(i.xp / perGame);
  const atividades = availableActivities(unlockedItems(i.xp)).length;
  console.log(`  ${String(i.xp).padStart(5)} pts  ~${String(partidas).padStart(3)} partidas  ${i.label.padEnd(20)} (${atividades} atividades no quintal)`);
}
console.log(`\nou, só no pair programming médio (70 pts): ${Math.ceil(xps.at(-1) / 70)} sessões pro quintal completo`);

console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fails ? 1 : 0);
