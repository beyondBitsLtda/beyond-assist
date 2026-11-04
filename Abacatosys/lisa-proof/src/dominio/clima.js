// O clima do Reino (03/11/2026: "um sistema dinâmico de chuva, neve, vento; o reino anoitece"). Puro e
// igual para todo mundo: a luz segue a hora de Brasília (amanhece, entardece, anoitece), e o tempo é
// sorteado por blocos de 3 horas a partir do dia — muda ao longo do dia, e duas pessoas olhando o Reino
// na mesma hora veem o mesmo céu. O mundo 3D (src/componentes/reino/Mundo3D.js) desenha; aqui se decide.
// Testado em scripts/dominio-check.mjs.

import { sorteio } from "./bolsa.js";
import { sementeDe } from "./modoDominio.js";

export const TEMPOS = {
  limpo: { nome: "Céu limpo", emoji: "☀️", nuvens: 0.15, chuva: 0, neve: 0 },
  nublado: { nome: "Nublado", emoji: "☁️", nuvens: 0.75, chuva: 0, neve: 0 },
  garoa: { nome: "Garoa", emoji: "🌦️", nuvens: 0.7, chuva: 0.35, neve: 0 },
  chuva: { nome: "Chuva", emoji: "🌧️", nuvens: 0.9, chuva: 0.75, neve: 0 },
  tempestade: { nome: "Tempestade", emoji: "⛈️", nuvens: 1, chuva: 1, neve: 0, raios: true },
  neve: { nome: "Neve", emoji: "🌨️", nuvens: 0.85, chuva: 0, neve: 0.8 },
};

const relogioDeBrasilia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", minute: "numeric", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric" });

/** A hora de Brasília (fracionária, 0–24), o dia ("AAAA-MM-DD") e o mês (1–12). */
export function agoraEmBrasilia(agora = new Date()) {
  const p = Object.fromEntries(relogioDeBrasilia.formatToParts(agora).map((x) => [x.type, x.value]));
  const dia = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { hora: Number(p.hour) + Number(p.minute) / 60, dia, mes: Number(p.month) };
}

const entre = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const suave = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/**
 * A luz da hora: `sol` de 0 (noite) a 1 (meio-dia), com o amanhecer das 5h30 às 7h e o entardecer das
 * 17h30 às 19h; `periodo` para o texto; `altura` do sol (0 no horizonte, 1 no alto) e `lado` (−1 nascente,
 * +1 poente) para a sombra andar; `quente` (0–1) é o dourado/rosado do nascer e do pôr do sol.
 */
export function luzDaHora(hora) {
  const h = ((Number(hora) % 24) + 24) % 24;
  const nascer = suave((h - 5.5) / 1.5);
  const por = 1 - suave((h - 17.5) / 1.5);
  const sol = Math.min(nascer, por);
  const periodo = h < 5.5 ? "madrugada" : h < 7 ? "amanhecer" : h < 17.5 ? "dia" : h < 19 ? "entardecer" : "noite";
  const quente = periodo === "amanhecer" || periodo === "entardecer" ? Math.sin(Math.PI * (periodo === "amanhecer" ? nascer : por)) : 0;
  const dia = Math.max(0, Math.min(1, (h - 6) / 12));
  return { hora: h, periodo, sol, quente, altura: Math.sin(Math.PI * dia), lado: entre(-1, 1, dia) };
}

/**
 * O tempo do bloco de 3 horas: o mesmo para todos. A neve é mais comum de maio a agosto (o inverno daqui),
 * rara no resto do ano. O vento tem força (0–1) e direção (radianos), e a intensidade varia um pouco.
 */
export function tempoDoBloco(dia, hora, mes) {
  const bloco = Math.floor((((Number(hora) % 24) + 24) % 24) / 3);
  const s = sorteio(sementeDe(`clima:${dia}:${bloco}`));
  const inverno = mes >= 5 && mes <= 8;
  const chances = [
    ["limpo", 0.38], ["nublado", 0.24], ["garoa", 0.12], ["chuva", 0.11], ["tempestade", 0.05], ["neve", inverno ? 0.1 : 0.03],
  ];
  const total = chances.reduce((t, [, c]) => t + c, 0);
  let r = s() * total;
  let tempo = "limpo";
  for (const [id, c] of chances) { if (r < c) { tempo = id; break; } r -= c; }
  const base = { limpo: 0.15, nublado: 0.3, garoa: 0.35, chuva: 0.5, tempestade: 0.85, neve: 0.3 }[tempo];
  const forca = Math.round(Math.max(0, Math.min(1, base + (s() - 0.5) * 0.4)) * 100) / 100;
  const direcao = Math.round(s() * Math.PI * 2 * 100) / 100;
  return { tempo, vento: { forca, direcao }, intensidade: Math.round((0.75 + s() * 0.25) * 100) / 100 };
}

/**
 * O clima de agora: a luz da hora e o tempo do bloco, mais o que o desenho precisa (nuvens, chuva, neve).
 * `forcar` ({ tempo, hora }) fixa o tempo e/ou a hora — só para ver um céu de propósito (?ceu=neve&hora=20).
 */
export function climaDoReino(agora = new Date(), forcar = {}) {
  const brasilia = agoraEmBrasilia(agora);
  const { dia, mes } = brasilia;
  const hora = Number.isFinite(forcar.hora) ? forcar.hora : brasilia.hora;
  const luz = luzDaHora(hora);
  const t = tempoDoBloco(dia, hora, mes);
  if (TEMPOS[forcar.tempo]) t.tempo = forcar.tempo;
  const def = TEMPOS[t.tempo];
  return {
    ...t, luz, dia,
    nuvens: def.nuvens, chuva: def.chuva * t.intensidade, neve: def.neve * t.intensidade, raios: Boolean(def.raios),
    // o céu fechado escurece o dia: até 40% menos sol na tempestade
    escurece: Math.round(def.nuvens * 0.4 * 100) / 100,
  };
}

const NOME_DO_VENTO = (f) => (f >= 0.75 ? "ventania" : f >= 0.5 ? "vento forte" : f >= 0.25 ? "brisa" : "sem vento");
const NOME_DO_PERIODO = { madrugada: "madrugada", amanhecer: "amanhecendo", dia: "dia", entardecer: "entardecendo", noite: "noite" };

/** "🌧️ Chuva · vento forte · noite" — o selo no canto do Reino. */
export function textoDoClima(c) {
  const def = TEMPOS[c.tempo] || TEMPOS.limpo;
  const emoji = c.tempo === "limpo" && (c.luz.periodo === "noite" || c.luz.periodo === "madrugada") ? "🌙" : def.emoji;
  return `${emoji} ${def.nome === "Céu limpo" && emoji === "🌙" ? "Noite limpa" : def.nome} · ${NOME_DO_VENTO(c.vento.forca)} · ${NOME_DO_PERIODO[c.luz.periodo]}`;
}
