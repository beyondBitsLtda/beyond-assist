// Física e comportamento do jogo do disco (ver LisaDisc.js).
//
// Fica FORA do componente por dois motivos. Primeiro, as duas telas dependem de exatamente a
// mesma simulação: a prévia que o lançador vê tem que ser a mesma curva que a Nala enfrenta, e
// isso só é garantido se houver uma cópia só do cálculo. Segundo, jogo com física dentro do laço
// de desenho é impossível de testar — assim dá pra rodar mil lances em node e conferir que
// lance fraco cai curto, lance forte passa por cima e o do meio é pegável.
//
// Tudo em CÉLULAS do painel de LED e SEGUNDOS.
//
// O painel passou de 64x30 pra 96x45 células quando a Nala foi redesenhada: em 15x10 não cabia
// focinho, orelha caída e olho, e ela virava um borrão. Como TODAS as distâncias cresceram pelo
// mesmo fator 1.5 e o tempo ficou igual, as trajetórias são geometricamente idênticas às de
// antes — o jogo não mudou de dificuldade, só de resolução. Confirmado pelo npm run disc-balance.

export const FW = 96;      // largura do campo, em células
export const FH = 45;      // altura
export const GROUND = 39;  // linha onde as patas dela encostam

const GRAV = 33;   // células/s²
// Estes quatro números são o BALANCEAMENTO do jogo, e foram calibrados com o teste em
// scripts/ (mapa de força × ângulo). Os valores anteriores (16/40, arrasto 0.25) deixavam o
// jogo sem graça: abaixo de força 45 o disco nunca chegava nela e acima disso ela pegava
// praticamente tudo, porque o arrasto comia o alcance máximo e nem no talo o disco passava por
// cima. Com esta faixa, força fraca cai curto, força no talo passa direto, e o ângulo volta a
// importar (o alcance depende de sen(2θ)).
const DRAG = 0.12; // s⁻¹ — o planeio do disco; sem isso ele despenca que nem pedra
const V_MIN = 18;  // velocidade de saída com força 0
const V_MAX = 69;  // ...e com força 100

export const NALA_W = 22;
export const NALA_H = 15;
export const MOUTH_DX = 21; // onde fica a boca dentro do desenho dela
export const MOUTH_DY = 3;

export const NALA_SPEED = 27;     // células/s — de propósito NÃO dá pra chegar em tudo
export const NALA_REACT_MS = 350; // ela demora pra sacar o lance, como qualquer cachorro
const JUMP_V = 39;
const NALA_GRAV = 90;
export const CATCH_DIST = 4.5; // distância boca↔disco que conta como pegada
export const REACH = 16.5;   // altura máxima que ela alcança pulando

/** Estado inicial do disco pra um lance. */
export function launchOf(angle, power) {
  const v = V_MIN + (V_MAX - V_MIN) * (Math.max(0, Math.min(100, power)) / 100);
  const r = (angle * Math.PI) / 180;
  return { x: 0, y: GROUND - 4.5, vx: v * Math.cos(r), vy: -v * Math.sin(r), spin: 0 };
}

export function stepDisc(d, dt) {
  d.vx -= d.vx * DRAG * dt;
  d.vy += GRAV * dt;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.spin += dt * 18;
}

export function newNala(x = 45) {
  return { x, vx: 0, jh: 0, jv: 0, target: x, phase: "idle", until: 0, wander: 0, bias: 0 };
}

/**
 * Prepara a Nala pra UM lance e devolve quanto tempo ela vai demorar pra reagir.
 *
 * Ela erra de propósito, como as outras IAs daqui (a Lisa erra 18% no jogo da velha, lembra 72%
 * das cartas na memória). Sem isso, dentro da faixa boa de força ela pegava 100% dos lances e o
 * jogo acabava no instante em que você aprendesse o gesto: cada lance vem com um errinho de
 * leitura do ponto de queda e um tempo de reação diferente.
 */
export function primeNala(n) {
  n.bias = (Math.random() * 2 - 1) * 5.25; // células de erro ao ler onde o disco vai cair
  return NALA_REACT_MS * (0.7 + Math.random() * 1.1);
}

/** Posição da boca dela no campo — é o ponto que precisa encontrar o disco. */
export function mouthOf(n) {
  return { x: n.x + MOUTH_DX, y: GROUND - (NALA_H - 1) + MOUTH_DY - n.jh };
}

/**
 * Onde ela deve se posicionar: simula o disco pra frente e acha o primeiro instante em que ele
 * passa dentro do alcance dela. Correr atrás da posição ATUAL do disco chegaria sempre atrasado.
 */
export function predictTargetX(disc) {
  const sim = { ...disc };
  for (let t = 0; t < 4; t += 0.03) {
    stepDisc(sim, 0.03);
    if (sim.y >= GROUND) break;
    if (GROUND - sim.y <= REACH && sim.x >= MOUTH_DX) return clampX(sim.x - MOUTH_DX);
  }
  return clampX(sim.x - MOUTH_DX); // inalcançável: ela corre atrás assim mesmo
}

export const clampX = (x) => Math.max(0, Math.min(FW - NALA_W, x));

export function moveNala(n, dt, speedScale = 1) {
  const speed = NALA_SPEED * speedScale;
  const dx = n.target - n.x;
  const step = speed * dt;
  if (Math.abs(dx) < step) {
    n.x = n.target;
    n.vx = 0;
  } else {
    n.x += Math.sign(dx) * step;
    n.vx = Math.sign(dx) * speed;
  }
  n.x = clampX(n.x);
}

/** Pula se o disco vem chegando na altura que ela alcança. */
export function tryJump(n, d) {
  if (n.jh > 0 || n.jv !== 0) return false;
  const m = mouthOf(n);
  if (Math.abs(d.x - m.x) >= 7.5) return false;
  const height = GROUND - d.y;
  if (height <= 4.5 || height > REACH) return false;
  n.jv = -JUMP_V;
  return true;
}

/** `jh` é altura ACIMA do chão e `jv` segue a convenção da tela (negativo = subindo), por isso
 * a altura DESCONTA a velocidade em vez de somar. */
export function stepJump(n, dt) {
  if (n.jv === 0 && n.jh === 0) return;
  n.jv += NALA_GRAV * dt;
  n.jh -= n.jv * dt;
  if (n.jh <= 0) {
    n.jh = 0;
    n.jv = 0;
  }
}

export function caughtBy(n, d) {
  const m = mouthOf(n);
  return Math.hypot(d.x - m.x, d.y - m.y) < CATCH_DIST;
}

/** Por que o lance acabou sem pegada — null enquanto o disco ainda está no ar. */
export function discOutcome(d) {
  if (d.x > FW + 4.5) return "longo";
  if (d.y >= GROUND) return d.x < MOUTH_DX ? "curto" : "fora de alcance";
  return null;
}

/**
 * UM quadro da disputa (muta `disc` e `nala`). É esta função que o laço de desenho chama, então
 * é ela que o teste exercita — não uma reimplementação parecida.
 * Devolve null enquanto o lance está no ar, ou { caught, air, why } quando resolve.
 */
export function stepRally(disc, nala, dt, chasing) {
  stepDisc(disc, dt);
  if (chasing) nala.target = clampX(predictTargetX(disc) + nala.bias);
  moveNala(nala, dt, 1);
  tryJump(nala, disc);
  stepJump(nala, dt);
  if (caughtBy(nala, disc)) {
    const air = nala.jh > 1.5; // escala com o resto do painel: 1 célula virou 1.5
    return { caught: true, air, why: air ? "no ar" : "no chão" };
  }
  const out = discOutcome(disc);
  return out ? { caught: false, air: false, why: out } : null;
}

/** Converte o gesto em ângulo e força. null se foi movimento curto demais pra valer como lance
 * — encostar na tela não pode virar arremesso. */
export function gestureOf(d, now) {
  const pts = d.pts;
  const first = pts[0];
  const lastPt = pts[pts.length - 1];
  if (Math.hypot(lastPt.x - first.x, lastPt.y - first.y) < 36) return null;

  // direção: o trecho final do movimento (uns 120ms), que é pra onde o disco sai
  let ref = pts[0];
  for (let i = pts.length - 1; i >= 0; i--) {
    ref = pts[i];
    if (now - pts[i].t >= 120) break;
  }
  const dx = Math.abs(lastPt.x - ref.x);
  const dy = lastPt.y - ref.y;
  if (dx < 1 && dy > -1) return null; // parado, ou puxando pra baixo: não é lance

  const angle = Math.max(12, Math.min(75, (Math.atan2(-dy, Math.max(dx, 0.001)) * 180) / Math.PI));
  const power = Math.max(6, Math.min(100, d.peak * 45));
  return { angle, power };
}
