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
  CASA, GRID, PATH_TILES, WORLD_ITEMS,
  houseLevel, nextItem, unlockedItems, worldXp,
} from "../src/lib/lisaWorld.js";
import {
  FALAS, GOD_EVENTS, HORDA, MORDIDA_ALCANCE, TIRO_INTERVALO, ZUMBI_VIDA,
  criarInimigos, planoDe,
} from "../src/lib/worldEvents.js";
import { ACOES, BLOCOS, acoesDaHora, blocoDa, ehNoite, horaDoMundo, proximaAcao } from "../src/lib/lisaRotina.js";
import { GESTOS, gesto } from "../src/components/panels/lisaAnim.js";
import { LISA } from "../src/components/panels/worldSprites.js";

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

// --- quanto custa na prática ---
console.log("\nquanto custa cada construção (só jogando partidas, metade ganha):");
const perGame = worldXp({ games: { total: 2, wins: 1 } }) / 2;
for (const i of WORLD_ITEMS) {
  const partidas = Math.ceil(i.xp / perGame);
  const tem = unlockedItems(i.xp);
  const ativ = new Set([...Array(24).keys()].flatMap((h) => acoesDaHora(h, tem))).size;
  console.log(`  ${String(i.xp).padStart(5)} pts  ~${String(partidas).padStart(4)} partidas  ${i.label.padEnd(22)} (${ativ} ações no dia dela)`);
}
console.log(`\nou, só no pair programming médio (70 pts): ${Math.ceil(xps.at(-1) / 70)} sessões pro terreno completo`);

// --- Modo Deus: os eventos e o que ela faz em cada um ---
console.log("");
const comPlano = GOD_EVENTS.filter((e) => e.tipo !== "parar" && e.tipo !== "hora");
ok("todo evento tem plano de reação", comPlano.every((e) => planoDe(e.key).length > 0),
  comPlano.map((e) => e.key + ":" + planoDe(e.key).length).join(" "));
const passos = GOD_EVENTS.flatMap((e) => planoDe(e.key));
ok("toda fala citada por um plano existe", passos.every((p) => !p.fala || FALAS[p.fala]),
  passos.filter((p) => p.fala && !FALAS[p.fala]).map((p) => p.fala).join(", "));
ok("todo `needs` de passo aponta pra uma construção real",
  passos.every((p) => !p.needs || WORLD_ITEMS.some((i) => i.key === p.needs)));
ok("todo destino de passo é um lugar conhecido",
  passos.every((p) => !p.ir || ["casa", "porta"].includes(p.ir) || WORLD_ITEMS.some((i) => i.key === p.ir)));
ok("nenhum grupo de falas está vazio", Object.values(FALAS).every((v) => v.length >= 3));
ok("a horda entra em fila, não de uma vez", criarInimigos("zumbis", [5, 28], HORDA.zumbis).every((e, i) => i === 0 || e.entraEm > 0));

// A luta precisa ser ENFRENTÁVEL: nem passeio de dois tiros, nem eterna. Com 6 zumbis de 2 de
// vida a Nala limpava a horda sozinha enquanto a Lisa ia buscar a arma, e a luta nem acontecia.
const simularLuta = () => {
  const horda = criarInimigos("zumbis", [5, 28], HORDA.zumbis);
  let t = 0;
  let proxTiro = 0;
  let proxMordida = 0;
  while (t < 120000 && horda.some((e) => e.vivo)) {
    t += 50;
    const alvo = horda.find((e) => e.vivo && t >= e.entraEm);
    if (!alvo) continue;
    if (t >= proxTiro) { alvo.vida--; proxTiro = t + TIRO_INTERVALO; }
    if (t >= proxMordida) { alvo.vida--; proxMordida = t + 2000; }
    if (alvo.vida <= 0) alvo.vivo = false;
  }
  return t / 1000;
};
const dur = simularLuta();
ok("a luta contra a horda dura um tempo decente", dur > 8 && dur < 45, dur.toFixed(1) + "s");
console.log("  (" + HORDA.zumbis + " zumbis de " + ZUMBI_VIDA + " de vida, um tiro a cada " + TIRO_INTERVALO + "ms, mais a mordida da Nala)");

// --- A ROTINA: o dia precisa ter forma, e nenhuma hora pode ficar vazia ---
console.log("");
const horas = [...Array(24).keys()];
ok("toda hora do dia cai numa faixa", horas.every((h) => blocoDa(h)), horas.map((h) => blocoDa(h).nome).filter((v, i, a) => a.indexOf(v) === i).join(" → "));
ok("toda ação citada por uma faixa existe",
  BLOCOS.every((b) => b.acoes.every((k) => ACOES[k])),
  BLOCOS.flatMap((b) => b.acoes).filter((k) => !ACOES[k]).join(", "));
ok("todo `precisa` de ação aponta pra uma construção real",
  Object.values(ACOES).every((a) => !a.precisa || WORLD_ITEMS.some((i) => i.key === a.precisa)),
  Object.entries(ACOES).filter(([, a]) => a.precisa && !WORLD_ITEMS.some((i) => i.key === a.precisa)).map(([k]) => k).join(", "));
ok("todo destino de ação é lugar conhecido",
  Object.values(ACOES).every((a) => a.em == null || Array.isArray(a.em) || a.em === "casa" || WORLD_ITEMS.some((i) => i.key === a.em)));
ok("terreno vazio ainda tem um dia inteiro", horas.every((h) => acoesDaHora(h, []).length > 0));
// Uma opção só não basta: num terreno vazio ela repetia a MESMA ação a faixa inteira (três
// horas olhando as estrelas foi o que apareceu na tela). Só a madrugada pode ser monótona,
// porque ali ela dorme.
const semPre = (b) => b.acoes.filter((k) => !ACOES[k].precisa).length;
ok("num terreno vazio toda faixa tem o que alternar (menos a madrugada)",
  BLOCOS.every((b) => b.nome === "madrugada" || semPre(b) >= 2),
  BLOCOS.filter((b) => b.nome !== "madrugada" && semPre(b) < 2).map((b) => b.nome).join(", "));
ok("na madrugada ela só dorme", semPre(BLOCOS.at(-1)) === 1);
ok("o terreno completo enriquece o dia",
  horas.some((h) => acoesDaHora(h, WORLD_ITEMS.map((i) => i.key)).length > acoesDaHora(h, []).length));
ok("de madrugada ela dorme", acoesDaHora(2, WORLD_ITEMS.map((i) => i.key)).join() === "dormir");
ok("a noite do desenho bate com a rotina", ehNoite(2) && ehNoite(21) && !ehNoite(10));

// --- as ANIMAÇÕES: toda ação precisa ter um gesto próprio, senão o mundo volta a ser três
// poses com rótulos diferentes ---
const anims = [...new Set(Object.values(ACOES).map((a) => a.anim))];
ok("toda ação da rotina tem animação",
  anims.every((k) => GESTOS[k]),
  anims.filter((k) => !GESTOS[k]).join(", "));
ok("toda pose citada por um gesto existe no desenho",
  Object.keys(GESTOS).every((k) => { const p = gesto(k, 0).pose; return LISA[p] !== undefined; }),
  Object.keys(GESTOS).filter((k) => !LISA[gesto(k, 0).pose]).join(", "));
// Um gesto parado não é animação: cada um tem que MEXER alguma coisa ao longo do ciclo.
// A conta é o quanto a CABEÇA anda, que é o que se enxerga: onde ela para depois de deslocar o
// corpo e inclinar em torno dos pés (a Lisa tem ~20 células até a cabeça). Medindo DISTÂNCIA, e
// não a soma dos eixos — somados, descer agachando e inclinar pra frente se cancelavam e um
// gesto bem animado passava por imóvel.
const ALTURA = 20;
const amplitude = (k) => {
  const ms = GESTOS[k].ms;
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const { dx, dy, lean, agacha } = gesto(k, (ms * i) / 24);
    const h = ALTURA * (1 - agacha);
    pts.push([dx + Math.sin(lean) * h, dy - Math.cos(lean) * h]);
  }
  let max = 0;
  for (const a of pts) for (const b of pts) max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return max;
};
const parados = Object.keys(GESTOS).filter((k) => k !== "andar" && amplitude(k) < 0.8);
ok("nenhum gesto fica imóvel no ciclo", parados.length === 0, parados.join(", "));
ok("cada ação tem seu próprio gesto, não três pra todas", anims.length >= 12, `${anims.length} animações diferentes`);
ok("andar alterna as duas pernas", gesto("andar", 0).pose !== gesto("andar", GESTOS.andar.ms).pose);

// --- o relógio ---
ok("sem aceleração, o relógio do mundo é o do aparelho",
  Math.abs(horaDoMundo({ base: 9, desde: 0, agora: 3600000, aceleracao: 1 }) - 10) < 1e-6);
ok("acelerado, o dia corre", horaDoMundo({ base: 0, desde: 0, agora: 60000, aceleracao: 90 }) > 1);
ok("o relógio dá a volta na meia-noite",
  horaDoMundo({ base: 23, desde: 0, agora: 7200000, aceleracao: 1 }) === 1);

console.log("\num dia dela, com o terreno completo:");
const tudo = WORLD_ITEMS.map((i) => i.key);
let ult = null;
for (const h of horas) {
  if (h % 2) continue;
  ult = proximaAcao(h, tudo, ult);
  console.log(`  ${String(h).padStart(2, "0")}h  ${blocoDa(h).nome.padEnd(13)} ${ACOES[ult].label}`);
}

console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fails ? 1 : 0);
