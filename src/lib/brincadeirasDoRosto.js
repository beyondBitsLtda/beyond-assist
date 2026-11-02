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

// vetores de 3 números
const somar = (a, b) => a.map((v, i) => v + b[i]);
const escalar = (a, k) => a.map((v) => v * k);
const produto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vetorial = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalizar = (a) => escalar(a, 1 / Math.hypot(...a));

/** Onde o punho (o meio dele) e o videogame ficam fora da tela (de onde sobem e para onde descem). */
export const FORA = { mao: [-1.05, -2.9, 1.0], jogo: [0, -2.9, 0.9] };
/**
 * O punho junto do vidro: ao lado do rosto, à esquerda de quem vê, um pouco abaixo dos olhos. A mão
 * tem o tamanho de uma mão de verdade perto da cabeça dela (02/11/2026: "a mão está pequena para o
 * tamanho do corpo e nada parecida com uma mão humana") — e, mais perto da câmera, parece maior.
 */
const PUNHO_NO_VIDRO = [-0.82, -0.26, 1.9];
/** Para onde os dedos apontam (do pulso para os nós): no vidro, para a câmera e um pouco para o
 *  rosto; subindo, para cima. */
const DEDOS_NO_VIDRO = normalizar([0.32, 0.12, 1]);
const DEDOS_SUBINDO = normalizar([0.05, 1, 0.3]);
/** O meio do punho fechado, no espaço da mão (o pulso na origem; ver maoFechada em COISAS). */
const MEIO_DO_PUNHO = [0, 0.6, -0.22];
const AVANCO_DA_BATIDA = 0.3;
const BATIDAS = [1.45, 1.8];
const JOGO_NAS_MAOS = [0, -1.02, 1.3];

/**
 * Os eixos da mão no mundo: o polegar, os dedos e as costas da mão. `giro` levanta o lado do
 * polegar (0 é a palma para baixo; o punho que bate fica meio de lado, como numa batida de verdade).
 */
export function eixosDaMao(dedos, giro) {
  const t0 = [Math.cos(giro), Math.sin(giro), 0];
  const polegar = normalizar(somar(t0, escalar(dedos, -produto(t0, dedos))));
  return [polegar, dedos, vetorial(dedos, polegar)];
}
/** Um ponto do espaço da mão, no mundo. */
const naMao = (eixos, origem, [x, y, z]) => somar(origem, somar(escalar(eixos[0], x), somar(escalar(eixos[1], y), escalar(eixos[2], z))));
/** Os pontos do busto onde se ancoram o balão (acima da cabeça, de lado) e as notas (a boca). */
export const ANCORAS = { cabeca: [0.5, 0.75, 0.2], boca: [0.12, -0.72, 0.66] };

const NOTAS_DO_JOGO = [[2.6, "pi"], [3.3, "★"], [4.0, "pi pi"], [5.1, "✦"], [5.9, "+1"], [6.7, "★"], [7.6, "pi"]];
const BATIDAS_DA_CANCAO = [0.5, 1.1, 1.7, 2.6, 3.2, 3.8, 4.7, 5.3, 5.9, 6.8, 7.4];
const SIMBOLOS = ["♪", "♫", "♩", "♬"];

const NEUTRA = () => ({
  cabeca: { yaw: 0, pitch: 0, roll: 0 },
  boca: 0, calorBoca: 0,
  mao: null, // { centro, eixos: [polegar, dedos, costas], pulso, cotovelo } do punho, no mundo
  jogo: null, // { pos: [x, y, z], giro, tela }
  batidas: [], // { idade, ponto }: a tela ondula no ponto (idade em s desde a batida)
  falas: [], // { texto, ponto, opacidade, desvio: [x, y] em px }
  notas: [], // { chave, simbolo, ponto, idade, vida, deriva: [x, y] em px, tamanho, opacidade }
});

function vidro(s, peso) {
  const p = NEUTRA();
  const k = entre(s, 0.15, 1.2) * (1 - entre(s, 5.6, 6.9)) * peso;
  // sobe com os dedos para cima e, chegando, vira os nós para o vidro
  const dedos = normalizar(misturar(DEDOS_SUBINDO, DEDOS_NO_VIDRO, entre(k, 0.35, 1)));
  const eixos = eixosDaMao(dedos, 0.45);
  // a batida: avança rápido até o vidro (na direção dos dedos) e volta mais devagar
  let avanco = 0;
  for (const b of BATIDAS) {
    const u = s - b;
    if (u > -0.12 && u < 0.24) avanco += u < 0 ? liso(1 + u / 0.12) : 1 - liso(u / 0.24);
  }
  const centro = somar(misturar(FORA.mao, PUNHO_NO_VIDRO, k), escalar(dedos, AVANCO_DA_BATIDA * avanco * peso));
  // o pulso sai do meio do punho de volta pelo espaço da mão; o antebraço desce dele para fora da tela
  const doPulso = naMao(eixos, centro, escalar(MEIO_DO_PUNHO, -1));
  p.mao = { centro, eixos, pulso: doPulso, cotovelo: [doPulso[0] - 0.15, -3.1, doPulso[2] - 0.6] };
  const contato = somar(PUNHO_NO_VIDRO, escalar(DEDOS_NO_VIDRO, AVANCO_DA_BATIDA + 0.4));
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
    { texto: "toc toc", ponto: PUNHO_NO_VIDRO, desvio: [0, -130], opacidade: janela(s, 1.45, 1.6, 2.9, 3.2) * peso },
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
  p.cabeca.pitch = (0.22 * janela(s, 0.6, 1.5, 10.0, 11.0) - 0.26 * festa) * peso;
  p.cabeca.yaw = 0.05 * Math.sin(s * 1.3) * joga * peso;
  p.cabeca.roll = (0.04 * Math.sin(s * 0.9) * joga + 0.06 * festa) * peso;
  const fala = 0.3 * (0.5 + 0.5 * Math.sin(s * 17)) * janela(s, 0.6, 0.7, 1.6, 1.8) + 0.4 * festa;
  p.boca = fala * peso;
  p.calorBoca = fala * 0.8 * peso;
  p.falas = [
    { texto: "uma partidinha…", ponto: ANCORAS.cabeca, desvio: [0, 0], opacidade: janela(s, 0.5, 0.7, 2.4, 2.8) * peso },
    { texto: "passei de fase!", ponto: ANCORAS.cabeca, desvio: [0, 0], opacidade: janela(s, 8.7, 8.9, 10.2, 10.6) * peso },
  ];
  const topo = [pos[0], pos[1] + 0.3, pos[2] + 0.18];
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
  if (pose?.mao) z = Math.max(z, pose.mao.centro[2] + 0.75);
  if (pose?.jogo) z = Math.max(z, pose.jogo.pos[2] + 0.5);
  return z;
}

// ---- o desenho das coisas (GLSL, injetado no shader do Rosto depois da FORMA) ----

/**
 * As mãos e o videogame, no tamanho de verdade para a cabeça dela (a cabeça tem 1,44 de largura; uma
 * palma, ~0,62; um dedo, ~0,17 de grossura).
 *
 * `float punho(vec3 p)`: a mão fechada que bate no vidro — a palma, o "gordinho" do polegar, os
 * quatro dedos com as três falanges dobradas até a palma (separados, para os sulcos aparecerem) e o
 * polegar cruzando na frente deles, como num punho de verdade — e o antebraço descendo para fora da
 * tela. A mão é desenhada no espaço dela (uMaoEixos leva do mundo para lá; o pulso em uPulso).
 *
 * `float aparelho(vec3 p, out float maos)`: o videogame deitado, visto por trás (a tela está virada
 * para ela) e, em `maos`, as duas mãos segurando as pontas: a palma em concha, três dedos abraçando
 * as costas (o lado que a câmera vê), o indicador no botão de cima, o polegar na frente.
 *
 * Longe da mão, só a esfera que a contém: o raio que passa longe — quase todos — não paga os dedos.
 */
export const COISAS = `
  // um cone de pontas redondas (uma falange, um antebraço): afina de a para b
  float cone(vec3 p, vec3 a, vec3 b, float ra, float rb){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(ra, rb, h); }
  float caixinha(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }

  // um dedo (no espaço da mão: o pulso na origem, os dedos para +y, as costas da mão para +z e o polegar
  // para +x): da junta da base b, com as três falanges c e as dobras a (na base, no meio e na ponta),
  // dobrando para o lado da palma
  float dedo(vec3 l, vec3 b, vec3 c, float r, vec3 a){
    float a2 = a.x + a.y;
    float a3 = a2 + a.z;
    vec3 j1 = b + c.x * vec3(0.0, cos(a.x), -sin(a.x));
    vec3 j2 = j1 + c.y * vec3(0.0, cos(a2), -sin(a2));
    vec3 j3 = j2 + c.z * vec3(0.0, cos(a3), -sin(a3));
    return min(min(cone(l, b, j1, r, r * 0.93), cone(l, j1, j2, r * 0.93, r * 0.86)), cone(l, j2, j3, r * 0.86, r * 0.78));
  }

  float maoFechada(vec3 l){
    float d = caixinha(l - vec3(0.0, 0.45, -0.02), vec3(0.31, 0.38, 0.1), 0.1);
    d = uniao(d, elipsoide(l - vec3(0.2, 0.3, -0.12), vec3(0.15, 0.24, 0.1)), 0.08);
    // indicador, médio, anelar e mínimo: 95° na base, 100° no meio e 60° na ponta
    vec3 a = vec3(1.66, 1.75, 1.05);
    float dd = dedo(l, vec3(0.25, 0.84, 0.0), vec3(0.4, 0.24, 0.18), 0.083, a);
    dd = min(dd, dedo(l, vec3(0.085, 0.88, 0.01), vec3(0.44, 0.27, 0.19), 0.087, a));
    dd = min(dd, dedo(l, vec3(-0.08, 0.86, 0.0), vec3(0.41, 0.25, 0.18), 0.081, a));
    dd = min(dd, dedo(l, vec3(-0.235, 0.8, -0.01), vec3(0.33, 0.2, 0.16), 0.07, a));
    d = uniao(d, dd, 0.05);
    // o polegar: da base, perto do pulso, até cruzar na frente do indicador e do médio
    float po = cone(l, vec3(0.24, 0.14, -0.08), vec3(0.38, 0.44, -0.3), 0.12, 0.1);
    po = min(po, cone(l, vec3(0.38, 0.44, -0.3), vec3(0.3, 0.7, -0.5), 0.1, 0.088));
    po = min(po, cone(l, vec3(0.3, 0.7, -0.5), vec3(0.05, 0.76, -0.54), 0.088, 0.078));
    d = uniao(d, po, 0.05);
    // o pulso
    return uniao(d, elipsoide(l - vec3(0.0, 0.0, -0.02), vec3(0.25, 0.16, 0.17)), 0.12);
  }

  float punho(vec3 p){
    if (uMao.w < 0.01) return 9.0;
    float braco = cone(p, uPulso, uCotovelo, 0.2, 0.3);
    vec3 l = uMaoEixos * (p - uPulso);
    float esfera = length(l - vec3(0.03, 0.5, -0.2)) - 0.78;
    return uniao(esfera > 0.12 ? esfera : maoFechada(l), braco, 0.1);
  }

  // o corpo do videogame: um retângulo de cantos bem redondos (1,1 × 0,58), fino
  float corpoDoJogo(vec3 l){
    vec2 q = abs(l.xy) - vec2(0.55, 0.29) + 0.15;
    float r = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.15;
    vec2 w = vec2(r, abs(l.z) - 0.05);
    return length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - 0.015;
  }

  // a mão na ponta direita do aparelho (a da esquerda é o espelho), no espaço dele: x ao longo da
  // largura, y para o alto, z para as costas (o lado da câmera)
  float maoNoJogo(vec3 m){
    float d = elipsoide(m - vec3(0.68, -0.05, 0.03), vec3(0.17, 0.3, 0.2));
    // médio, anelar e mínimo, abraçando as costas
    float dd = min(cone(m, vec3(0.74, 0.06, 0.15), vec3(0.54, 0.07, 0.14), 0.082, 0.078), cone(m, vec3(0.54, 0.07, 0.14), vec3(0.36, 0.06, 0.1), 0.078, 0.068));
    dd = min(dd, min(cone(m, vec3(0.74, -0.09, 0.15), vec3(0.55, -0.1, 0.14), 0.078, 0.074), cone(m, vec3(0.55, -0.1, 0.14), vec3(0.39, -0.1, 0.1), 0.074, 0.064)));
    dd = min(dd, min(cone(m, vec3(0.72, -0.22, 0.13), vec3(0.58, -0.24, 0.13), 0.068, 0.064), cone(m, vec3(0.58, -0.24, 0.13), vec3(0.46, -0.23, 0.1), 0.064, 0.056)));
    // o indicador, dobrado por cima da borda (no botão de cima)
    dd = min(dd, min(cone(m, vec3(0.74, 0.2, 0.12), vec3(0.6, 0.31, 0.07), 0.08, 0.076), cone(m, vec3(0.6, 0.31, 0.07), vec3(0.47, 0.34, -0.01), 0.076, 0.066)));
    d = uniao(d, dd, 0.05);
    // o polegar, na frente, nos botões
    float po = min(cone(m, vec3(0.74, -0.16, -0.06), vec3(0.6, -0.06, -0.12), 0.1, 0.088), cone(m, vec3(0.6, -0.06, -0.12), vec3(0.46, 0.0, -0.11), 0.088, 0.076));
    return uniao(d, po, 0.05);
  }

  float aparelho(vec3 p, out float maos){
    maos = 9.0;
    if (uJogo.w < 0.01) return 9.0;
    vec3 l = p - uJogo.xyz;
    l.yz = gira(l.yz, -uJogoGiro);
    vec3 m = vec3(abs(l.x), l.y, l.z);
    float esfera = length(m - vec3(0.62, 0.0, 0.03)) - 0.48;
    maos = esfera > 0.1 ? esfera : maoNoJogo(m);
    // os antebraços: do pulso, embaixo de cada ponta, descendo para fora da tela
    vec2 pulso = gira(vec2(-0.3, 0.02), uJogoGiro);
    vec3 w = vec3(abs(p.x - uJogo.x), p.y, p.z);
    vec3 a = vec3(0.74, uJogo.y + pulso.x, uJogo.z + pulso.y);
    maos = uniao(maos, cone(w, a, a + vec3(0.5, -2.4, -0.7), 0.19, 0.28), 0.1);
    return corpoDoJogo(l);
  }
`;
