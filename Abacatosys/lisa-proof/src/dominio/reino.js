// O REINO DO NEURO: as regras do jogo (pedido de 20/10/2026). Puro — o banco mora em src/lib/reino.js.
//
// A ideia em uma frase: estudar dá moedas; moedas constroem e melhoram o reino e sobem o Neuro;
// o reino pode invadir e ser invadido por outros jogadores.
//
//   MOEDAS   — cada ponto de estudo vale 1 moeda (quiz, exercício, projetos, tarefas, metas,
//              conquistas). Mais a mina, os saques e menos os gastos. Pontos NÃO se gastam: o
//              ranking de pontos nunca cai por causa do reino.
//   TORRE    — o coração do reino. O nível dela é o teto das outras construções, e o do Neuro é
//              o dobro dela.
//   MINA     — produz moedas sozinha, devagar (ela ajuda, não substitui o estudo), até encher.
//   COFRE    — guarda moedas que nenhuma invasão leva.
//   MURALHA e TORRE DE ARQUEIROS — defesa.   QUARTEL — ataque.   NEURO — ataque e defesa.
//   INVASÃO  — 3 por dia. Força contra força, com uma sorte de ±15%. Quem vence leva 15% das
//              moedas que estão fora do cofre (até 250) e troféus; quem perde a defesa ganha um
//              escudo de 8 horas. Reino novo nasce com escudo de 48 horas. Atacar tira o
//              próprio escudo.

export const CONSTRUCOES = {
  castelo: {
    nome: "Torre do Neuro", emoji: "🏰", max: 5,
    // custo para CHEGAR a cada nível (índice 0 = nível 1). A torre já nasce no nível 1.
    custos: [0, 300, 700, 1500, 3000],
    efeito: (n) => `limite das construções: nível ${n} · Neuro até o nível ${n * 2}`,
  },
  mina: {
    nome: "Mina de Moedas", emoji: "⛏️", max: 5,
    custos: [0, 120, 280, 600, 1200],
    efeito: (n) => `${producaoPorHora(n)} moeda(s) por hora · enche em ${HORAS_ATE_ENCHER} h (${capacidadeDaMina(n)})`,
  },
  cofre: {
    nome: "Cofre", emoji: "🏦", max: 5,
    custos: [80, 200, 450, 900, 1800],
    efeito: (n) => `${protecaoDoCofre(n)} moedas a salvo de invasões`,
  },
  muralha: {
    nome: "Muralha", emoji: "🧱", max: 5,
    custos: [100, 240, 520, 1000, 2000],
    efeito: (n) => `+${n * 12} de defesa`,
  },
  torre: {
    nome: "Torre de Arqueiros", emoji: "🏹", max: 5,
    custos: [120, 280, 600, 1200, 2400],
    efeito: (n) => `+${n * 10} de defesa`,
  },
  quartel: {
    nome: "Quartel", emoji: "⚔️", max: 5,
    custos: [120, 280, 600, 1200, 2400],
    efeito: (n) => `+${n * 14} de ataque`,
  },
};
export const ORDEM_DAS_CONSTRUCOES = ["castelo", "mina", "cofre", "muralha", "torre", "quartel"];
export const NIVEIS_INICIAIS = { castelo: 1, mina: 1, cofre: 0, muralha: 0, torre: 0, quartel: 0 };

export const HORAS_ATE_ENCHER = 12;
export const ATAQUES_POR_DIA = 3;
export const FATIA_DO_SAQUE = 0.15;
export const TETO_DO_SAQUE = 250;
export const SORTE = 0.15;
export const ESCUDO_APOS_DERROTA_HORAS = 8;
export const ESCUDO_DE_NOVATO_HORAS = 48;
export const TROFEUS = { vitoriaAtacante: 10, derrotaDefensor: -5, defesaVencida: 5, ataqueFalho: -3 };

export const producaoPorHora = (nivelDaMina) => Math.max(0, nivelDaMina);
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

/** Força de ataque e de defesa do reino. */
export function poderDo(reino) {
  const n = niveisDe(reino);
  const neuro = reino?.neuro_nivel || 1;
  return {
    ataque: 10 + n.quartel * 14 + neuro * 8,
    defesa: 10 + n.muralha * 12 + n.torre * 10 + neuro * 6,
  };
}

/**
 * Dá para construir/melhorar? Devolve { ok, custo, motivo }. `saldo` são as moedas de agora.
 * Regra do teto: nenhuma construção passa do nível da Torre do Neuro.
 */
export function podeMelhorar(reino, chave, saldo) {
  const def = CONSTRUCOES[chave];
  if (!def) return { ok: false, motivo: "construção desconhecida" };
  const n = niveisDe(reino);
  const atual = n[chave] || 0;
  if (atual >= def.max) return { ok: false, motivo: "já está no nível máximo" };
  const custo = def.custos[atual];
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
export function producaoAcumulada(reino, agora = new Date()) {
  const n = niveisDe(reino);
  const desde = new Date(reino?.coletado_em || agora).getTime();
  const horas = Math.max(0, (agora.getTime() - desde) / 3_600_000);
  return Math.min(capacidadeDaMina(n.mina), Math.floor(horas * producaoPorHora(n.mina)));
}

/** O escudo protege até `escudo_ate`. */
export function temEscudo(reino, agora = new Date()) {
  return Boolean(reino?.escudo_ate) && new Date(reino.escudo_ate).getTime() > agora.getTime();
}

/**
 * Pode invadir `defensor`? `ataquesHoje` são as invasões do atacante no dia; `jaAtacouHoje` diz se
 * ele já atacou ESTE defensor hoje (uma vez por alvo por dia: ninguém vira saco de pancada).
 */
export function podeInvadir({ atacanteId, defensor, ataquesHoje, jaAtacouHoje, agora = new Date() }) {
  if (!defensor) return { ok: false, motivo: "esse reino não existe" };
  if (defensor.usuario_id === atacanteId) return { ok: false, motivo: "não dá para invadir o próprio reino" };
  if (ataquesHoje >= ATAQUES_POR_DIA) return { ok: false, motivo: `você já fez as ${ATAQUES_POR_DIA} invasões de hoje — amanhã tem mais` };
  if (jaAtacouHoje) return { ok: false, motivo: "você já invadiu esse reino hoje" };
  if (temEscudo(defensor, agora)) return { ok: false, motivo: "esse reino está com escudo" };
  return { ok: true };
}

/**
 * A batalha. `sorteA`/`sorteD` são números em [0, 1) (o servidor sorteia; o teste fixa).
 * Cada lado rola a sua força com ±SORTE. Empate é da defesa.
 */
export function batalha({ atacante, defensor, saldoDoDefensor, sorteA, sorteD }) {
  const pa = poderDo(atacante);
  const pd = poderDo(defensor);
  const fator = (s) => 1 - SORTE + 2 * SORTE * s;
  const ataque = Math.round(pa.ataque * fator(sorteA));
  const defesa = Math.round(pd.defesa * fator(sorteD));
  const venceu = ataque > defesa;

  const protegido = protecaoDoCofre(niveisDe(defensor).cofre);
  const exposto = Math.max(0, (saldoDoDefensor || 0) - protegido);
  const saque = venceu ? Math.min(TETO_DO_SAQUE, Math.floor(exposto * FATIA_DO_SAQUE)) : 0;

  return {
    ataque, defesa, venceu, saque, protegido, exposto,
    trofeusAtacante: venceu ? TROFEUS.vitoriaAtacante : TROFEUS.ataqueFalho,
    trofeusDefensor: venceu ? TROFEUS.derrotaDefensor : TROFEUS.defesaVencida,
    escudoDoDefensorHoras: venceu ? ESCUDO_APOS_DERROTA_HORAS : 0,
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
  if (defesa < 40) return "fraca";
  if (defesa < 80) return "média";
  if (defesa < 130) return "forte";
  return "fortíssima";
}
