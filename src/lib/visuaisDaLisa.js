// Os visuais da Lisa — o que fica no centro do Assistente e reage à voz (pedido de 24/10/2026:
// "faça uns modos gráficos para o assistente baseados nesses visuais, e um painel com a
// visualização do tema"). Cada visual é um componente WebGL em src/components/panels/visuais/,
// todos com o mesmo contrato da Esfera de pontos (EsferaDaVoz.js): a cada quadro recebem
// { estado, nivel } e desenham.
//
// Aqui fica o que não precisa de navegador: o catálogo, as cores de cada estado e o "envelope"
// da voz (o quanto o visual se mexe agora). Testado por `npm run visuais-check`.

/** Os estados que todo visual sabe mostrar. */
export const ESTADOS = ["pronta", "ouvindo", "pensando", "falando"];

/**
 * O catálogo. `cores[estado]` são três cores (claro, meio, fundo) — cada visual usa do seu jeito.
 * A ordem aqui é a ordem do painel.
 */
export const VISUAIS = [
  {
    id: "esfera",
    nome: "Esfera de pontos",
    descricao: "A de sempre: milhares de pontos numa esfera que ondula com a voz.",
    cores: {
      pronta: ["#7cc4ff", "#4a7dff", "#6a5cff"],
      ouvindo: ["#7cf2dc", "#3fc8e0", "#3f8cff"],
      pensando: ["#a9b8ff", "#6f6cff", "#9b5cff"],
      falando: ["#6ec3ff", "#8f7cff", "#ff7ad9"],
    },
  },
  {
    id: "lente",
    nome: "Lente",
    descricao: "Um disco de vidro escuro com anéis e borda de arco-íris; os anéis pulsam e o reflexo acende quando ela fala.",
    cores: {
      pronta: ["#ff7a2e", "#3ddc84", "#5b6cff"],
      ouvindo: ["#ffb347", "#46f0c8", "#4f8dff"],
      pensando: ["#ff8a3d", "#9a7dff", "#5b4dff"],
      falando: ["#ff6a2a", "#5cffb0", "#7aa2ff"],
    },
  },
  {
    id: "orbe",
    nome: "Orbe de vidro",
    descricao: "Uma esfera de vidro com fitas iridescentes roxas, azuis e douradas que giram por dentro.",
    cores: {
      pronta: ["#b07cff", "#4f8dff", "#f2c94c"],
      ouvindo: ["#8fd8ff", "#5a7dff", "#c9a6ff"],
      pensando: ["#c08bff", "#6a5cff", "#ffb86b"],
      falando: ["#d68bff", "#5ab0ff", "#ffd36b"],
    },
  },
  {
    id: "plasma",
    nome: "Plasma",
    descricao: "Uma forma luminosa e ondulada, feita de linhas finas, que se deforma com a fala.",
    cores: {
      pronta: ["#ff5ed1", "#9b6bff", "#4f9dff"],
      ouvindo: ["#7cf2dc", "#7c8bff", "#4fc3ff"],
      pensando: ["#c77dff", "#7b5cff", "#5b8cff"],
      falando: ["#ff4fd8", "#a66bff", "#55b6ff"],
    },
  },
  {
    id: "anel",
    nome: "Anel de partículas",
    descricao: "Um anel de partículas do azul ao magenta que respira, gira pensando e ondula quando ela fala.",
    cores: {
      pronta: ["#5a7dff", "#9b5cff", "#ff4fd8"],
      ouvindo: ["#3fd0ff", "#5a7dff", "#9b7dff"],
      pensando: ["#7b6bff", "#a85cff", "#d65cff"],
      falando: ["#4f8dff", "#b85cff", "#ff3fc8"],
    },
  },
];

export const VISUAL_PADRAO = "esfera";
export const CHAVE_DO_VISUAL = "lisa-visual";
export const EVENTO_DO_VISUAL = "lisa-visual"; // avisa a própria aba quando o visual muda

/** O visual de um id (o padrão, se o id não existe). */
export function visualDe(id) {
  return VISUAIS.find((v) => v.id === id) || VISUAIS.find((v) => v.id === VISUAL_PADRAO);
}

/** As cores de um visual num estado (o de repouso, se o estado não existe). */
export function coresDe(id, estado) {
  const v = visualDe(id);
  return v.cores[estado] || v.cores.pronta;
}

/**
 * O envelope da voz: devolve uma função (sinal, t, dt) → amplitude 0–1, com memória (sobe
 * rápido e desce devagar, como um medidor de áudio). Com o volume medido (`nivel`), segue o
 * volume; sem ele, simula: falando são "sílabas" ao acaso, ouvindo um tremor leve, pensando
 * uma respiração mais rápida, pronta quase parada. `acaso` é injetável para os testes.
 */
export function criarEnvelope(acaso = Math.random) {
  let amp = 0.1;
  let silaba = 0;
  let proxima = 0;
  return (sinal, t, dt) => {
    const estado = ESTADOS.includes(sinal?.estado) ? sinal.estado : "pronta";
    let meta;
    if (typeof sinal?.nivel === "number") {
      meta = 0.08 + Math.max(0, Math.min(1, sinal.nivel)) * 0.95;
    } else if (estado === "falando") {
      if (t > proxima) { silaba = acaso() < 0.15 ? 0.05 : 0.35 + acaso() * 0.65; proxima = t + 0.09 + acaso() * 0.16; }
      meta = silaba;
    } else if (estado === "ouvindo") {
      meta = 0.18 + 0.12 * Math.max(0, Math.sin(t * 5.3) * Math.sin(t * 1.7));
    } else if (estado === "pensando") {
      meta = 0.14 + 0.08 * Math.sin(t * 2.6);
    } else {
      meta = 0.08 + 0.04 * Math.sin(t * 0.9);
    }
    amp += (meta - amp) * Math.min(1, dt * (meta > amp ? 14 : 5));
    return amp;
  };
}

/**
 * O "peso" de cada estado, que desliza em vez de pular (um visual não troca de jeito de uma vez):
 * devolve uma função (estado, dt) → { pronta, ouvindo, pensando, falando }, somando 1.
 */
export function criarPesos() {
  const pesos = { pronta: 1, ouvindo: 0, pensando: 0, falando: 0 };
  return (estado, dt) => {
    const alvo = ESTADOS.includes(estado) ? estado : "pronta";
    const k = Math.min(1, dt * 3);
    for (const e of ESTADOS) pesos[e] += ((e === alvo ? 1 : 0) - pesos[e]) * k;
    const soma = ESTADOS.reduce((s, e) => s + pesos[e], 0) || 1;
    for (const e of ESTADOS) pesos[e] /= soma;
    return { ...pesos };
  };
}

// ---- a preferência (cada navegador guarda a sua) ----

/** O visual escolhido neste navegador. */
export function lerVisual() {
  try {
    const id = localStorage.getItem(CHAVE_DO_VISUAL);
    return VISUAIS.some((v) => v.id === id) ? id : VISUAL_PADRAO;
  } catch {
    return VISUAL_PADRAO;
  }
}

/** Escolhe o visual: guarda e avisa a tela aberta (as outras abas ficam sabendo pelo `storage`). */
export function escolherVisual(id) {
  const v = visualDe(id).id;
  try { localStorage.setItem(CHAVE_DO_VISUAL, v); } catch { /* sem armazenamento: vale só agora */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_DO_VISUAL, { detail: v })); } catch { /* fora do navegador */ }
  return v;
}
