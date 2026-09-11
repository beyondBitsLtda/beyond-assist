// Uso: npm run disc-balance
//
// Confere o BALANCEAMENTO do jogo do disco (Modo Interativo → "Lançar Disco pra Nala") rodando
// milhares de lances sem navegador. Importa src/lib/discPhysics.js direto — é o MESMO código que
// o laço de desenho executa, não uma cópia parecida.
//
// O que ele protege: já aconteceu de os números deixarem o jogo sem graça (abaixo de certa força
// o disco nunca chegava nela, acima disso ela pegava tudo, e nem no talo o disco passava por
// cima). O mapa impresso no fim mostra isso de relance.
import {
  launchOf, newNala, primeNala, stepRally, gestureOf,
} from "../src/lib/discPhysics.js";

/** Roda um lance inteiro como o laço de desenho faz: stepRally por quadro, a 60fps. */
function rally(angle, power, nalaX) {
  const disc = launchOf(angle, power);
  const nala = newNala(nalaX);
  const react = primeNala(nala);
  const dt = 1 / 60;
  let t = 0;
  let maxJump = 0;
  while (t < 10) {
    const res = stepRally(disc, nala, dt, t * 1000 >= react);
    maxJump = Math.max(maxJump, nala.jh);
    t += dt;
    if (res) return { ...res, t, maxJump };
  }
  return { timeout: true, t, maxJump };
}

let fails = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASSA" : "FALHA"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};
/** Com o erro aleatório da Nala, um lance sozinho não prova nada: repete e olha a maioria. */
const most = (n, fn) => {
  const out = {};
  for (let i = 0; i < n; i++) {
    const k = fn();
    out[k] = (out[k] || 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1])[0][0];
};

ok("força 8 cai curto", most(40, () => rally(45, 8, 30).why) === "curto");
ok("força 100 em 45° passa por cima", most(40, () => rally(45, 100, 30).why) === "longo");

let caught = 0;
let total = 0;
let air = 0;
let timeouts = 0;
const grid = {};
for (let power = 10; power <= 100; power += 5) {
  let row = "";
  for (let angle = 15; angle <= 70; angle += 5) {
    for (const nx of [8, 30, 45]) {
      const r = rally(angle, power, nx);
      total++;
      if (r.timeout) timeouts++;
      if (r.caught) {
        caught++;
        if (r.air) air++;
      }
      if (nx === 30) row += r.timeout ? "?" : r.caught ? (r.air ? "A" : "c") : r.why === "curto" ? "-" : r.why === "longo" ? "+" : ".";
    }
  }
  grid[power] = row;
}

const pct = (100 * caught) / total;
ok("nenhum lance trava a simulação", timeouts === 0, `timeouts=${timeouts}`);
ok("existe faixa pegável", pct > 25, `${caught}/${total} = ${pct.toFixed(0)}%`);
ok("ela NÃO pega tudo (tem desafio)", pct < 65, `${pct.toFixed(0)}%`);
ok("ela pega no ar com frequência", air / Math.max(1, caught) > 0.2, `${air} de ${caught} pegadas foram no ar`);

console.log("\nmapa com a Nala começando no meio — linhas = força, colunas = ângulo 15..70");
console.log("  A=pegou no ar   c=pegou   -=curto   +=passou por cima   .=não alcançou");
for (const p of Object.keys(grid)) console.log(String(p).padStart(4) + "  " + grid[p]);

// ---- leitura do gesto: é o que transforma o seu movimento em direção e força ----
const flick = (dx, dy, ms, steps = 8) => {
  const pts = [];
  let peak = 0;
  for (let i = 0; i <= steps; i++) {
    if (i > 0) peak = Math.max(peak, Math.hypot(dx / steps, dy / steps) / (ms / steps));
    pts.push({ x: (dx * i) / steps, y: (dy * i) / steps, t: (ms * i) / steps });
  }
  return gestureOf({ pts, peak }, ms);
};

console.log("");
ok("toque curto não vira lance", flick(10, -12, 120) === null);
ok("puxar pra baixo não vira lance", flick(0, 200, 300) === null);
const fast = flick(160, -260, 120);
ok("movimento rápido = força alta", fast && fast.power > 85, `${fast?.power.toFixed(0)}%`);
const slow = flick(160, -260, 1600);
ok("arrasto lento = força baixa", slow && slow.power < 35, `${slow?.power.toFixed(0)}%`);
const flat = flick(320, -90, 200);
ok("gesto rasante = ângulo baixo", flat && flat.angle < 30, `${flat?.angle.toFixed(0)}°`);
const lob = flick(60, -300, 200);
ok("gesto pra cima = ângulo alto", lob && lob.angle > 60, `${lob?.angle.toFixed(0)}°`);

console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fails ? 1 : 0);
