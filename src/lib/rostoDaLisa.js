// O rosto da Lisa (01/11/2026): "crie uma opção que essa malha seja um rosto 3D que interage
// enquanto a Lisa fala e escuta". A terceira versão segue a foto que a pessoa mandou: um retrato
// "térmico" — "não quero esses traços de rosto com beiços grandes e bochechas cheias, quero algo
// nessa estética da foto". Cabeça raspada, oval e esguia, orelhas destacadas, queixo fino, pescoço
// longo e ombros caídos; o rosto por dentro é preto (frio) e a cor mora na borda: vermelho escuro,
// laranja e creme na silhueta, com um halo fino que vai do branco-lilás ao ciano no fundo preto.
//
// O busto é uma função de distância (SDF) desenhada por raymarching no shader de pixel
// (src/components/panels/visuais/Rosto.js): elipsoides juntados com "mínimo suave", e o rosto quase
// sem traço — as órbitas, o nariz e a boca só sugeridos, para pegar um fio de luz de lado.
//
// Ajustes (01/11/2026, "aumentar a resolução, pôr a Lisa com cabelo feminino também, além de um
// modo de cores diferentes"): cabelo longo (o padrão) ou raspado, e a paleta — a térmica da foto ou
// outras cinco. Cada navegador guarda os seus (lerAjustesDoRosto / escolherAjustesDoRosto), e o
// rosto aberto troca na hora, deslizando.
//
// Aqui fica o que não precisa de navegador: o enquadramento, a forma (o GLSL, que o componente
// injeta), a resolução de desenho, as paletas, os ajustes e o MOVIMENTO — o que cada estado faz com
// o rosto. Testado por `npm run visuais-check`.

/** O busto cabe num círculo deste raio, centrado em CENTRO_Y (o visual inteiro, como a Esfera). */
export const RAIO = 1.5;
export const CENTRO_Y = -0.5;
/** A câmera: longe e um pouco acima do centro (perspectiva leve, como numa foto de retrato). */
export const CAMERA = { y: CENTRO_Y + 0.3, distancia: 7.5 };
/** A cabeça gira em volta deste ponto (no alto do pescoço); os ombros ficam. */
export const PIVO = { y: -0.95, z: -0.1 };
/** A caixa onde o busto (e o halo) cabem: raio que não a cruza nem é marchado. */
export const CAIXA = { min: [-1.85, -2.7, -1.15], max: [1.85, 1.22, 1.2] };

const n = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

/**
 * A forma em GLSL: `float forma(vec3 p, out float orelha, out float fio)` devolve a distância até o
 * busto e, em `orelha` e `fio`, a distância até as orelhas (o calor delas) e até o cabelo. Usa os
 * uniformes uCabeca (mundo → cabeça), uBoca (0–1, a mandíbula), uRespira (-1–1, os ombros), uCabelo
 * (0 raspado – 1 longo; no meio, o cabelo cresce ou some) e uTempo (o balanço das mechas).
 */
export const FORMA = `
  float elipsoide(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
  float uniao(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
  // a menos b, com a borda arredondada
  float tira(float a, float b, float k){ return -uniao(-a, b, k); }
  vec2 gira(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

  const vec3 PIVO = vec3(0.0, ${n(PIVO.y)}, ${n(PIVO.z)});

  // a cabeça, nas coordenadas dela (q): raspada, um oval alto (de frente, quase uma elipse que
  // afina no queixo), com o queixo à frente da garganta
  float cabeca(vec3 q, out float orelha){
    // o perfil: quanto mais baixo, mais para a frente (o queixo); e a mandíbula desce com a fala
    vec3 m = q;
    m.z -= 0.26 * smoothstep(-0.2, -1.0, q.y);
    m.y += uBoca * 0.085 * smoothstep(-0.66, -0.8, q.y) * smoothstep(-0.2, 0.25, m.z);
    vec3 r = m - vec3(0.0, 0.02, -0.05);
    float aperta = 1.0 + 0.3 * smoothstep(-0.55, -1.0, r.y);
    r.x *= aperta;
    float d = elipsoide(r, vec3(0.72, 1.02, 0.8)) / aperta;
    // a nuca, mais cheia
    d = uniao(d, elipsoide(q - vec3(0.0, 0.16, -0.24), vec3(0.62, 0.78, 0.7)), 0.2);
    // as orelhas: placas finas, de lado, abrindo para fora
    vec3 o = vec3(abs(q.x), q.y, q.z) - vec3(0.71, -0.23, -0.12);
    o.xz = gira(o.xz, -0.68);
    o.xy = gira(o.xy, 0.12);
    orelha = elipsoide(o, vec3(0.08, 0.32, 0.19));
    d = uniao(d, orelha, 0.06);
    // as órbitas: duas covas rasas (pegam um fio de luz na pálpebra de cima)
    vec3 e = vec3(abs(m.x), m.y, m.z) - vec3(0.24, -0.14, 0.72);
    d = tira(d, elipsoide(e, vec3(0.15, 0.08, 0.07)), 0.1);
    // o nariz: uma crista discreta (baixa: de lado, um nariz alto acendia um risco laranja no rosto)
    d = uniao(d, elipsoide(m - vec3(0.0, -0.4, 0.66), vec3(0.05, 0.15, 0.07)), 0.14);
    // a boca: lábios finos que mal aparecem e, falando, uma fenda que abre
    vec3 b = m - vec3(0.0, -0.69, 0.5);
    d = uniao(d, elipsoide(b, vec3(0.14, 0.035, 0.05)), 0.06);
    d = tira(d, elipsoide(b - vec3(0.0, -0.012 - uBoca * 0.03, 0.05), vec3(0.11, 0.002 + uBoca * 0.055, 0.1)), 0.02);
    return d;
  }

  // o corpo, parado: pescoço longo, trapézio caindo para os ombros e o alto do peito
  float corpo(vec3 p){
    p.y -= uRespira * 0.016;
    float d = elipsoide(p - vec3(0.0, -1.2, -0.2), vec3(0.4, 0.8, 0.36));
    // o tronco: quanto mais alto, mais estreito — os ombros descem em rampa desde o pescoço
    vec3 t = p - vec3(0.0, -2.3, -0.18);
    float estreita = 1.0 + 0.9 * smoothstep(-2.0, -1.45, p.y);
    t.x *= estreita;
    d = uniao(d, elipsoide(t, vec3(1.85, 0.85, 0.6)) / estreita, 0.3);
    return d;
  }

  // as mechas compridas acompanham a cabeça em cima e o corpo embaixo (onde pousam nos ombros)
  vec3 noCabelo(vec3 p, vec3 q){
    vec3 h = mix(p, q, smoothstep(-1.6, -0.4, p.y));
    // o balanço: as pontas mexem mais que a raiz
    h.x += sin(uTempo * 0.9 + h.y * 1.7) * 0.014 * smoothstep(0.0, -1.6, h.y);
    return h;
  }

  // o cabelo: longo, com a franja caindo de lado, preso atrás das orelhas (elas ficam de fora,
  // acendendo quando a Lisa escuta) e descendo por trás do pescoço até pousar nos ombros. Com
  // uCabelo < 1 ele encolhe para dentro do crânio e some (a troca de cabelo desliza em vez de pular).
  float cabelo(vec3 p, vec3 q){
    if (uCabelo < 0.01) return 9.0;
    vec3 h = noCabelo(p, q);
    // a calota: um pouco maior que o crânio
    float d = elipsoide(h - vec3(0.0, 0.13, -0.1), vec3(0.79, 1.0, 0.9));
    // abre o rosto com a linha do cabelo inclinada: a franja desce de um lado e cobre um canto da testa
    vec3 a = h - vec3(0.0, -0.45, 0.62);
    a.xy = gira(a.xy, 0.2);
    d = tira(d, elipsoide(a, vec3(0.62, 0.98, 0.72)), 0.1);
    // as orelhas ficam de fora: abaixo da têmpora e na frente da nuca, nada de cabelo
    d = tira(d, max(h.y - 0.02, -h.z - 0.3), 0.12);
    // as mechas: dos lados, atrás das orelhas e do pescoço, descendo até os ombros
    vec3 l = vec3(abs(h.x), h.y, h.z) - vec3(0.56, -0.95, -0.48);
    l.xy = gira(l.xy, -0.1);
    float mechas = elipsoide(l, vec3(0.34, 1.32, 0.32));
    // e o volume das costas, que junta as duas
    mechas = uniao(mechas, elipsoide(h - vec3(0.0, -0.7, -0.6), vec3(0.8, 1.2, 0.32)), 0.3);
    d = uniao(d, mechas, 0.2);
    return d + (1.0 - uCabelo) * 0.35;
  }

  float forma(vec3 p, out float orelha, out float fio){
    vec3 q = PIVO + uCabeca * (p - PIVO);
    fio = cabelo(p, q);
    return uniao(uniao(cabeca(q, orelha), fio, 0.04), corpo(p), 0.05);
  }
`;

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Quantos pixels de desenho por pixel CSS. O teto vale no lado MENOR da tela, que é o que dá o
 * tamanho do busto: numa tela larga (o Assistente em tela cheia, 1700 × 800) o resto é fundo, que a
 * caixa do busto pula sem marchar. Até 01/11/2026 o teto (560 px) valia no lado maior, e a tela
 * cheia saía a 1/3 da resolução — pixelada. Agora: a densidade da tela, até `limite` px no lado menor
 * (o componente usa 1100 no computador e 820 no celular, e baixa sozinho se os quadros ficarem lentos).
 */
export function resolucaoDoRosto(largura, altura, densidade = 1, limite = 1100) {
  const lado = Math.max(1, Math.min(largura, altura));
  return limitar(Math.min(densidade || 1, limite / lado), 0.35, 3);
}

// ---- as cores e o cabelo (cada navegador guarda os seus) ----

/** O cabelo do rosto. */
export const CABELOS_DO_ROSTO = [
  { id: "longo", nome: "Longo", descricao: "Cabelo comprido, com franja de lado e preso atrás das orelhas" },
  { id: "raspado", nome: "Raspado", descricao: "A cabeça raspada da foto de referência" },
];

/**
 * As paletas: `profundo` (onde o calor começa), `meio`, `borda` (a silhueta, quase branca), `halo`
 * (a luz por fora) e `haloPensando`. A térmica é a da foto; as outras foram pedidas como "um modo de
 * cores diferentes".
 */
export const PALETAS_DO_ROSTO = [
  { id: "termico", nome: "Térmico", profundo: "#6b1d0b", meio: "#e8692a", borda: "#ffecc8", halo: "#5cc6d6", haloPensando: "#86b4ff" },
  { id: "holograma", nome: "Holograma", profundo: "#0b2470", meio: "#2f86ff", borda: "#dcf4ff", halo: "#9a7dff", haloPensando: "#d08bff" },
  { id: "neon", nome: "Neon", profundo: "#4d0a4f", meio: "#ff3fa4", borda: "#ffe0f3", halo: "#46c8ff", haloPensando: "#9d8bff" },
  { id: "aurora", nome: "Aurora", profundo: "#06372f", meio: "#17c48e", borda: "#e2fff0", halo: "#b58cff", haloPensando: "#7fb6ff" },
  { id: "ouro", nome: "Ouro", profundo: "#4a2604", meio: "#e0a020", borda: "#fff4d4", halo: "#a8d8ff", haloPensando: "#c9b2ff" },
  { id: "prata", nome: "Prata", profundo: "#26282c", meio: "#8f949c", borda: "#ffffff", halo: "#c8d2e0", haloPensando: "#c6c2ff" },
];

export const AJUSTES_PADRAO = { cabelo: "longo", paleta: "termico" };
export const CHAVE_DO_ROSTO = "lisa-rosto";
export const EVENTO_DO_ROSTO = "lisa-rosto"; // avisa a própria aba quando o cabelo ou as cores mudam

/** Os ajustes conferidos: o que não existe volta ao padrão. */
export function ajustesValidos(bruto) {
  const a = bruto && typeof bruto === "object" ? bruto : {};
  return {
    cabelo: CABELOS_DO_ROSTO.some((c) => c.id === a.cabelo) ? a.cabelo : AJUSTES_PADRAO.cabelo,
    paleta: PALETAS_DO_ROSTO.some((c) => c.id === a.paleta) ? a.paleta : AJUSTES_PADRAO.paleta,
  };
}

/** Os ajustes guardados neste navegador. */
export function lerAjustesDoRosto() {
  try {
    return ajustesValidos(JSON.parse(localStorage.getItem(CHAVE_DO_ROSTO) || "null"));
  } catch {
    return { ...AJUSTES_PADRAO };
  }
}

/** Muda parte dos ajustes (`{ cabelo }` ou `{ paleta }`): guarda e avisa o rosto aberto nesta aba. */
export function escolherAjustesDoRosto(parcial) {
  const a = ajustesValidos({ ...lerAjustesDoRosto(), ...parcial });
  try { localStorage.setItem(CHAVE_DO_ROSTO, JSON.stringify(a)); } catch { /* vale só nesta tela */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_DO_ROSTO, { detail: a })); } catch { /* sem janela (testes) */ }
  return a;
}

/** As cores que o shader recebe num estado: [borda, meio, halo, profundo]. */
export function coresDoRosto(paletaId, estado) {
  const p = PALETAS_DO_ROSTO.find((x) => x.id === paletaId) || PALETAS_DO_ROSTO[0];
  return [p.borda, p.meio, estado === "pensando" ? p.haloPensando : p.halo, p.profundo];
}

/**
 * O movimento do rosto: devolve uma função ({ pesos, amp, t, dt, ponteiro, reduzido }) → o que o
 * shader recebe. Com memória (tudo desliza):
 *
 *   falando   a mandíbula abre com o volume da voz; a boca e a garganta esquentam no ritmo dela
 *   ouvindo   as orelhas esquentam e pulsam com o que chega; a cabeça inclina e acena de leve
 *   pensando  uma onda de calor sobe devagar pelo alto da cabeça; olha para cima, de lado
 *   pronta    respira (os ombros sobem e descem), balança devagar e segue o ponteiro do mouse
 *
 * `ponteiro` é { x, y, quando } (x e y de -1 a 1; `quando` em segundos, no relógio de `t`).
 */
export function criarMovimentoDoRosto() {
  const m = { boca: 0, calorBoca: 0, calorOrelha: 0, onda: 0, yaw: 0, pitch: 0, roll: 0 };
  const suave = (atual, meta, dt, rapidez) => atual + (meta - atual) * Math.min(1, dt * rapidez);
  return ({ pesos: p, amp, t, dt, ponteiro = null, reduzido = false }) => {
    const bocaMeta = p.falando * limitar((amp - 0.1) * 1.5, 0, 1);
    m.boca = suave(m.boca, bocaMeta, dt, bocaMeta > m.boca ? 22 : 12);
    m.calorBoca = suave(m.calorBoca, p.falando * (0.2 + amp * 0.9), dt, 12);
    m.calorOrelha = suave(m.calorOrelha, p.ouvindo * (0.35 + amp * 1.3), dt, 9);
    m.onda = suave(m.onda, p.pensando, dt, 2.5);

    const vivo = Boolean(ponteiro) && t - ponteiro.quando < 4;
    const segue = vivo ? p.pronta + p.ouvindo : 0;
    const px = vivo ? limitar(ponteiro.x, -1.5, 1.5) : 0;
    const py = vivo ? limitar(ponteiro.y, -1.5, 1.5) : 0;
    // (pitch positivo baixa o rosto; yaw positivo vira para a direita de quem olha)
    const yawMeta = Math.sin(t * 0.31) * 0.12 * (p.pronta + p.falando * 0.6) + p.pensando * (0.2 + Math.sin(t * 0.4) * 0.06)
      + segue * px * 0.3 + p.falando * Math.sin(t * 1.7) * amp * 0.06;
    const pitchMeta = Math.sin(t * 0.23) * 0.035 - p.pensando * 0.15 - segue * py * 0.16
      + p.falando * Math.sin(t * 3.1) * amp * 0.05 + p.ouvindo * (0.06 + Math.sin(t * 2.2) * 0.025);
    const rollMeta = p.ouvindo * 0.11 + Math.sin(t * 0.19) * 0.025 - p.pensando * 0.05;
    m.yaw = suave(m.yaw, yawMeta, dt, 3);
    m.pitch = suave(m.pitch, pitchMeta, dt, 4);
    m.roll = suave(m.roll, rollMeta, dt, 2.5);

    const calma = reduzido ? 0.35 : 1;
    return {
      boca: m.boca,
      calorBoca: m.calorBoca,
      calorOrelha: m.calorOrelha,
      onda: m.onda,
      respira: Math.sin(t * 1.15) * calma,
      yaw: m.yaw * calma,
      pitch: m.pitch * calma,
      roll: m.roll * calma,
    };
  };
}
