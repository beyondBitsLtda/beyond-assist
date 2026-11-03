// Os Chefões da Procrastinação (03/11/2026, ideia da Lisa: "suas matérias acumuladas e revisões atrasadas
// viram monstros gigantes no mapa; para dar dano no chefe, conclua sessões de estudo nos Cadernos ou acerte
// sequências na Prática"). Puro: de que tamanho nasce o chefão, quanto dano os estudos deram e quando ele
// cai. O banco e a recompensa ficam em src/lib/chefoes.js. Testado em scripts/dominio-check.mjs.

/**
 * O atraso pesa: cada assunto atrasado da trilha vale 3; cada cartão de revisão vencido, 1. Do tamanho do
 * atraso sai o chefão (o maior que couber). `monstro` é o desenho de papel (src/componentes/reino/monstrosDePapel.js).
 */
export const CHEFOES_DA_PROCRASTINACAO = [
  { id: "lesma", nome: "Lesma da Preguiça", emoji: "🐌", monstro: "slime", atrasoMinimo: 3, vida: 150, recompensa: 60, rouboPorDia: 8 },
  { id: "hidra", nome: "Hidra do Depois", emoji: "🐉", monstro: "cerbero", atrasoMinimo: 10, vida: 300, recompensa: 120, rouboPorDia: 15 },
  { id: "tita", nome: "Titã da Procrastinação", emoji: "👹", monstro: "ogro", atrasoMinimo: 25, vida: 500, recompensa: 200, rouboPorDia: 25 },
];
export const chefaoPorId = (id) => CHEFOES_DA_PROCRASTINACAO.find((c) => c.id === id) || null;

/** Depois de derrubar um chefão, o próximo só nasce depois deste descanso. */
export const HORAS_ATE_O_PROXIMO = 20;

/**
 * Os golpes: cada ponto de estudo desde que o chefão nasceu é dano. A Prática (quiz, exercício, projetos) e
 * o diário de estudo acertam em dobro — é por eles (e pelos Cadernos, abaixo) que a ideia pede para lutar.
 * Conquistas e o bônus da meta do dia não contam.
 */
export const DANO_POR_TIPO = {
  diario: 2, quiz: 2, exercicio: 2, projeto_semanal: 2, projeto_final: 2, projeto_mensal: 2,
  item: 1, card: 1, cartoes: 1, revisao: 1, dominio: 1,
};

export const pesoDoAtraso = ({ atrasados = 0, revisoesVencidas = 0 }) => Math.max(0, atrasados) * 3 + Math.max(0, revisoesVencidas);

/** O chefão que nasce de um atraso (null = atraso pequeno, nenhum chefão). */
export function chefaoDoAtraso(atraso) {
  const peso = pesoDoAtraso(atraso);
  let escolhido = null;
  for (const c of CHEFOES_DA_PROCRASTINACAO) if (peso >= c.atrasoMinimo) escolhido = c;
  return escolhido;
}

/** Pode nascer um chefão agora? Não com um vivo, nem logo depois de derrubar o último. */
export function podeNascer({ vivo = null, ultimoDerrotadoEm = null, atraso, agora = new Date() }) {
  if (vivo) return { ok: false };
  if (ultimoDerrotadoEm && agora.getTime() - new Date(ultimoDerrotadoEm).getTime() < HORAS_ATE_O_PROXIMO * 3_600_000) return { ok: false };
  const chefao = chefaoDoAtraso(atraso);
  return chefao ? { ok: true, chefao } : { ok: false };
}

/** O dano dos eventos de estudo (`{ tipo, pontos }`), já com os golpes em dobro. */
export function danoDosEstudos(eventos) {
  return Math.round((eventos || []).reduce((s, e) => s + (Number(e.pontos) || 0) * (DANO_POR_TIPO[e.tipo] || 0), 0));
}

/**
 * Os Cadernos não dão pontos, então dão dano direto: cada página diferente escrita ou editada desde que o
 * chefão nasceu é um golpe de 25. Teto: metade da vida (o resto vem do estudo que pontua).
 */
export const DANO_POR_PAGINA = 25;
export const danoDosCadernos = (paginas, vida) => Math.min(Math.floor(vida / 2), Math.max(0, paginas) * DANO_POR_PAGINA);

/**
 * O dano que o chefão dá (03/11/2026, BEYOND-0018: "roubar moedas, porém uma quantidade que não seja punitiva
 * demais"): de pé, a cada 24 horas ele rouba um pouco do reino — `rouboPorDia` (8, 15 ou 25), nunca mais que
 * 5% do saldo e, somando tudo, nunca mais que a recompensa dele. As primeiras 24 horas são de graça. Quem
 * derruba o chefão recebe de volta tudo o que ele roubou, além da recompensa.
 */
export const ROUBO_DO_CHEFAO = { horasEntreRoubos: 24, parteMaximaDoSaldo: 0.05 };

/** Quantos roubos venceram desde o último (ou desde que nasceu) e quando passa a contar o próximo. */
export function roubosVencidos({ nasceuEm, ultimoRouboEm = null, agora = new Date() }) {
  const passo = ROUBO_DO_CHEFAO.horasEntreRoubos * 3_600_000;
  const desde = new Date(ultimoRouboEm || nasceuEm).getTime();
  const vezes = Math.max(0, Math.floor((agora.getTime() - desde) / passo));
  return { vezes, relogio: new Date(desde + vezes * passo).toISOString(), proximo: new Date(desde + (vezes + 1) * passo).toISOString() };
}

/** Quanto o chefão leva agora: `vezes` roubos de até `rouboPorDia`, cada um até 5% do saldo, com o teto da recompensa. */
export function valorDoRoubo({ tipo, vezes, saldo, jaRoubado = 0 }) {
  const def = chefaoPorId(tipo);
  if (!def || vezes <= 0) return 0;
  const porVez = Math.min(def.rouboPorDia, Math.floor(Math.max(0, saldo) * ROUBO_DO_CHEFAO.parteMaximaDoSaldo));
  return Math.max(0, Math.min(vezes * porVez, def.recompensa - Math.max(0, jaRoubado)));
}

/** Como o chefão está: a vida que resta e se caiu. */
export function situacaoDoChefao({ vida, dano }) {
  const restante = Math.max(0, vida - Math.max(0, dano));
  return { vida, dano: Math.min(vida, Math.max(0, dano)), restante, derrotado: restante === 0, parte: vida ? restante / vida : 0 };
}
