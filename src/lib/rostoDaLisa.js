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
// Aqui fica o que não precisa de navegador: o enquadramento, a forma (o GLSL, que o componente
// injeta), a resolução de desenho e o MOVIMENTO — o que cada estado faz com o rosto. Testado por
// `npm run visuais-check`.

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
 * A forma em GLSL: `float forma(vec3 p, out float orelha)` devolve a distância até o busto e, em
 * `orelha`, a distância até as orelhas (o calor delas). Usa os uniformes uCabeca (mundo → cabeça),
 * uBoca (0–1, a mandíbula) e uRespira (-1–1, os ombros).
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
    // o nariz: uma crista discreta
    d = uniao(d, elipsoide(m - vec3(0.0, -0.4, 0.68), vec3(0.055, 0.17, 0.085)), 0.14);
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

  float forma(vec3 p, out float orelha){
    vec3 q = PIVO + uCabeca * (p - PIVO);
    return uniao(cabeca(q, orelha), corpo(p), 0.05);
  }
`;

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Quantos pixels de desenho por pixel CSS. O raymarching custa por pixel, e o visual é macio e
 * granulado de propósito: desenhar em 3/4 da resolução (e nunca mais que `limite` pixels no lado
 * maior) não aparece, e a tela grande num celular de densidade 3 não vira 9× mais conta.
 */
export function resolucaoDoRosto(largura, altura, densidade = 1, limite = 560) {
  const lado = Math.max(1, largura, altura);
  return limitar(Math.min((densidade || 1) * 0.75, limite / lado), 0.2, 2);
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
