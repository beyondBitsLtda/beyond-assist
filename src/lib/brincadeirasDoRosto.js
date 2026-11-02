// As brincadeiras do Rosto (02/11/2026): "deixe a Lisa com animações quando ela estiver parada na
// tela no modo rosto, sem nenhuma interação do usuário, tipo: ela bater no vidro e falar toc toc,
// ela pegar um gameboy e jogar, ela cantarolar algo".
//
//   vidro      o punho sobe, bate duas vezes na tela por dentro (a tela ondula onde bate), "toc
//              toc", e ela inclina a cabeça: "tem alguém aí?"
//   jogo       ela pega um videogame de mão, olha para baixo e joga — a tela dele, virada para ela,
//              ilumina o rosto de baixo e pisca; no fim, "passei de fase!"
//   cantarola  a cabeça balança no ritmo, a garganta esquenta a cada nota e as notas sobem da boca
//
// Só no estado "pronta" e só depois de um tempo sem ninguém mexer (TEMPOS). Qualquer gesto — mouse,
// tecla, toque, rolagem — ou a Lisa sair de "pronta" encerra a brincadeira devagar (o punho desce, o
// videogame sai) e o relógio recomeça. Sem som: a Lisa fica num escritório, e uma batida no vidro
// que faz barulho sozinha assusta.
//
// Aqui fica o que não precisa de navegador: o relógio da ociosidade, o roteiro de cada brincadeira
// (a pose a cada instante) e a projeção de um ponto do busto para a tela (onde vão o balão e as
// notas). O desenho é do Rosto (src/components/panels/visuais/Rosto.js), que injeta COISAS no
// shader. Testado por `npm run visuais-check`.

import { CAMERA, CENTRO_Y, CAIXA } from "./rostoDaLisa.js";

/** As brincadeiras, com a duração de cada uma (em segundos). */
export const BRINCADEIRAS = [
  { id: "vidro", nome: "Bate no vidro", duracao: 7.2 },
  { id: "jogo", nome: "Videogame", duracao: 12 },
  { id: "cantarola", nome: "Cantarola", duracao: 9.5 },
];

/** Quanto tempo sem gesto até a primeira, o intervalo entre as seguintes e quanto dura a saída. */
export const TEMPOS = { primeira: 30, entre: [45, 90], saida: 0.7 };

/** Pede uma brincadeira na hora (o painel /visual usa, para mostrar cada uma sem esperar). */
export const EVENTO_DA_BRINCADEIRA = "lisa-brincadeira";
export function pedirBrincadeira(id) {
  try { window.dispatchEvent(new CustomEvent(EVENTO_DA_BRINCADEIRA, { detail: id })); } catch { /* sem janela */ }
}

const duracaoDe = (id) => BRINCADEIRAS.find((b) => b.id === id)?.duracao ?? 0;

/**
 * O relógio da ociosidade. `gesto(t)` a cada interação; `passo(t, estado)` a cada quadro devolve a
 * brincadeira em curso — { id, s (segundos desde o começo), peso (1 inteira; cai até 0 na saída) } —
 * ou null. `pedir(id, t)` começa uma na hora. `acaso` (0–1) escolhe a próxima; nunca repete a última.
 */
export function criarOcio({ acaso = Math.random } = {}) {
  let proxima = null;
  let atual = null; // { id, inicio, saindo, pedida }
  let ultima = null;

  const adiar = (t, espera) => { proxima = t + espera; };
  const sair = (t) => { if (atual && atual.saindo == null) atual.saindo = t; };

  return {
    /** `fraco` (o mouse andando) não encerra a brincadeira que foi pedida: quem clicou para ver ainda
     *  está com o mouse na tela. Clique, tecla, toque e rolagem encerram qualquer uma. */
    gesto(t, { fraco = false } = {}) {
      if (!(fraco && atual?.pedida)) sair(t);
      adiar(t, TEMPOS.primeira);
    },
    pedir(id, t) {
      if (!duracaoDe(id)) return;
      atual = { id, inicio: t, saindo: null, pedida: true };
      ultima = id;
    },
    passo(t, estado = "pronta") {
      if (proxima == null) adiar(t, TEMPOS.primeira);
      // ouvindo, pensando ou falando: a conversa manda, e a brincadeira sai
      if (estado !== "pronta") { sair(t); adiar(t, TEMPOS.primeira); }

      if (atual) {
        const s = t - atual.inicio;
        let peso = 1;
        if (atual.saindo != null) peso = 1 - (t - atual.saindo) / TEMPOS.saida;
        if (peso <= 0 || s >= duracaoDe(atual.id)) {
          const acabou = peso > 0; // terminou inteira (e não interrompida): a próxima vem no intervalo
          atual = null;
          if (acabou) adiar(t, TEMPOS.entre[0] + acaso() * (TEMPOS.entre[1] - TEMPOS.entre[0]));
          return null;
        }
        return { id: atual.id, s, peso: Math.max(0, Math.min(1, peso)) };
      }

      if (t >= proxima) {
        const opcoes = BRINCADEIRAS.filter((b) => b.id !== ultima);
        const id = opcoes[Math.min(opcoes.length - 1, Math.floor(acaso() * opcoes.length))].id;
        atual = { id, inicio: t, saindo: null };
        ultima = id;
        return { id, s: 0, peso: 1 };
      }
      return null;
    },
  };
}

// ---- o roteiro ----

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const liso = (x) => { const u = limitar(x, 0, 1); return u * u * (3 - 2 * u); };
/** 0 antes de a, 1 depois de b, liso no meio. */
const entre = (s, a, b) => liso((s - a) / (b - a));
/** Sobe de a a b, fica, desce de c a d. */
const janela = (s, a, b, c, d) => entre(s, a, b) * (1 - entre(s, c, d));
const misturar = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
/** Um pulso de 0 a 1 e de volta, centrado em c, com meia largura w. */
const pulso = (s, c, w) => { const u = Math.abs(s - c) / w; return u >= 1 ? 0 : liso(1 - u); };

/** Onde o punho e o videogame ficam fora da tela (de onde sobem e para onde descem). */
export const FORA = { mao: [-0.8, -2.75, 1.0], jogo: [0, -2.75, 0.9] };
/** O punho junto do vidro (ao lado do rosto, na altura dos olhos) e o videogame nas mãos. */
const MAO_NO_VIDRO = [-0.6, -0.1, 2.72];
const AVANCO_DA_BATIDA = 0.3;
const BATIDAS = [1.45, 1.8];
const JOGO_NAS_MAOS = [0, -0.93, 1.12];
/** Os pontos do busto onde se ancoram o balão (acima da cabeça, de lado) e as notas (a boca). */
export const ANCORAS = { cabeca: [0.5, 0.75, 0.2], boca: [0.12, -0.72, 0.66] };

const NOTAS_DO_JOGO = [[2.6, "pi"], [3.3, "★"], [4.0, "pi pi"], [5.1, "✦"], [5.9, "+1"], [6.7, "★"], [7.6, "pi"]];
const BATIDAS_DA_CANCAO = [0.5, 1.1, 1.7, 2.6, 3.2, 3.8, 4.7, 5.3, 5.9, 6.8, 7.4];
const SIMBOLOS = ["♪", "♫", "♩", "♬"];

const NEUTRA = () => ({
  cabeca: { yaw: 0, pitch: 0, roll: 0 },
  boca: 0, calorBoca: 0,
  mao: null, // [x, y, z] do punho
  jogo: null, // { pos: [x, y, z], giro, tela }
  batidas: [], // { idade, ponto }: a tela ondula no ponto (idade em s desde a batida)
  falas: [], // { texto, ponto, opacidade, desvio: [x, y] em px }
  notas: [], // { chave, simbolo, ponto, idade, vida, deriva: [x, y] em px, tamanho, opacidade }
});

function vidro(s, peso) {
  const p = NEUTRA();
  const k = entre(s, 0.15, 1.2) * (1 - entre(s, 5.6, 6.9));
  const mao = misturar(FORA.mao, MAO_NO_VIDRO, k * peso);
  // a batida: avança rápido até o vidro e volta mais devagar
  for (const b of BATIDAS) {
    const u = s - b;
    if (u > -0.12 && u < 0.24) mao[2] += AVANCO_DA_BATIDA * (u < 0 ? liso(1 + u / 0.12) : 1 - liso(u / 0.24)) * peso;
  }
  p.mao = mao;
  const contato = [MAO_NO_VIDRO[0], MAO_NO_VIDRO[1] + 0.02, MAO_NO_VIDRO[2] + AVANCO_DA_BATIDA + 0.12];
  p.batidas = BATIDAS.map((b) => ({ idade: s - b, ponto: contato }));
  // olha para a mão (que está à esquerda de quem vê), depois para quem está do outro lado
  p.cabeca.yaw = -0.13 * janela(s, 0.3, 1.0, 2.3, 2.9) * peso;
  p.cabeca.pitch = 0.05 * janela(s, 1.0, 1.4, 2.6, 3.2) * peso;
  p.cabeca.roll = 0.14 * janela(s, 3.0, 3.6, 5.2, 6.0) * peso;
  // "toc, toc" junto com as batidas; depois "tem alguém aí?"
  const fala = 0.5 * (pulso(s, 1.5, 0.16) + pulso(s, 1.85, 0.16))
    + 0.32 * (0.5 + 0.5 * Math.sin(s * 19)) * janela(s, 3.2, 3.3, 4.2, 4.4);
  p.boca = fala * peso;
  p.calorBoca = fala * 0.8 * peso;
  p.falas = [
    { texto: "toc toc", ponto: MAO_NO_VIDRO, desvio: [0, -78], opacidade: janela(s, 1.45, 1.6, 2.9, 3.2) * peso },
    { texto: "tem alguém aí?", ponto: ANCORAS.cabeca, desvio: [0, 0], opacidade: janela(s, 3.1, 3.3, 5.3, 5.7) * peso },
  ];
  return p;
}

function jogo(s, peso) {
  const p = NEUTRA();
  const k = entre(s, 0.2, 1.4) * (1 - entre(s, 10.4, 11.6));
  const joga = janela(s, 1.3, 1.8, 10.0, 10.5);
  const festa = janela(s, 8.6, 8.85, 9.25, 9.7);
  const pos = misturar(FORA.jogo, JOGO_NAS_MAOS, k * peso);
  // os polegares trabalham: o aparelho treme um pouco; na vitória, sobe
  pos[0] += (0.014 * Math.sin(s * 7.3) + 0.006 * Math.sin(s * 17.1)) * joga * peso;
  pos[1] += (0.008 * Math.sin(s * 11.3) + 0.09 * festa) * peso;
  // a tela pisca como um jogo: a cada ~0,12 s um brilho diferente
  const quadro = Math.floor(s * 8);
  const acaso = (Math.sin(quadro * 12.9898) * 43758.5453) % 1;
  const tela = joga * (0.72 + 0.28 * Math.abs(acaso)) * (1 + 0.4 * festa) * peso;
  p.jogo = { pos, giro: 0.95 - 0.35 * k + 0.04 * Math.sin(s * 1.7) * joga, tela };
  // olha para baixo, para o jogo; na vitória, levanta o rosto para quem está do outro lado
  p.cabeca.pitch = (0.3 * janela(s, 0.6, 1.5, 10.0, 11.0) - 0.32 * festa) * peso;
  p.cabeca.yaw = 0.05 * Math.sin(s * 1.3) * joga * peso;
  p.cabeca.roll = (0.04 * Math.sin(s * 0.9) * joga + 0.06 * festa) * peso;
  const fala = 0.3 * (0.5 + 0.5 * Math.sin(s * 17)) * janela(s, 0.6, 0.7, 1.6, 1.8) + 0.4 * festa;
  p.boca = fala * peso;
  p.calorBoca = fala * 0.8 * peso;
  p.falas = [
    { texto: "uma partidinha…", ponto: ANCORAS.cabeca, desvio: [0, 0], opacidade: janela(s, 0.5, 0.7, 2.4, 2.8) * peso },
    { texto: "passei de fase!", ponto: ANCORAS.cabeca, desvio: [0, 0], opacidade: janela(s, 8.7, 8.9, 10.2, 10.6) * peso },
  ];
  const topo = [pos[0], pos[1] + 0.36, pos[2] + 0.12];
  p.notas = NOTAS_DO_JOGO
    .map(([quando, simbolo], i) => ({ chave: `j${i}`, simbolo, ponto: topo, idade: s - quando, vida: 1.3, deriva: [(i % 2 ? 1 : -1) * (18 + i * 4), -70], tamanho: simbolo.length > 1 ? 15 : 20, opacidade: peso }))
    .filter((n) => n.idade >= 0 && n.idade < n.vida);
  return p;
}

function cantarola(s, peso) {
  const p = NEUTRA();
  const e = janela(s, 0.2, 1.0, 8.4, 9.4) * peso;
  // a batida mais recente (a nota que está saindo) aquece a garganta e abre um fio de boca
  const nota = BATIDAS_DA_CANCAO.reduce((acc, b) => Math.max(acc, s >= b ? Math.exp(-(s - b) * 4.5) : 0), 0);
  p.cabeca.roll = 0.11 * Math.sin((2 * Math.PI * s) / 1.2) * e;
  p.cabeca.yaw = 0.06 * Math.sin((2 * Math.PI * s) / 2.4 + 0.5) * e;
  p.cabeca.pitch = -0.07 * e;
  p.boca = (0.05 + 0.1 * nota) * e;
  p.calorBoca = (0.25 + 0.5 * nota) * e;
  p.falas = [{ texto: "hm-hm-hmm ♪", ponto: ANCORAS.cabeca, desvio: [0, 0], opacidade: janela(s, 0.6, 0.8, 2.6, 3.0) * peso }];
  p.notas = BATIDAS_DA_CANCAO
    .map((quando, i) => ({ chave: `c${i}`, simbolo: SIMBOLOS[i % SIMBOLOS.length], ponto: ANCORAS.boca, idade: s - quando, vida: 2.1, deriva: [80 + (i % 3) * 22, -110 - (i % 2) * 30], tamanho: 20 + (i % 3) * 4, opacidade: peso }))
    .filter((n) => n.idade >= 0 && n.idade < n.vida);
  return p;
}

const ROTEIROS = { vidro, jogo, cantarola };

/**
 * A pose da brincadeira `id` aos `s` segundos, com `peso` (0–1: na saída, tudo volta ao lugar e some).
 * Fora do tempo da brincadeira, o punho e o videogame estão fora da tela.
 */
export function poseDaBrincadeira(id, s, peso = 1) {
  const roteiro = ROTEIROS[id];
  if (!roteiro) return NEUTRA();
  return roteiro(limitar(s, 0, duracaoDe(id)), limitar(peso, 0, 1));
}

// ---- da cena para a tela ----

/**
 * Onde um ponto do busto aparece, nas coordenadas do shader (uv: o centro do visual é 0, e 1 é meio
 * lado menor × ocupação). `quadro` é { raio, centroY } (enquadramentoDoRosto). A câmera é a do shader:
 * em (0, centroY + CAMERA.y − CENTRO_Y, CAMERA.distancia), mirando o plano z = 0.
 */
export function uvDoPonto([x, y, z], { raio, centroY }) {
  const camY = centroY + (CAMERA.y - CENTRO_Y);
  const s = CAMERA.distancia / Math.max(0.05, CAMERA.distancia - z);
  return [(x * s) / raio, (camY + s * (y - camY) - centroY) / raio];
}

/** O mesmo ponto em pixels de CSS dentro do visual (largura × altura, com a `ocupacao` dele). */
export function naTela(ponto, quadro, largura, altura, ocupacao) {
  const [u, v] = uvDoPonto(ponto, quadro);
  const escala = 0.5 * Math.min(largura, altura) * ocupacao;
  return [largura / 2 + u * escala, altura / 2 - v * escala];
}

/** Até onde a caixa marchada vai na direção da câmera: o busto sozinho cabe na CAIXA; o punho no vidro, não. */
export function frenteDaCaixa(pose) {
  let z = CAIXA.max[2];
  if (pose?.mao) z = Math.max(z, pose.mao[2] + 0.3);
  if (pose?.jogo) z = Math.max(z, pose.jogo.pos[2] + 0.45);
  return z;
}

// ---- o desenho das coisas (GLSL, injetado no shader do Rosto depois da FORMA) ----

/**
 * `float punho(vec3 p)`: o punho que bate no vidro, com os nós dos dedos virados para a câmera e o
 * antebraço descendo para fora da tela. `float aparelho(vec3 p, out float maos)`: o videogame de mão
 * (visto por trás: a tela está virada para ela) e, em `maos`, as duas mãos nos cantos de baixo com os
 * antebraços. Usam uMao (xyz e presença), uJogo (xyz e presença) e uJogoGiro (a inclinação).
 */
export const COISAS = `
  float caixinha(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }

  // um cone de pontas redondas: o antebraço, fino no pulso e grosso no cotovelo
  float cone(vec3 p, vec3 a, vec3 b, float ra, float rb){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h); }

  float punho(vec3 p){
    if (uMao.w < 0.01) return 9.0;
    vec3 l = p - uMao.xyz;
    // a mão fechada e, na frente, os quatro nós e os dedos dobrados (com os sulcos entre eles). Longe
    // da mão, os dedos nem são calculados: a distância desconta o quanto eles saem dela (0,06), e o
    // raio que passa longe — quase todos — não paga o laço
    float d = elipsoide(l - vec3(0.0, 0.0, -0.02), vec3(0.15, 0.13, 0.12));
    if (d > 0.1) d -= 0.06;
    else {
      for (int i = 0; i < 4; i++) {
        float x = -0.078 + 0.052 * float(i);
        d = uniao(d, elipsoide(l - vec3(x, 0.05 - abs(x) * 0.3, 0.09), vec3(0.03, 0.032, 0.034)), 0.02);
        d = uniao(d, elipsoide(l - vec3(x, -0.025 - abs(x) * 0.2, 0.105), vec3(0.027, 0.05, 0.03)), 0.015);
      }
      // o polegar, dobrado por cima dos dedos, do lado do rosto
      d = uniao(d, elipsoide(l - vec3(0.06, -0.075, 0.1), vec3(0.075, 0.03, 0.035)), 0.025);
    }
    return uniao(d, cone(p, uMao.xyz + vec3(0.0, -0.06, -0.09), uMao.xyz + vec3(-0.14, -2.3, -1.9), 0.075, 0.14), 0.06);
  }

  float aparelho(vec3 p, out float maos){
    maos = 9.0;
    if (uJogo.w < 0.01) return 9.0;
    vec3 l = p - uJogo.xyz;
    l.yz = gira(l.yz, -uJogoGiro);
    float d = caixinha(l, vec3(0.2, 0.3, 0.04), 0.05);
    vec3 m = vec3(abs(l.x), l.y, l.z) - vec3(0.2, -0.16, -0.01);
    maos = elipsoide(m, vec3(0.08, 0.14, 0.09));
    vec2 pulso = gira(vec2(-0.29, 0.0), uJogoGiro);
    vec3 w = vec3(abs(p.x - uJogo.x), p.y, p.z);
    vec3 a = vec3(0.22, uJogo.y + pulso.x, uJogo.z + pulso.y);
    maos = uniao(maos, cone(w, a, a + vec3(0.45, -2.1, -0.6), 0.065, 0.13), 0.06);
    return d;
  }
`;
