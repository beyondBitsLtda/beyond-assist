// Percepção do Modo Interativo: olha o vídeo da câmera e devolve QUAL CARA a Lisa deve fazer em
// reação ao que ela vê — sua expressão facial, e o ambiente (luz, movimento, quantas pessoas).
//
// Roda 100% LOCAL no navegador, via @mediapipe/tasks-vision (mesmo WASM já vendorizado em
// public/mediapipe/ que o reconhecedor de gestos ✌️ usa). Isso é de propósito: a alternativa
// seria mandar um quadro pro Gemini de poucos em poucos segundos, o que (a) gastaria cota
// absurda, (b) ficaria refém do pool ficar disponível, e (c) mandaria imagem do seu ambiente
// pra fora sem parar. Aqui nenhum pixel sai da máquina.
//
// O modelo devolve "blendshapes": 52 coeficientes de 0 a 1 no padrão ARKit (mouthSmileLeft,
// jawOpen, browDownRight...). A leitura é por NOME, com fallback 0 se o nome não existir — se o
// Google renomear algo num modelo futuro, a reação só deixa de acontecer, nada quebra.

const MODEL_URL = "/mediapipe/face_landmarker.task";
const WASM_PATH = "/mediapipe/wasm";

// quanto tempo uma reação fica na cara dela antes de poder trocar — sem isso a expressão
// tremeria a cada frame (piscada normal viraria "sono", etc.)
const HOLD_MS = 1300;
// a reação só troca depois de ganhar em 2 leituras seguidas: filtra frame solto/ruído
const CONFIRM_READS = 2;

/** Regras de reação, em ordem de prioridade — a primeira que bater ganha. `b` é o mapa de
 * blendshapes (0..1) e `env` o que medimos do quadro. Os limiares saíram de teste na mão: alto
 * o bastante pra não disparar com cara neutra. */
const RULES = [
  // --- coisas muito específicas primeiro, senão viram "sorriso" ou "surpresa" genérico ---
  { face: "silly", when: (b) => b("tongueOut") > 0.3 },
  { face: "wink", when: (b) => Math.abs(b("eyeBlinkLeft") - b("eyeBlinkRight")) > 0.55 },
  { face: "kiss", when: (b) => b("mouthPucker") > 0.55 },
  { face: "puff", when: (b) => b("cheekPuff") > 0.4 },
  { face: "shocked", when: (b) => b("jawOpen") > 0.5 && (b("eyeWideLeft") + b("eyeWideRight")) / 2 > 0.35 },
  { face: "laugh", when: (b) => (b("mouthSmileLeft") + b("mouthSmileRight")) / 2 > 0.55 && b("jawOpen") > 0.25 },
  { face: "happy", when: (b) => (b("mouthSmileLeft") + b("mouthSmileRight")) / 2 > 0.35 },
  { face: "sad", when: (b) => (b("mouthFrownLeft") + b("mouthFrownRight")) / 2 > 0.3 },
  { face: "worried", when: (b) => b("browInnerUp") > 0.5 },
  { face: "grumpy", when: (b) => (b("browDownLeft") + b("browDownRight")) / 2 > 0.45 },
  { face: "suspicious", when: (b) => (b("eyeSquintLeft") + b("eyeSquintRight")) / 2 > 0.45 },
  { face: "surprised", when: (b) => (b("eyeWideLeft") + b("eyeWideRight")) / 2 > 0.4 },
  { face: "curious", when: (b) => (b("browOuterUpLeft") + b("browOuterUpRight")) / 2 > 0.4 },

  // --- ambiente: só quando o rosto não está dizendo nada de interessante ---
  { face: "surprised", when: (b, env) => env.faces > 1 }, // apareceu mais gente na frente dela
  { face: "alert", when: (b, env) => env.motion > 26 }, // muita coisa se movendo de repente
  { face: "sleepy", when: (b, env) => env.brightness < 42 }, // luz apagada/ambiente escuro
  { face: "sleeping", when: (b, env) => env.faces === 0 && env.motion < 3 }, // ninguém por aqui
  { face: "bored", when: (b, env) => env.faces === 0 },
];

/** Cria o perceptor. Falha "macia": se o modelo não carregar (arquivo faltando, WebGL
 * indisponível), devolve null e quem chama simplesmente segue sem reação facial. */
export async function createFacePerception() {
  let FaceLandmarker, FilesetResolver;
  try {
    ({ FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision"));
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    var landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2, // 2 é suficiente pra saber "apareceu mais gente" sem custar caro
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
  } catch {
    return null;
  }

  // canvas minúsculo só pra medir luz e movimento — 64x48 já basta e é barato de ler pixel
  const probe = document.createElement("canvas");
  probe.width = 64;
  probe.height = 48;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  let prevPixels = null;

  let held = null;
  let heldUntil = 0;
  let candidate = null;
  let candidateCount = 0;

  const measureEnv = (video) => {
    try {
      pctx.drawImage(video, 0, 0, probe.width, probe.height);
      const { data } = pctx.getImageData(0, 0, probe.width, probe.height);
      let sum = 0;
      let diff = 0;
      for (let i = 0; i < data.length; i += 4) {
        const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        sum += luma;
        if (prevPixels) diff += Math.abs(luma - prevPixels[i >> 2]);
      }
      const count = data.length / 4;
      const brightness = sum / count;
      const motion = prevPixels ? diff / count : 0;
      if (!prevPixels) prevPixels = new Float32Array(count);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        prevPixels[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }
      return { brightness, motion };
    } catch {
      return { brightness: 128, motion: 0 };
    }
  };

  return {
    /** Uma leitura. Devolve a cara que ela deve fazer (string) ou null pra "nada de especial,
     * pode continuar fazendo as graças dela". */
    read(video) {
      if (!video || !video.videoWidth) return null;
      const now = performance.now();

      let blend = new Map();
      let faces = 0;
      try {
        const res = landmarker.detectForVideo(video, now);
        faces = res?.faceLandmarks?.length || 0;
        for (const c of res?.faceBlendshapes?.[0]?.categories || []) blend.set(c.categoryName, c.score);
      } catch {
        // um frame ruim não pode derrubar o modo — ignora e tenta no próximo
      }
      const b = (name) => blend.get(name) || 0;
      const env = { ...measureEnv(video), faces };

      // ainda no tempo mínimo da reação atual: mantém, pra cara não tremer
      if (held && now < heldUntil) return held;

      const hit = RULES.find((r) => {
        try {
          return r.when(b, env);
        } catch {
          return false;
        }
      });
      const next = hit?.face || null;

      if (next !== candidate) {
        candidate = next;
        candidateCount = 1;
      } else {
        candidateCount++;
      }
      if (candidateCount < CONFIRM_READS) return held;

      held = next;
      heldUntil = next ? now + HOLD_MS : 0;
      return held;
    },
    close() {
      try {
        landmarker.close();
      } catch {
        /* já fechado */
      }
    },
  };
}
