// As tropas do Reino do Neuro (inspiradas no Clash of Clans, com nomes e números nossos). Puro.
//
// Duas reservas, com o mesmo catálogo:
//   EXÉRCITO  — treinado no Quartel, vai junto em cada invasão e é GASTO nela (como no Clash:
//               tropa que foi para a batalha não volta). A capacidade cresce com o Quartel.
//   GUARNIÇÃO — as tropas de defesa, que moram na Torre do Neuro e saem quando o inimigo chega
//               perto. Só as que caem precisam ser treinadas de novo. A capacidade cresce com a
//               Torre do Neuro.
// O Neuro é o herói: ataca junto em toda invasão e defende o próprio reino, sem treino — fica
// mais forte a cada nível.
//
// Números por golpe: `dano` a cada `intervalo` segundos. Distâncias na unidade da ilha (ela tem
// raio 7, e cresce com o Terreno). `area` = raio do dano em área; `suicida` = explode no golpe;
// `cura` = vida devolvida às tropas aliadas em volta, a cada `intervalo`. `defende` = pode
// morar na guarnição (tropas de defesa).

export const TROPAS = {
  guerreiro: {
    nome: "Guerreiro", emoji: "🗡️", espaco: 1, custo: 10, vida: 70, dano: 10, intervalo: 1.0,
    alcance: 0.6, velocidade: 1.6, voa: false, acertaAr: false, alvo: "qualquer", nivelMinimo: 1, defende: true,
    descricao: "Corpo a corpo, barato e valente. Ataca o que estiver mais perto.",
  },
  arqueira: {
    nome: "Arqueira", emoji: "🏹", espaco: 1, custo: 20, vida: 32, dano: 9, intervalo: 1.0,
    alcance: 3.0, velocidade: 1.7, voa: false, acertaAr: true, alvo: "qualquer", nivelMinimo: 1, defende: true,
    descricao: "Atira de longe, por cima da muralha, e acerta quem voa. Frágil de perto.",
  },
  bombardeiro: {
    nome: "Bombardeiro", emoji: "💥", espaco: 2, custo: 60, vida: 30, dano: 30, intervalo: 1.0, contraMuralha: 12,
    alcance: 0.5, velocidade: 2.2, voa: false, acertaAr: false, alvo: "muralha", suicida: true, nivelMinimo: 3,
    descricao: "Corre direto para a Muralha e explode: estrago enorme nela (12×). Some na explosão.",
  },
  gigante: {
    nome: "Gigante", emoji: "🪨", espaco: 5, custo: 100, vida: 650, dano: 22, intervalo: 1.5,
    alcance: 0.8, velocidade: 1.0, voa: false, acertaAr: false, alvo: "defesa", nivelMinimo: 2, defende: true,
    descricao: "Aguenta muito dano e só vai atrás das defesas — o escudo das outras tropas.",
  },
  mago: {
    nome: "Mago", emoji: "🧙", espaco: 4, custo: 120, vida: 75, dano: 32, intervalo: 1.5, area: 0.8,
    alcance: 2.6, velocidade: 1.5, voa: false, acertaAr: true, alvo: "qualquer", nivelMinimo: 3, defende: true,
    descricao: "Lança bolas de energia de longe, com dano em área — ótimo contra tropas juntas.",
  },
  balao: {
    nome: "Balão", emoji: "🎈", espaco: 5, custo: 150, vida: 340, dano: 90, intervalo: 2.5,
    alcance: 0.5, velocidade: 0.9, voa: true, acertaAr: false, alvo: "defesa", nivelMinimo: 4,
    descricao: "Voa devagar e solta bombas pesadas, só nas defesas. Defesa Aérea é o pesadelo dele.",
  },
  dragao: {
    nome: "Dragão", emoji: "🐉", espaco: 15, custo: 380, vida: 1100, dano: 65, intervalo: 1.25,
    alcance: 1.5, velocidade: 1.3, voa: true, acertaAr: true, alvo: "qualquer", nivelMinimo: 4, defende: true,
    descricao: "Voa por cima de tudo e cospe fogo. Canhão não o alcança; só flechas e magia.",
  },
  curandeira: {
    nome: "Curandeira", emoji: "🧚", espaco: 14, custo: 400, vida: 450, dano: 0, cura: 30, intervalo: 1.0,
    alcance: 2.5, velocidade: 1.4, voa: true, acertaAr: false, alvo: "aliado", nivelMinimo: 5,
    descricao: "Voa atrás do exército e cura as tropas em volta. Não ataca — proteja-a das flechas.",
  },
};
export const ORDEM_DAS_TROPAS = ["guerreiro", "arqueira", "bombardeiro", "gigante", "mago", "balao", "dragao", "curandeira"];
export const RESERVAS = { exercito: "exército", guarnicao: "tropas de defesa" };

/** O herói Neuro. No ataque luta corpo a corpo; na defesa atira livros de longe (e acerta quem voa). */
export function heroiNeuro(nivel, lado = "ataque") {
  const n = Math.max(1, nivel || 1);
  return {
    nome: "Neuro (herói)", emoji: "🧠", vida: 120 + 50 * n, dano: 14 + 6 * n, intervalo: 1.0,
    alcance: lado === "ataque" ? 0.7 : 2.5, velocidade: 1.5, voa: false, acertaAr: lado !== "ataque", alvo: "qualquer",
  };
}

export const capacidadeDoExercito = (nivelDoQuartel) => (nivelDoQuartel > 0 ? 10 + 10 * nivelDoQuartel : 0);
export const capacidadeDaGuarnicao = (nivelDaTorre) => 4 + 4 * Math.max(0, nivelDaTorre);
/** Quanto cabe no ACAMPAMENTO (a ilhota das tropas, ao lado do reino): exército + tropas de
 *  defesa juntos, todas à vista lá. 40 no nível 1, +25 por nível (65, 90, 115). Lotado, é hora
 *  de aumentar o Acampamento. */
export const lotacaoDoAcampamento = (nivel) => 15 + 25 * Math.max(1, Math.min(4, nivel || 1));

/** Contagens limpas: só tropas conhecidas, inteiros ≥ 0. */
export function contagens(valor) {
  const c = {};
  for (const t of ORDEM_DAS_TROPAS) {
    const n = Math.floor(Number(valor?.[t]) || 0);
    if (n > 0) c[t] = n;
  }
  return c;
}

export function espacoUsado(valor) {
  const c = contagens(valor);
  return ORDEM_DAS_TROPAS.reduce((s, t) => s + (c[t] || 0) * TROPAS[t].espaco, 0);
}

export const totalDeTropas = (valor) => Object.values(contagens(valor)).reduce((s, n) => s + n, 0);

/**
 * Dá para treinar? `destino`: "exercito" (precisa do Quartel) ou "guarnicao" (Torre do Neuro).
 * A tropa é liberada pelo nível da construção de cada reserva.
 */
export function podeTreinar({ tropa, quantidade, destino, niveis, reservas, saldo }) {
  const def = TROPAS[tropa];
  if (!def) return { ok: false, motivo: "tropa desconhecida" };
  if (!RESERVAS[destino]) return { ok: false, motivo: "treinar para onde?" };
  const qtd = Math.floor(Number(quantidade) || 0);
  if (qtd < 1 || qtd > 60) return { ok: false, motivo: "quantidade inválida" };
  const casa = destino === "exercito" ? "quartel" : "castelo";
  const nivel = niveis?.[casa] || 0;
  if (destino === "exercito" && nivel < 1) return { ok: false, motivo: "construa o Quartel para treinar tropas" };
  if (destino === "guarnicao" && !def.defende) return { ok: false, motivo: `${def.nome} não serve para defesa` };
  if (nivel < def.nivelMinimo) {
    return { ok: false, motivo: `${def.nome} pede ${destino === "exercito" ? "Quartel" : "Torre do Neuro"} no nível ${def.nivelMinimo}` };
  }
  const capacidade = destino === "exercito" ? capacidadeDoExercito(nivel) : capacidadeDaGuarnicao(nivel);
  const livre = capacidade - espacoUsado(reservas?.[destino]);
  if (qtd * def.espaco > livre) return { ok: false, motivo: livre > 0 ? `só cabe mais ${livre} de espaço` : "a reserva está cheia" };
  const lotacao = lotacaoDoAcampamento(niveis?.acampamento);
  const naIlha = espacoUsado(reservas?.exercito) + espacoUsado(reservas?.guarnicao);
  if (naIlha + qtd * def.espaco > lotacao) {
    return { ok: false, motivo: `o Acampamento está lotado (${naIlha} de ${lotacao}) — aumente o Acampamento para caber mais tropas` };
  }
  const custo = qtd * def.custo;
  if (saldo < custo) return { ok: false, custo, motivo: `faltam ${custo - saldo} moeda(s)` };
  return { ok: true, custo, quantidade: qtd };
}

/** Soma duas contagens (treino) ou tira uma da outra (perdas). */
export function somarTropas(a, b, sinal = 1) {
  const r = { ...contagens(a) };
  for (const [t, n] of Object.entries(contagens(b))) {
    r[t] = Math.max(0, (r[t] || 0) + sinal * n);
    if (!r[t]) delete r[t];
  }
  return r;
}

/** Força de ataque por segundo de um grupo (para a tela comparar exércitos). */
export function danoPorSegundo(valor, nivelDoNeuro = 0, lado = "ataque") {
  const c = contagens(valor);
  let total = ORDEM_DAS_TROPAS.reduce((s, t) => s + (c[t] || 0) * (TROPAS[t].dano / TROPAS[t].intervalo) * (TROPAS[t].area ? 1.5 : 1), 0);
  if (nivelDoNeuro > 0) { const h = heroiNeuro(nivelDoNeuro, lado); total += h.dano / h.intervalo; }
  return Math.round(total);
}
