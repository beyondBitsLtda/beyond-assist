// Uso: npm run world-check
//
// Confere as REGRAS e o MAPA do Mundo da Lisa (src/lib/lisaWorld.js) sem navegador. Importa o
// módulo direto — é o mesmo que o componente usa.
//
// O que isso protege:
// - a escada de construções: mal calibrada, o modo abre vazio e nunca muda (degraus caros
//   demais) ou entrega tudo na primeira visita (baratos demais);
// - o MAPA: duas construções ocupando o mesmo pedaço de terreno se atravessam na tela, e isso é
//   difícil de ver a olho num terreno de 30x30 com quase trinta coisas em cima.
import {
  ACTIVITIES, CASA, GRID, PATH_TILES, WORLD_ITEMS,
  availableActivities, houseLevel, nextItem, unlockedItems, worldXp,
} from "../src/lib/lisaWorld.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASSA" : "FALHA"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

// --- escada coerente ---
const xps = WORLD_ITEMS.map((i) => i.xp);
ok("escada sempre sobe", xps.every((v, i) => i === 0 || v > xps[i - 1]));
ok("chaves não se repetem", new Set(WORLD_ITEMS.map((i) => i.key)).size === WORLD_ITEMS.length);
ok("terreno começa vazio", unlockedItems(0).length === 0);
ok("tudo destravado no fim", unlockedItems(xps.at(-1)).length === WORLD_ITEMS.length);

// --- XP só sobe, e cada fonte conta ---
ok("sem nada feito, XP é 0", worldXp({ games: { total: 0, wins: 0 } }) === 0);
ok("jogar conta", worldXp({ games: { total: 1, wins: 0 } }) > 0);
ok("ganhar conta mais que só jogar", worldXp({ games: { total: 1, wins: 1 } }) > worldXp({ games: { total: 1, wins: 0 } }));
ok("quiz conta", worldXp({ quiz: { points: 25 } }) === 25);
ok("pair conta", worldXp({ pair: { points: 70 } }) === 70);
ok("dados faltando não quebram", worldXp({}) === 0 && worldXp() === 0);
ok("número negativo não vira XP", worldXp({ games: { total: -5, wins: -5 } }) === 0);

// --- objetivo e casa ---
ok("no começo o objetivo é o primeiro item", nextItem(0).key === WORLD_ITEMS[0].key);
ok("progresso fica entre 0 e 1", WORLD_ITEMS.every((i) => { const n = nextItem(i.xp - 1); return !n || (n.progresso >= 0 && n.progresso <= 1); }));
ok("com tudo construído não há próximo", nextItem(999999) === null);
ok("casa começa térrea", houseLevel(0) === 1);
ok("a casa cresce com o fim da escada", houseLevel(xps.at(-1)) === 3 && houseLevel(2200) === 2);

// --- MAPA: nada pode sair do terreno nem cair em cima de outra coisa ---
const comArea = [{ key: "casa", ...CASA }, ...WORLD_ITEMS.filter((i) => i.tx != null)];
const foraDoTerreno = comArea.filter((i) => i.tx < 0 || i.ty < 0 || i.tx + i.w > GRID || i.ty + i.d > GRID);
ok("toda construção cabe no terreno", foraDoTerreno.length === 0, foraDoTerreno.map((i) => i.key).join(", "));

const colide = (a, b) => a.tx < b.tx + b.w && b.tx < a.tx + a.w && a.ty < b.ty + b.d && b.ty < a.ty + a.d;
const sobrepostas = [];
for (let i = 0; i < comArea.length; i++)
  for (let j = i + 1; j < comArea.length; j++)
    if (colide(comArea[i], comArea[j])) sobrepostas.push(`${comArea[i].key}×${comArea[j].key}`);
ok("nenhuma construção em cima de outra", sobrepostas.length === 0, sobrepostas.join(", "));

const caminhoFora = PATH_TILES.filter(([x, y]) => x < 0 || y < 0 || x >= GRID || y >= GRID);
ok("o caminho de pedra fica dentro do terreno", caminhoFora.length === 0, `${PATH_TILES.length} tiles`);

// --- atividades ---
const semNada = availableActivities([], false);
const comTudoDia = availableActivities(WORLD_ITEMS.map((i) => i.key), false);
const comTudoNoite = availableActivities(WORLD_ITEMS.map((i) => i.key), true);
ok("já tem o que fazer com o terreno vazio", semNada.length >= 3, `${semNada.length} atividades`);
ok("o terreno cheio tem bem mais o que fazer", comTudoDia.length > semNada.length * 2, `${semNada.length} → ${comTudoDia.length}`);
ok("a noite abre atividades que o dia não tem", comTudoNoite.length > comTudoDia.length, `${comTudoDia.length} de dia, ${comTudoNoite.length} de noite`);
ok("a obra não entra no sorteio", !comTudoNoite.some((a) => a.key === "obra"));
ok("toda atividade com `needs` aponta pra uma construção que existe",
  ACTIVITIES.every((a) => !a.needs || WORLD_ITEMS.some((i) => i.key === a.needs)));
const destinoFora = ACTIVITIES.filter((a) => a.at && (a.at[0] < 0 || a.at[1] < 0 || a.at[0] >= GRID || a.at[1] >= GRID));
ok("ela nunca caminha pra fora do terreno", destinoFora.length === 0, destinoFora.map((a) => a.key).join(", "));

// --- quanto custa na prática ---
console.log("\nquanto custa cada construção (só jogando partidas, metade ganha):");
const perGame = worldXp({ games: { total: 2, wins: 1 } }) / 2;
for (const i of WORLD_ITEMS) {
  const partidas = Math.ceil(i.xp / perGame);
  const ativ = availableActivities(unlockedItems(i.xp), false).length;
  console.log(`  ${String(i.xp).padStart(5)} pts  ~${String(partidas).padStart(4)} partidas  ${i.label.padEnd(22)} (${ativ} atividades no terreno)`);
}
console.log(`\nou, só no pair programming médio (70 pts): ${Math.ceil(xps.at(-1) / 70)} sessões pro terreno completo`);

console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fails ? 1 : 0);
