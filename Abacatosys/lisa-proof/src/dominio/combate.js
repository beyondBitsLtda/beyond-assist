// O COMBATE do Reino do Neuro: uma simulação passo a passo, no estilo Clash of Clans. Puro.
//
// Cada tropa anda até um alvo, para quando ele fica no seu alcance e bate a cada `intervalo`.
// Cada defesa (Torre de Arqueiros, Canhão e a própria Torre do Neuro) mira a tropa inimiga mais
// perto que ela alcança. A Muralha cerca a Torre do Neuro: tropa que bate por terra e de perto
// precisa derrubá-la antes. A guarnição (tropas de defesa) e o Neuro do defensor saem da Torre
// quando o inimigo chega perto.
//
// O resultado sai da destruição, como no Clash: 50% das construções no chão vale ⭐; derrubar a
// Torre do Neuro vale ⭐; 100% vale ⭐. A Muralha não conta na porcentagem.
//
// DETERMINÍSTICO: mesma entrada + mesma semente = mesma batalha, no servidor e em qualquer
// navegador. Por isso aqui só há soma, multiplicação, divisão e raiz quadrada (exatas em todo
// motor de JavaScript) e um sorteio próprio por semente — nada de seno, cosseno nem Math.random.
// O servidor decide a invasão; a tela roda a mesma simulação para mostrar a luta.

import { TROPAS, contagens, heroiNeuro } from "./tropas.js";

export const DT = 0.1;              // segundos por passo
export const DURACAO_MAXIMA = 60;   // segundos de batalha, no máximo

/**
 * Onde fica cada construção na ilha (o mundo 3D desenha nos mesmos lugares). As da segunda linha
 * moram na terra nova que o Terreno compra: ficam além da beirada da ilha original.
 */
export const LUGARES = {
  castelo: [-0.6, -1.9], mina: [-4.3, -0.7], cofre: [4.1, -0.9],
  torre: [-3.2, 3.0], quartel: [3.4, 2.9], canhao: [1.9, -0.4],
  biblioteca: [-6.95, -2.53], defesaAerea: [-2.53, -6.95],   // Terreno 1 (contas feitas: raio 7,4)
  morteiro: [4.3, -7.45], torreMagica: [-8.31, 2.23],        // Terreno 2 (raio 8,6)
  torreRaio: [-6.93, -6.93],                                 // Terreno 3 (raio 9,8)
};
/** O raio da ilha: 7, e mais 1,2 a cada expansão do Terreno. */
export const raioDaIlha = (terreno) => 7 + 1.2 * Math.max(0, Math.min(3, terreno || 0));
export const PRACA = [0.5, 1.3];
export const RAIO_DA_MURALHA = 1.75; // o anel em volta da Torre do Neuro

/** A beirada da frente da ilha, por onde o inimigo desembarca (contas já feitas: raio 6,8; numa
 *  ilha maior, os mesmos pontos esticados até a beirada nova). */
export const PONTOS_DE_ENTRADA = [
  [6.525, 1.914], [6.236, 2.713], [5.849, 3.469], [5.371, 4.171], [4.808, 4.808],
  [4.171, 5.371], [3.469, 5.849], [2.713, 6.236], [1.914, 6.525],
];

/** Vida e ataque de cada construção, por nível. Construção no nível 0 não existe na batalha. */
export const PREDIOS_EM_COMBATE = {
  castelo: { vida: (n) => 1000 + 400 * n, raio: 0.95, defesa: (n) => ({ dano: 8 + 4 * n, intervalo: 1.0, alcance: 3.5, acertaAr: true, acertaChao: true, arma: "flecha" }) },
  mina: { vida: (n) => 400 + 150 * n, raio: 0.9 },
  cofre: { vida: (n) => 500 + 200 * n, raio: 0.7 },
  quartel: { vida: (n) => 450 + 180 * n, raio: 0.9 },
  torre: { vida: (n) => 500 + 200 * n, raio: 0.6, defesa: (n) => ({ dano: 10 + 8 * n, intervalo: 0.8, alcance: 4.2, acertaAr: true, acertaChao: true, arma: "flecha" }) },
  canhao: { vida: (n) => 550 + 220 * n, raio: 0.55, defesa: (n) => ({ dano: 30 + 20 * n, intervalo: 1.2, alcance: 3.6, acertaAr: false, acertaChao: true, arma: "bala" }) },
  biblioteca: { vida: (n) => 450 + 170 * n, raio: 0.8 },
  defesaAerea: { vida: (n) => 420 + 160 * n, raio: 0.6, defesa: (n) => ({ dano: 45 + 25 * n, intervalo: 1.0, alcance: 4.6, acertaAr: true, acertaChao: false, arma: "missil" }) },
  morteiro: { vida: (n) => 450 + 170 * n, raio: 0.6, defesa: (n) => ({ dano: 20 + 10 * n, intervalo: 3.0, alcance: 6.0, minimo: 1.6, area: 1.1, acertaAr: false, acertaChao: true, arma: "morteiro" }) },
  torreMagica: { vida: (n) => 400 + 160 * n, raio: 0.6, defesa: (n) => ({ dano: 12 + 6 * n, intervalo: 1.3, alcance: 3.8, area: 0.9, acertaAr: true, acertaChao: true, arma: "magia" }) },
  torreRaio: { vida: (n) => 650 + 250 * n, raio: 0.6, defesa: (n) => ({ dano: 16 + 8 * n, intervalo: 0.5, alcance: 3.4, acertaAr: true, acertaChao: true, arma: "raio" }) },
  muralha: { vida: (n) => 600 + 400 * n },
};
// gigantes e balões na frente (seguram o fogo), bombardeiros logo atrás (para abrir a muralha)
const ORDEM_DE_ENTRADA = ["gigante", "balao", "bombardeiro", "guerreiro", "arqueira", "mago", "dragao", "curandeira"];
const PREDIOS_DA_BATALHA = ["castelo", "mina", "cofre", "quartel", "torre", "canhao", "biblioteca", "defesaAerea", "morteiro", "torreMagica", "torreRaio"];
// lugares em volta da Torre do Neuro de onde a guarnição sai
const SAIDAS_DA_GUARNICAO = [[0.9, 1.2], [1.3, 0.5], [0.3, 1.4], [1.4, -0.2], [-0.4, 1.3], [1.0, 0.9], [0.0, 1.0], [1.5, 0.9]];

function sorteio(semente) {
  let a = (semente >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const distancia = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
const ARMAS = { arqueira: "flecha", dragao: "fogo", mago: "magia", balao: "bomba", bombardeiro: "explosao" };
const arma = (u) => (u.tipo === "heroi" ? (u.lado === "defesa" ? "livro" : "golpe") : ARMAS[u.tipo] || "golpe");

/**
 * Prepara a batalha. `atacante`: { exercito, neuro_nivel }. `defensor`: { construcoes (níveis
 * completos), neuro_nivel, guarnicao }.
 */
export function montarCombate({ atacante, defensor, semente = 1 }) {
  const rand = sorteio(semente);
  const niveis = defensor?.construcoes || {};
  const predios = [];
  for (const chave of PREDIOS_DA_BATALHA) {
    const n = niveis[chave] || 0;
    if (n < 1) continue;
    const est = PREDIOS_EM_COMBATE[chave];
    const [x, z] = LUGARES[chave];
    const vida = est.vida(n);
    predios.push({ id: `p-${chave}`, chave, nivel: n, x, z, raio: est.raio, vida, vidaMax: vida, vivo: true, defesa: est.defesa ? est.defesa(n) : null, recarga: 0 });
  }
  const nm = niveis.muralha || 0;
  const castelo = predios.find((p) => p.chave === "castelo") || null;
  const muralha = nm > 0 && castelo
    ? { id: "p-muralha", chave: "muralha", nivel: nm, x: castelo.x, z: castelo.z, vida: PREDIOS_EM_COMBATE.muralha.vida(nm), vidaMax: PREDIOS_EM_COMBATE.muralha.vida(nm), vivo: true }
    : null;

  // o ataque entra em ondas: gigantes na frente (seguram o fogo), depois o resto e o herói
  const ex = contagens(atacante?.exercito);
  const fila = [];
  for (const t of ORDEM_DE_ENTRADA) for (let i = 0; i < (ex[t] || 0); i++) fila.push(t);
  if (fila.length && atacante?.neuro_nivel) fila.push("heroi");
  const esticar = (raioDaIlha(niveis.terreno) - 0.2) / 6.8;
  const entradas = fila.map((tipo, i) => {
    const [px, pz] = PONTOS_DE_ENTRADA[i % PONTOS_DE_ENTRADA.length];
    return { tipo, quando: 0.3 + i * 0.15, ponto: [px * esticar, pz * esticar] };
  });

  const gu = contagens(defensor?.guarnicao);
  const guarnicao = [];
  for (const t of ORDEM_DE_ENTRADA) for (let i = 0; i < (gu[t] || 0); i++) guarnicao.push(t);
  if (defensor?.neuro_nivel && castelo) guarnicao.push("heroi");

  return {
    t: 0, passos: 0, rand, predios, muralha, castelo, unidades: [], entradas, guarnicao,
    guarnicaoSaiu: false, seq: 0, fim: false, totalPredios: predios.length,
    neuro: { ataque: atacante?.neuro_nivel || 0, defesa: defensor?.neuro_nivel || 0 },
  };
}

function criarUnidade(e, tipo, lado, x, z) {
  const base = tipo === "heroi" ? heroiNeuro(lado === "ataque" ? e.neuro.ataque : e.neuro.defesa, lado) : TROPAS[tipo];
  e.seq += 1;
  return {
    id: `u${e.seq}`, tipo, lado, x, z, vida: base.vida, vidaMax: base.vida, dano: base.dano, intervalo: base.intervalo,
    alcance: base.alcance, velocidade: base.velocidade, voa: base.voa, acertaAr: base.acertaAr, alvoTipo: base.alvo,
    area: base.area || 0, suicida: Boolean(base.suicida), contraMuralha: base.contraMuralha || 1, cura: base.cura || 0,
    alvo: null, recarga: e.rand() * 0.4, viva: true,
  };
}

/** A distância até a "pele" do alvo (construção tem tamanho; o muro é um anel). */
function distanciaAte(e, u, alvo) {
  if (alvo.chave === "muralha") return Math.max(0, distancia(u.x, u.z, e.castelo.x, e.castelo.z) - RAIO_DA_MURALHA);
  return Math.max(0, distancia(u.x, u.z, alvo.x, alvo.z) - (alvo.raio || 0));
}
/** Para onde andar: o centro do alvo, ou o ponto do muro de frente para a tropa. */
function pontoDo(e, u, alvo) {
  if (alvo.chave !== "muralha") return [alvo.x, alvo.z];
  const d = distancia(u.x, u.z, e.castelo.x, e.castelo.z) || 1;
  return [e.castelo.x + ((u.x - e.castelo.x) / d) * RAIO_DA_MURALHA, e.castelo.z + ((u.z - e.castelo.z) / d) * RAIO_DA_MURALHA];
}
const alcancaUnidade = (atirador, alvo) => (alvo.voa ? atirador.acertaAr : atirador.acertaChao !== false);

function inimigoMaisPerto(e, u, ladoAlvo, limite) {
  let melhor = null, menor = Infinity;
  for (const o of e.unidades) {
    if (!o.viva || o.lado !== ladoAlvo || !alcancaUnidade(u, o)) continue;
    const d = distancia(u.x, u.z, o.x, o.z);
    if (d <= limite && d < menor) { menor = d; melhor = o; }
  }
  return melhor;
}

function escolherPredio(e, u) {
  const vivos = e.predios.filter((p) => p.vivo);
  const preferidos = u.alvoTipo === "defesa" ? vivos.filter((p) => p.defesa && p.chave !== "castelo") : vivos;
  const lista = preferidos.length ? preferidos : vivos;
  let melhor = null, menor = Infinity;
  for (const p of lista) {
    const d = distancia(u.x, u.z, p.x, p.z) - p.raio;
    if (d < menor) { menor = d; melhor = p; }
  }
  // a muralha protege a Torre do Neuro de quem bate de perto, por terra
  if (melhor?.chave === "castelo" && e.muralha?.vivo && !u.voa && u.alcance < 2) return e.muralha;
  return melhor;
}

function ferir(e, alvo, dano, ev) {
  alvo.vida -= dano;
  if (alvo.vida > 0) return;
  alvo.vida = 0;
  if (alvo.id.startsWith("p-")) { alvo.vivo = false; ev.push({ tipo: "destruido", id: alvo.id }); }
  else { alvo.viva = false; ev.push({ tipo: "caiu", id: alvo.id }); }
}

/** A Curandeira: vai atrás de quem está ferido (ou do grupo) e cura todo mundo em volta. */
function agirCurandeira(e, u, ev) {
  let ferido = null, perto = null, menorF = Infinity, menorP = Infinity;
  for (const o of e.unidades) {
    if (!o.viva || o.lado !== u.lado || o === u || o.alvoTipo === "aliado") continue;
    const d = distancia(u.x, u.z, o.x, o.z);
    if (o.vida < o.vidaMax && d < menorF) { menorF = d; ferido = o; }
    if (d < menorP) { menorP = d; perto = o; }
  }
  const guia = ferido || perto;
  if (guia) {
    const d = distancia(u.x, u.z, guia.x, guia.z);
    const quer = ferido ? u.alcance * 0.6 : 1.5;
    if (d > quer) {
      const passo = Math.min(u.velocidade * DT, d - quer);
      u.x += ((guia.x - u.x) / d) * passo;
      u.z += ((guia.z - u.z) / d) * passo;
    }
  }
  if (u.recarga > 0) return;
  let curou = false;
  for (const o of e.unidades) {
    if (!o.viva || o.lado !== u.lado || o === u || o.vida >= o.vidaMax) continue;
    if (distancia(u.x, u.z, o.x, o.z) <= u.alcance) { o.vida = Math.min(o.vidaMax, o.vida + u.cura); curou = true; }
  }
  if (curou) { u.recarga = u.intervalo; ev.push({ tipo: "cura", de: u.id }); }
}

/** Dano em área: todo inimigo (que o atacante alcança) perto do ponto do golpe. */
function ferirEmArea(e, cx, cz, raio, dano, ladoAlvo, atirador, ev) {
  for (const o of e.unidades) {
    if (!o.viva || o.lado !== ladoAlvo || !alcancaUnidade(atirador, o)) continue;
    if (distancia(cx, cz, o.x, o.z) <= raio) ferir(e, o, dano, ev);
  }
}

function agirUnidade(e, u, ev) {
  u.recarga -= DT;
  if (u.alvoTipo === "aliado") return agirCurandeira(e, u, ev);
  let alvo = null;
  if (u.lado === "ataque") {
    // quem não é gigante encara a tropa de defesa que chegar perto
    if (u.alvoTipo !== "defesa" && u.alvoTipo !== "muralha") alvo = inimigoMaisPerto(e, u, "defesa", Math.max(u.alcance, 1.2) + 0.4);
    // o Bombardeiro só pensa na muralha (sem muralha, vira tropa comum)
    if (!alvo && u.alvoTipo === "muralha" && e.muralha?.vivo) alvo = e.muralha;
    if (!alvo) {
      const atual = u.alvo && (u.alvo.id === "p-muralha" ? e.muralha : e.predios.find((p) => p.id === u.alvo.id));
      alvo = atual?.vivo ? atual : escolherPredio(e, u);
      if (alvo?.chave === "castelo" && e.muralha?.vivo && !u.voa && u.alcance < 2) alvo = e.muralha;
    }
  } else {
    alvo = inimigoMaisPerto(e, u, "ataque", 99);
  }
  u.alvo = alvo ? { id: alvo.id } : null;
  if (!alvo) return;

  const ehUnidade = !alvo.id.startsWith("p-");
  const d = ehUnidade ? distancia(u.x, u.z, alvo.x, alvo.z) : distanciaAte(e, u, alvo);
  if (d > u.alcance) {
    const [tx, tz] = ehUnidade ? [alvo.x, alvo.z] : pontoDo(e, u, alvo);
    const total = distancia(u.x, u.z, tx, tz) || 1;
    const passo = Math.min(u.velocidade * DT, d - u.alcance + 0.02);
    u.x += ((tx - u.x) / total) * passo;
    u.z += ((tz - u.z) / total) * passo;
    return;
  }
  if (u.recarga > 0) return;
  u.recarga = u.intervalo;
  ev.push({ tipo: "golpe", de: u.id, para: alvo.id, arma: arma(u) });
  const dano = alvo.chave === "muralha" ? u.dano * u.contraMuralha : u.dano;
  if (ehUnidade && u.area) ferirEmArea(e, alvo.x, alvo.z, u.area, dano, alvo.lado, u, ev);
  else ferir(e, alvo, dano, ev);
  if (u.suicida) { u.viva = false; ev.push({ tipo: "caiu", id: u.id, explodiu: true }); }
}

function agirDefesa(e, p, ev) {
  p.recarga -= DT;
  if (p.recarga > 0) return;
  const atirador = { acertaAr: p.defesa.acertaAr, acertaChao: p.defesa.acertaChao };
  const minimo = p.defesa.minimo || 0;
  let alvo = null, menor = Infinity;
  for (const u of e.unidades) {
    if (!u.viva || u.lado !== "ataque" || !alcancaUnidade(atirador, u)) continue;
    const d = distancia(p.x, p.z, u.x, u.z);
    if (d <= p.defesa.alcance && d >= minimo && d < menor) { menor = d; alvo = u; }
  }
  if (!alvo) return;
  p.recarga = p.defesa.intervalo;
  ev.push({ tipo: "tiro", de: p.id, para: alvo.id, arma: p.defesa.arma });
  if (p.defesa.area) ferirEmArea(e, alvo.x, alvo.z, p.defesa.area, p.defesa.dano, "ataque", atirador, ev);
  else ferir(e, alvo, p.defesa.dano, ev);
}

/** Avança um passo (DT). Devolve o que aconteceu nele, para a tela desenhar. */
export function passo(e) {
  if (e.fim) return [];
  const ev = [];
  e.passos += 1;
  e.t = e.passos * DT;

  while (e.entradas.length && e.entradas[0].quando <= e.t) {
    const en = e.entradas.shift();
    const u = criarUnidade(e, en.tipo, "ataque", en.ponto[0] + (e.rand() - 0.5) * 0.5, en.ponto[1] + (e.rand() - 0.5) * 0.5);
    e.unidades.push(u);
    ev.push({ tipo: "entrou", id: u.id });
  }

  if (!e.guarnicaoSaiu && e.castelo && e.guarnicao.length) {
    const perto = e.unidades.some((u) => u.viva && u.lado === "ataque" && distancia(u.x, u.z, e.castelo.x, e.castelo.z) < 4.5);
    const ferida = e.castelo.vida < e.castelo.vidaMax || (e.muralha && e.muralha.vida < e.muralha.vidaMax);
    if (perto || ferida) {
      e.guarnicaoSaiu = true;
      e.guarnicao.forEach((tipo, i) => {
        const [dx, dz] = SAIDAS_DA_GUARNICAO[i % SAIDAS_DA_GUARNICAO.length];
        const u = criarUnidade(e, tipo, "defesa", e.castelo.x + dx, e.castelo.z + dz);
        e.unidades.push(u);
        ev.push({ tipo: "entrou", id: u.id });
      });
      ev.push({ tipo: "guarnicao" });
    }
  }

  for (const u of e.unidades) if (u.viva) agirUnidade(e, u, ev);
  for (const p of e.predios) if (p.vivo && p.defesa) agirDefesa(e, p, ev);

  const ataqueVivo = e.entradas.length > 0 || e.unidades.some((u) => u.viva && u.lado === "ataque" && u.alvoTipo !== "aliado");
  const prediosVivos = e.predios.some((p) => p.vivo);
  if (!ataqueVivo || !prediosVivos || e.t >= DURACAO_MAXIMA) { e.fim = true; ev.push({ tipo: "fim" }); }
  return ev;
}

/** Estrelas, destruição e perdas de uma batalha (terminada ou não). */
export function resultadoDo(e) {
  const destruidos = e.predios.filter((p) => !p.vivo);
  const destruicao = e.totalPredios ? Math.floor((destruidos.length * 100) / e.totalPredios) : 0;
  const casteloCaiu = Boolean(e.castelo && !e.castelo.vivo);
  const estrelas = (destruicao >= 50 ? 1 : 0) + (casteloCaiu ? 1 : 0) + (destruicao === 100 ? 1 : 0);
  const perdasDaGuarnicao = {};
  const sobreviventes = {};
  for (const u of e.unidades) {
    if (u.tipo === "heroi") continue;
    if (u.lado === "defesa" && !u.viva) perdasDaGuarnicao[u.tipo] = (perdasDaGuarnicao[u.tipo] || 0) + 1;
    if (u.lado === "ataque" && u.viva) sobreviventes[u.tipo] = (sobreviventes[u.tipo] || 0) + 1;
  }
  return {
    estrelas, destruicao, casteloCaiu, muralhaCaiu: Boolean(e.muralha && !e.muralha.vivo),
    destruidos: destruidos.map((p) => p.chave), duracao: Math.round(e.t * 10) / 10, perdasDaGuarnicao, sobreviventes,
  };
}

/** A batalha inteira, de uma vez (o servidor usa esta). */
export function resolverCombate(entrada) {
  const e = montarCombate(entrada);
  for (let i = 0; i < DURACAO_MAXIMA / DT + 5 && !e.fim; i++) passo(e);
  return resultadoDo(e);
}
