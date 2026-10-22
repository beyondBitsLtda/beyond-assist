// O REINO DO NEURO: as regras do jogo (pedido de 20/10/2026; combate no estilo Clash em 21/10).
// Puro — o banco mora em src/lib/reino.js; a batalha passo a passo, em src/dominio/combate.js; as
// tropas, em src/dominio/tropas.js.
//
// A ideia em uma frase: estudar dá moedas; moedas constroem o reino, treinam tropas e sobem o
// Neuro; o reino invade e é invadido por outros jogadores.
//
//   MOEDAS    — cada ponto de estudo vale 1 moeda. Mais a mina, os saques e os vales, menos os
//               gastos. Pontos NÃO se gastam: o ranking de pontos nunca cai por causa do reino.
//   TORRE     — o coração do reino: o nível dela é o teto das outras construções, o do Neuro é o
//               dobro dela, e nela mora a guarnição (tropas de defesa).
//   MINA      — produz moedas sozinha, devagar, até encher.   COFRE — guarda moedas do saque.
//   DEFESAS   — Torre de Arqueiros (chão e ar), Canhão (só chão), Muralha (cerca a Torre).
//   QUARTEL   — treina o exército e define quantas tropas cabem nele.
//   TERRENO   — compra terra: a ilha cresce e ganha espaço para construções novas (Biblioteca,
//               Defesa Aérea, Morteiro, Torre Mágica, Torre do Raio).
//   INVASÃO   — 3 por dia; o mesmo reino só a cada 48 h (cada lado conta o seu: dá para revidar).
//               Só as tropas que CAEM se perdem; as que sobrevivem voltam (22/10/2026 — antes o
//               exército inteiro era gasto). Estrelas pela destruição; o saque e os
//               troféus seguem as estrelas.
//   ALIANÇA   — paz, mina em dobro, reforços e reinos vizinhos: ver alianca.js. Quem cai ganha 8 h de escudo; reino novo nasce com
//               48 h; atacar tira o próprio escudo.
//   EXPEDIÇÃO — contra a CPU (vilas, florestas, bosques, acampamentos de monstros): ver monstros.js.

import { PREDIOS_EM_COMBATE, resolverCombate, raioDaIlha } from "./combate.js";
import { defensorDaExpedicao, saqueDaExpedicao } from "./monstros.js";
import {
  capacidadeDoExercito, capacidadeDaGuarnicao, contagens, totalDeTropas, danoPorSegundo, espacoUsado, TROPAS, lotacaoDoAcampamento,
} from "./tropas.js";

const def = (chave) => PREDIOS_EM_COMBATE[chave].defesa;
const virgula = (x) => String(x).replace(".", ",");

export const CONSTRUCOES = {
  castelo: {
    nome: "Torre do Neuro", emoji: "🏰", max: 5,
    // custo para CHEGAR a cada nível (índice 0 = nível 1). A torre já nasce no nível 1.
    custos: [0, 300, 700, 1500, 3000],
    efeito: (n) => `limite das construções: nível ${n} · Neuro até o ${n * 2} · ${capacidadeDaGuarnicao(n)} de espaço para tropas de defesa · ❤️ ${PREDIOS_EM_COMBATE.castelo.vida(n)}`,
  },
  mina: {
    nome: "Mina de Moedas", emoji: "⛏️", max: 5,
    custos: [0, 120, 280, 600, 1200],
    efeito: (n) => `${producaoPorHora(n)} moeda(s) por hora · enche em ${HORAS_ATE_ENCHER} h (${capacidadeDaMina(n)}) · ❤️ ${PREDIOS_EM_COMBATE.mina.vida(n)}`,
  },
  cofre: {
    nome: "Cofre", emoji: "🏦", max: 5,
    custos: [80, 200, 450, 900, 1800],
    efeito: (n) => `${protecaoDoCofre(n)} moedas a salvo de invasões · ❤️ ${PREDIOS_EM_COMBATE.cofre.vida(n)}`,
  },
  muralha: {
    nome: "Muralha", emoji: "🧱", max: 5,
    custos: [100, 240, 520, 1000, 2000],
    efeito: (n) => `cerca a Torre do Neuro: quem ataca de perto, por terra, precisa derrubá-la antes · ❤️ ${PREDIOS_EM_COMBATE.muralha.vida(n)}`,
  },
  torre: {
    nome: "Torre de Arqueiros", emoji: "🏹", max: 5,
    custos: [120, 280, 600, 1200, 2400],
    efeito: (n) => `${def("torre")(n).dano} de dano a cada ${virgula(def("torre")(n).intervalo)} s · alcance ${virgula(def("torre")(n).alcance)} · acerta no chão e no ar · ❤️ ${PREDIOS_EM_COMBATE.torre.vida(n)}`,
  },
  canhao: {
    nome: "Canhão", emoji: "💣", max: 5,
    custos: [100, 250, 550, 1100, 2200],
    efeito: (n) => `${def("canhao")(n).dano} de dano a cada ${virgula(def("canhao")(n).intervalo)} s · alcance ${virgula(def("canhao")(n).alcance)} · só tropas no chão · ❤️ ${PREDIOS_EM_COMBATE.canhao.vida(n)}`,
  },
  terreno: {
    nome: "Terreno", emoji: "🗺️", max: 3,
    // cada expansão aumenta a ilha e libera construções novas nos espaços novos
    custos: [600, 1500, 3500],
    efeito: (n) => `ilha com raio ${virgula(raioDaIlha(n))} · libera: ${Object.values(CONSTRUCOES).filter((c) => c.terreno && c.terreno <= n).map((c) => c.nome).join(", ") || "—"}`,
  },
  biblioteca: {
    nome: "Biblioteca", emoji: "📚", max: 5, terreno: 1,
    custos: [250, 500, 900, 1600, 3000],
    efeito: (n) => `+${2 * n} moedas por hora junto com a Mina (coletadas juntas) · ❤️ ${PREDIOS_EM_COMBATE.biblioteca.vida(n)}`,
  },
  defesaAerea: {
    nome: "Defesa Aérea", emoji: "🚀", max: 5, terreno: 1,
    custos: [300, 650, 1200, 2200, 4000],
    efeito: (n) => `${def("defesaAerea")(n).dano} de dano a cada ${virgula(def("defesaAerea")(n).intervalo)} s · alcance ${virgula(def("defesaAerea")(n).alcance)} · SÓ quem voa · ❤️ ${PREDIOS_EM_COMBATE.defesaAerea.vida(n)}`,
  },
  morteiro: {
    nome: "Morteiro", emoji: "🎯", max: 5, terreno: 2,
    custos: [500, 1000, 1800, 3000, 5000],
    efeito: (n) => `${def("morteiro")(n).dano} de dano em área a cada ${virgula(def("morteiro")(n).intervalo)} s · alcance ${virgula(def("morteiro")(n).minimo)} a ${virgula(def("morteiro")(n).alcance)} · só chão · ❤️ ${PREDIOS_EM_COMBATE.morteiro.vida(n)}`,
  },
  torreMagica: {
    nome: "Torre Mágica", emoji: "🔮", max: 5, terreno: 2,
    custos: [550, 1100, 2000, 3400, 5500],
    efeito: (n) => `${def("torreMagica")(n).dano} de dano em área a cada ${virgula(def("torreMagica")(n).intervalo)} s · alcance ${virgula(def("torreMagica")(n).alcance)} · chão e ar · ❤️ ${PREDIOS_EM_COMBATE.torreMagica.vida(n)}`,
  },
  torreRaio: {
    nome: "Torre do Raio", emoji: "⚡", max: 5, terreno: 3,
    custos: [900, 1800, 3200, 5000, 8000],
    efeito: (n) => `${def("torreRaio")(n).dano} de dano a cada ${virgula(def("torreRaio")(n).intervalo)} s num alvo só · alcance ${virgula(def("torreRaio")(n).alcance)} · chão e ar · ❤️ ${PREDIOS_EM_COMBATE.torreRaio.vida(n)}`,
  },
  acampamento: {
    nome: "Acampamento", emoji: "⛺", max: 4,
    // a ilhota das tropas, ao lado do reino: fora da batalha, todas as tropas ficam à vista lá
    custos: [0, 500, 1300, 3000],
    efeito: (n) => `a ilhota das tropas: cabem ${lotacaoDoAcampamento(n)} de espaço (exército + defesa), todas à vista`,
  },
  quartel: {
    nome: "Quartel", emoji: "⚔️", max: 5,
    custos: [120, 280, 600, 1200, 2400],
    efeito: (n) => `exército de ${capacidadeDoExercito(n)} de espaço · libera ${Object.values(TROPAS).filter((t) => t.nivelMinimo <= n).map((t) => t.nome).join(", ")} · ❤️ ${PREDIOS_EM_COMBATE.quartel.vida(n)}`,
  },
};
export const ORDEM_DAS_CONSTRUCOES = [
  "castelo", "terreno", "mina", "biblioteca", "cofre", "muralha", "torre", "canhao",
  "defesaAerea", "morteiro", "torreMagica", "torreRaio", "quartel", "acampamento",
];
export const NIVEIS_INICIAIS = {
  castelo: 1, terreno: 0, mina: 1, biblioteca: 0, cofre: 0, muralha: 0, torre: 0, canhao: 0,
  defesaAerea: 0, morteiro: 0, torreMagica: 0, torreRaio: 0, quartel: 0, acampamento: 1,
};

export const HORAS_ATE_ENCHER = 12;
export const ATAQUES_POR_DIA = 3;
export const FATIA_DO_SAQUE = 0.2;   // de tudo o que está fora do cofre, se destruir 100%
export const TETO_DO_SAQUE = 300;
export const ESCUDO_APOS_DERROTA_HORAS = 8;
export const ESCUDO_DE_NOVATO_HORAS = 48;
// A guerra entre jogadores (pedido de 22/10/2026): cada um pode invadir o MESMO reino uma vez a
// cada 48 h, contadas do ataque. A conta é por direção — quem foi atacado pode revidar na hora.
export const HORAS_ENTRE_ATAQUES_AO_MESMO_REINO = 48;
/** Troféus por estrelas: quem ataca ganha 4 por estrela + 2 (ou perde 3 com zero); quem defende perde 2 por estrela + 1 (ou ganha 5). */
export function trofeusDoCombate(estrelas) {
  return estrelas > 0 ? { atacante: 4 * estrelas + 2, defensor: -(2 * estrelas + 1) } : { atacante: -3, defensor: 5 };
}

export const producaoPorHora = (nivelDaMina) => Math.max(0, nivelDaMina);
/** Moedas por hora do reino inteiro: a Mina mais a Biblioteca (2 por nível). */
export const taxaDeProducao = (niveis) => producaoPorHora(niveis?.mina || 0) + 2 * Math.max(0, niveis?.biblioteca || 0);
export const capacidadeDaMina = (nivelDaMina) => producaoPorHora(nivelDaMina) * HORAS_ATE_ENCHER;
export const protecaoDoCofre = (nivelDoCofre) => 150 * Math.max(0, nivelDoCofre);
export const custoDoNeuro = (nivelAtual) => 100 * nivelAtual;
export const nivelMaximoDoNeuro = (nivelDaTorre) => nivelDaTorre * 2;

/** O nome do momento do Neuro, para a tela (a cada 2 níveis ele "evolui"). */
export const ESTAGIOS_DO_NEURO = ["Filhote", "Aprendiz", "Estudioso", "Mestre", "Lendário"];
export function estagioDoNeuro(nivel) {
  return ESTAGIOS_DO_NEURO[Math.min(ESTAGIOS_DO_NEURO.length - 1, Math.floor((Math.max(1, nivel) - 1) / 2))];
}

/** Níveis completos (com as construções que ainda não existiam no reino guardado). */
export function niveisDe(reino) {
  return { ...NIVEIS_INICIAIS, ...(reino?.construcoes || {}) };
}

/**
 * Força para a tela comparar: ataque = dano por segundo do exército + Neuro; defesa = dano por
 * segundo das defesas e da guarnição, mais um tanto pela vida das construções.
 */
export function poderDo(reino) {
  const n = niveisDe(reino);
  let defesas = 0, vida = 0;
  for (const chave of Object.keys(PREDIOS_EM_COMBATE)) {
    if ((n[chave] || 0) < 1) continue;
    const est = PREDIOS_EM_COMBATE[chave];
    vida += est.vida(n[chave]);
    if (est.defesa) { const d = est.defesa(n[chave]); defesas += d.dano / d.intervalo; }
  }
  return {
    ataque: danoPorSegundo(reino?.exercito, reino?.neuro_nivel || 1, "ataque"),
    defesa: Math.round(defesas + danoPorSegundo(reino?.guarnicao, reino?.neuro_nivel || 1, "defesa") + vida / 100),
  };
}

/**
 * Dá para construir/melhorar? Devolve { ok, custo, motivo }. `saldo` são as moedas de agora.
 * Regra do teto: nenhuma construção passa do nível da Torre do Neuro.
 */
export function podeMelhorar(reino, chave, saldo) {
  const d = CONSTRUCOES[chave];
  if (!d) return { ok: false, motivo: "construção desconhecida" };
  const n = niveisDe(reino);
  const atual = n[chave] || 0;
  if (atual >= d.max) return { ok: false, motivo: "já está no nível máximo" };
  const custo = d.custos[atual];
  if (d.terreno && (n.terreno || 0) < d.terreno) {
    return { ok: false, custo, motivo: `compre a expansão ${d.terreno} do Terreno primeiro` };
  }
  if (chave !== "castelo" && atual + 1 > n.castelo) {
    return { ok: false, custo, motivo: `melhore a ${CONSTRUCOES.castelo.nome} para o nível ${atual + 1} primeiro` };
  }
  if (saldo < custo) return { ok: false, custo, motivo: `faltam ${custo - saldo} moeda(s)` };
  return { ok: true, custo };
}

export function podeSubirNeuro(reino, saldo) {
  const n = niveisDe(reino);
  const nivel = reino?.neuro_nivel || 1;
  const custo = custoDoNeuro(nivel);
  if (nivel >= nivelMaximoDoNeuro(n.castelo)) {
    return { ok: false, custo, motivo: `o Neuro chega no máximo ao nível ${nivelMaximoDoNeuro(n.castelo)} com a torre no nível ${n.castelo}` };
  }
  if (saldo < custo) return { ok: false, custo, motivo: `faltam ${custo - saldo} moeda(s)` };
  return { ok: true, custo };
}

/** Quanto a mina tem para coletar agora (inteiro), dado o último `coletado_em`. */
/** O que a mina juntou desde a última coleta. `fator`: 2 durante uma aliança (mina em dobro). */
export function producaoAcumulada(reino, agora = new Date(), fator = 1) {
  const n = niveisDe(reino);
  const desde = new Date(reino?.coletado_em || agora).getTime();
  const horas = Math.max(0, (agora.getTime() - desde) / 3_600_000);
  const taxa = taxaDeProducao(n) * fator;
  return Math.min(taxa * HORAS_ATE_ENCHER, Math.floor(horas * taxa));
}

/** O escudo protege até `escudo_ate`. */
export function temEscudo(reino, agora = new Date()) {
  return Boolean(reino?.escudo_ate) && new Date(reino.escudo_ate).getTime() > agora.getTime();
}

/** Quando eu posso invadir de novo o reino que ataquei em `ultimoAtaque` (null = já posso). */
export function proximoAtaqueAoReino(ultimoAtaque) {
  if (!ultimoAtaque) return null;
  const t = new Date(ultimoAtaque).getTime();
  return Number.isFinite(t) ? new Date(t + HORAS_ENTRE_ATAQUES_AO_MESMO_REINO * 3_600_000) : null;
}

/** "em 1 dia e 5 h", "em 3 h", "em 20 min": quanto falta até `quando`. */
export function esperaAte(quando, agora = new Date()) {
  const min = Math.max(1, Math.ceil((new Date(quando).getTime() - agora.getTime()) / 60_000));
  if (min < 60) return `em ${min} min`;
  const horas = Math.ceil(min / 60);
  if (horas < 24) return `em ${horas} h`;
  const dias = Math.floor(horas / 24), resto = horas % 24;
  return `em ${dias} dia${dias > 1 ? "s" : ""}${resto ? ` e ${resto} h` : ""}`;
}

/**
 * Pode invadir `defensor`? `ataquesHoje` são as invasões do atacante no dia; `ultimoAtaqueAoAlvo`
 * é quando ele atacou ESTE defensor pela última vez (o mesmo reino só a cada 48 h — e cada lado
 * conta o seu, então quem foi atacado pode revidar). `jaAtacouHoje` continua valendo (o banco tem
 * a mesma trava por dia).
 */
export function podeInvadir({ atacanteId, atacante, defensor, ataquesHoje, jaAtacouHoje = false, ultimoAtaqueAoAlvo = null, aliados = false, agora = new Date() }) {
  if (!defensor) return { ok: false, motivo: "esse reino não existe" };
  if (defensor.usuario_id === atacanteId) return { ok: false, motivo: "não dá para invadir o próprio reino" };
  if (aliados) return { ok: false, motivo: "vocês são aliados — não dá para invadir durante a paz" };
  if (atacante && totalDeTropas(atacante.exercito) === 0) return { ok: false, motivo: "treine tropas no Quartel antes de invadir" };
  if (ataquesHoje >= ATAQUES_POR_DIA) return { ok: false, motivo: `você já fez as ${ATAQUES_POR_DIA} invasões de hoje — amanhã tem mais` };
  const proximo = proximoAtaqueAoReino(ultimoAtaqueAoAlvo);
  if (proximo && proximo.getTime() > agora.getTime()) {
    return { ok: false, motivo: `você já invadiu esse reino — libera de novo ${esperaAte(proximo, agora)}`, liberaEm: proximo.toISOString() };
  }
  if (jaAtacouHoje) return { ok: false, motivo: "você já invadiu esse reino hoje" };
  if (temEscudo(defensor, agora)) return { ok: false, motivo: "esse reino está com escudo" };
  return { ok: true };
}

/** O saque segue a destruição: 20% do que está fora do cofre se destruir tudo, até 300. */
export function saqueDo({ destruicao, saldoDoDefensor, nivelDoCofre }) {
  const protegido = protecaoDoCofre(nivelDoCofre);
  const exposto = Math.max(0, (saldoDoDefensor || 0) - protegido);
  const saque = Math.min(TETO_DO_SAQUE, Math.floor((exposto * FATIA_DO_SAQUE * destruicao) / 100));
  return { protegido, exposto, saque };
}

/**
 * A batalha de verdade: roda o combate e transforma estrelas em saque, troféus e escudo.
 * `atacante`: { exercito, neuro_nivel }; `defensor`: o reino ({ construcoes, neuro_nivel, guarnicao }).
 */
export function batalha({ atacante, defensor, saldoDoDefensor, semente }) {
  const entrada = combateDe({ atacante, defensor, semente });
  const r = resolverCombate(entrada);
  const venceu = r.estrelas > 0;
  const { protegido, exposto, saque } = saqueDo({ destruicao: r.destruicao, saldoDoDefensor, nivelDoCofre: niveisDe(defensor).cofre });
  const t = trofeusDoCombate(r.estrelas);
  return {
    ...r, venceu, saque: venceu ? saque : 0, protegido, exposto, entrada,
    trofeusAtacante: t.atacante, trofeusDefensor: t.defensor,
    escudoDoDefensorHoras: venceu ? ESCUDO_APOS_DERROTA_HORAS : 0,
  };
}

/**
 * O exército de uma expedição: o seu, se tiver tropas; senão a TROPA DA EXPEDIÇÃO — emprestada e
 * de graça, do tamanho da Torre do Neuro (como se o Quartel estivesse no nível dela). Visto em
 * 22/10/2026: ninguém tinha Quartel nem tropas, e o botão de atacar nem aparecia — a expedição
 * "de graça" pedia moedas para treinar o exército antes.
 */
export function exercitoDaExpedicao(exercito, nivelDaTorre) {
  if (totalDeTropas(exercito) > 0) return { exercito: contagens(exercito), emprestado: false };
  return { exercito: exercitoDeTreino(Math.max(1, nivelDaTorre || 1), 1), emprestado: true };
}

/**
 * Uma expedição contra a CPU: o mesmo motor, com a ilha dos monstros. O saque segue a destruição
 * (mesmo sem estrela). `caidas` é só o placar da luta: a expedição não gasta tropa nenhuma.
 */
export function batalhaDeExpedicao({ atacante, expedicao, semente }) {
  const entrada = {
    semente: semente >>> 0 || 1,
    atacante: { exercito: contagens(atacante?.exercito), neuro_nivel: atacante?.neuro_nivel || 1 },
    defensor: defensorDaExpedicao(expedicao),
  };
  const r = resolverCombate(entrada);
  const caidas = {};
  for (const [tipo, n] of Object.entries(entrada.atacante.exercito)) {
    const caiu = n - (r.sobreviventes[tipo] || 0);
    if (caiu > 0) caidas[tipo] = caiu;
  }
  return { ...r, venceu: r.estrelas > 0, saque: saqueDaExpedicao(expedicao, r), caidas, entrada };
}

/** O que o motor de combate precisa (e o que a tela guarda para mostrar a batalha de novo). */
export function combateDe({ atacante, defensor, semente }) {
  return {
    semente: semente >>> 0 || 1,
    atacante: { exercito: contagens(atacante?.exercito), neuro_nivel: atacante?.neuro_nivel || 1 },
    defensor: { construcoes: niveisDe(defensor), neuro_nivel: defensor?.neuro_nivel || 1, guarnicao: contagens(defensor?.guarnicao) },
  };
}

/** Troféus nunca ficam negativos. */
export const somarTrofeus = (atual, delta) => Math.max(0, (atual || 0) + delta);

/** Saldo de moedas: pontos de estudo + movimentos do livro-caixa (gastos já vêm negativos). */
export function saldoDe({ pontosDeEstudo, movimentos }) {
  return (pontosDeEstudo || 0) + (movimentos || []).reduce((s, m) => s + (m.valor || 0), 0);
}

/** Para a lista de alvos: um retrato aproximado da defesa (o número exato só aparece na batalha). */
export function faixaDeDefesa(defesa) {
  if (defesa < 35) return "fraca";
  if (defesa < 80) return "média";
  if (defesa < 140) return "forte";
  return "fortíssima";
}

// ------------------------------------------------------------------ modo simulação
// Treino: a mesma batalha da invasão de verdade, contra um rival de mentira, sem tocar no banco.

export const RIVAIS_SIMULADOS = {
  fraco: { nome: "Rival mais fraco", passo: -1, enchimento: 0.4 },
  parelho: { nome: "Rival parelho", passo: 0, enchimento: 0.7 },
  forte: { nome: "Rival mais forte", passo: 1, enchimento: 1 },
};

/**
 * Um exército que enche `fracao` do Quartel: um dragão se o Quartel deixar, um quarto do espaço
 * em gigantes, e o resto dividido entre guerreiros e arqueiras.
 */
export function exercitoDeTreino(nivelDoQuartel, fracao = 1) {
  const q = Math.max(1, nivelDoQuartel || 0);
  let livre = Math.floor(capacidadeDoExercito(q) * fracao);
  const ex = {};
  if (q >= TROPAS.dragao.nivelMinimo && livre >= 40) { ex.dragao = 1; livre -= TROPAS.dragao.espaco; }
  if (q >= TROPAS.gigante.nivelMinimo) { const g = Math.floor((livre * 0.25) / TROPAS.gigante.espaco); if (g) { ex.gigante = g; livre -= g * TROPAS.gigante.espaco; } }
  if (q >= TROPAS.bombardeiro.nivelMinimo) { ex.bombardeiro = 2; livre -= 2 * TROPAS.bombardeiro.espaco; }
  if (q >= TROPAS.mago.nivelMinimo) { const m = Math.floor((livre * 0.2) / TROPAS.mago.espaco); if (m) { ex.mago = m; livre -= m * TROPAS.mago.espaco; } }
  ex.guerreiro = Math.ceil(livre * 0.6);
  ex.arqueira = Math.max(0, livre - ex.guerreiro);
  return contagens(ex);
}

/** Tropas de defesa que enchem `fracao` da guarnição (metade guerreiros, metade arqueiras). */
export function guarnicaoDeTreino(nivelDaTorre, fracao = 1) {
  const livre = Math.floor(capacidadeDaGuarnicao(nivelDaTorre) * fracao);
  return contagens({ guerreiro: Math.ceil(livre / 2), arqueira: Math.floor(livre / 2) });
}

/** Um rival tirado do meu reino: tudo um nível abaixo/acima, com exército e guarnição. */
export function rivalSimulado(base, forca = "parelho") {
  const { passo, enchimento } = RIVAIS_SIMULADOS[forca] || RIVAIS_SIMULADOS.parelho;
  const n = niveisDe(base);
  const construcoes = {};
  for (const chave of ORDEM_DAS_CONSTRUCOES) {
    construcoes[chave] = Math.max(chave === "castelo" || chave === "mina" ? 1 : 0, Math.min(5, (n[chave] || 0) + passo));
  }
  // um rival de treino sempre tem alguma defesa e algum exército, para a batalha ter graça
  if (forca !== "fraco") { construcoes.torre = Math.max(1, construcoes.torre); construcoes.quartel = Math.max(1, construcoes.quartel); }
  // construção da terra nova só existe se o rival tiver o Terreno
  construcoes.terreno = Math.min(3, construcoes.terreno, construcoes.castelo);
  for (const chave of ORDEM_DAS_CONSTRUCOES) {
    if (CONSTRUCOES[chave].terreno && construcoes.terreno < CONSTRUCOES[chave].terreno) construcoes[chave] = 0;
  }
  const neuro = Math.max(1, Math.min(10, (base?.neuro_nivel || 1) + passo * 2));
  return {
    construcoes, neuro_nivel: neuro,
    exercito: exercitoDeTreino(construcoes.quartel, enchimento),
    guarnicao: guarnicaoDeTreino(construcoes.castelo, enchimento * 0.6),
  };
}

/**
 * Uma batalha de treino, do lado de quem joga. `tipo`: "atacar" (eu invado o rival, com o meu
 * exército — ou um de treino, se o meu estiver vazio) ou "defender" (o rival invade o meu reino).
 */
export function simularBatalha({ tipo, eu, rival, meuSaldo, saldoDoRival = 500, semente }) {
  const meuExercito = totalDeTropas(eu.exercito) ? eu.exercito : exercitoDeTreino(niveisDe(eu).quartel, 1);
  const atacante = tipo === "atacar" ? { exercito: meuExercito, neuro_nivel: eu.neuro_nivel } : { exercito: rival.exercito, neuro_nivel: rival.neuro_nivel };
  const defensor = tipo === "atacar" ? rival : eu;
  const saldoDoDefensor = tipo === "atacar" ? saldoDoRival : meuSaldo;
  const r = batalha({ atacante, defensor, saldoDoDefensor, semente });
  return {
    ...r, tipo, saldoDoDefensor,
    exercitoDeTreino: tipo === "atacar" && !totalDeTropas(eu.exercito),
    exercitoUsado: atacante.exercito,
    euVenci: tipo === "atacar" ? r.venceu : !r.venceu,
    meusTrofeus: tipo === "atacar" ? r.trofeusAtacante : r.trofeusDefensor,
    minhasMoedas: tipo === "atacar" ? r.saque : r.saque ? -r.saque : 0,
  };
}

/** Quantas estrelas em média (de 0 a 3) em `vezes` batalhas com sementes diferentes. */
export function previsaoDeEstrelas(entrada, vezes = 8) {
  let soma = 0;
  for (let i = 1; i <= vezes; i++) soma += resolverCombate({ ...entrada, semente: i * 7919 }).estrelas;
  return Math.round((soma / vezes) * 10) / 10;
}

export { espacoUsado };
