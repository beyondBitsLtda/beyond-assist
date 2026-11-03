// A Forja de Artefatos (03/11/2026, ideia da Lisa: "o tempo que você passa estudando vira mana para criar
// itens mágicos: uma poção de foco que multiplica suas moedas durante duas horas, ou um escudo que protege
// seu reino contra invasões nos dias de folga"). Puro: quanto de mana a pessoa tem, o que dá para forjar e
// quanto a poção rende. O banco e as moedas ficam em src/lib/forja.js. Testado em scripts/dominio-check.mjs.

/** A mana conta os estudos a partir daqui (o dia em que a Forja abriu). */
export const INICIO_DA_FORJA = "2026-11-03";
/** 10 pontos de estudo = 1 mana. As conquistas não contam: não são tempo de estudo. */
export const PONTOS_POR_MANA = 10;
export const EVENTOS_SEM_MANA = new Set(["conquista"]);

export const ARTEFATOS = {
  pocao: {
    id: "pocao", nome: "Poção de Foco", emoji: "🧪", mana: 30, horas: 2, multiplicador: 1.5, tetoDoBonus: 300,
    descricao: "Por 2 horas, tudo o que você ganhar estudando rende +50%. O extra cai quando a poção acaba (até 🪙 300).",
  },
  escudo: {
    id: "escudo", nome: "Escudo de Folga", emoji: "🛡️", mana: 40, horas: 24, intervaloHoras: 72,
    descricao: "Protege o reino contra invasões por 24 horas — para o seu dia de folga. Um a cada 3 dias; atacar alguém quebra o escudo.",
  },
};
export const ORDEM_DOS_ARTEFATOS = ["pocao", "escudo"];

const HORA = 3_600_000;

/** A mana: a que os estudos deram, a que já foi gasta na Forja e a que sobra. */
export function manaDe({ pontos = 0, gasta = 0 }) {
  const ganha = Math.floor(Math.max(0, pontos) / PONTOS_POR_MANA);
  return { ganha, gasta, disponivel: Math.max(0, ganha - gasta), proxima: PONTOS_POR_MANA - (Math.max(0, pontos) % PONTOS_POR_MANA) };
}

/** Os pontos que viram mana (ou que a poção multiplica): os de estudo, sem as conquistas. */
export const pontosQueContam = (eventos) => eventos.filter((e) => !EVENTOS_SEM_MANA.has(e.tipo)).reduce((s, e) => s + (Number(e.pontos) || 0), 0);

/**
 * Dá para forjar? `forjados`: os artefatos da pessoa ({ item, inicio, ate }); `escudoAte`: até quando o
 * reino já está protegido (o de novato, o de uma derrota ou o forjado).
 */
export function podeForjar({ item, mana, forjados = [], escudoAte = null, agora = new Date() }) {
  const def = ARTEFATOS[item];
  if (!def) return { ok: false, motivo: "esse artefato não existe" };
  const t = agora.getTime();
  if (mana < def.mana) return { ok: false, motivo: `faltam ${def.mana - mana} de mana (estude mais um pouco)` };
  if (item === "pocao") {
    const ativa = forjados.find((f) => f.item === "pocao" && new Date(f.ate).getTime() > t);
    if (ativa) return { ok: false, motivo: "já tem uma Poção de Foco fazendo efeito" };
  }
  if (item === "escudo") {
    const ultimo = forjados.filter((f) => f.item === "escudo").map((f) => new Date(f.inicio).getTime()).sort((a, b) => b - a)[0];
    if (ultimo && t - ultimo < def.intervaloHoras * HORA) {
      const horas = Math.ceil((def.intervaloHoras * HORA - (t - ultimo)) / HORA);
      return { ok: false, motivo: `o próximo Escudo de Folga fica pronto em ${horas} h` };
    }
    if (escudoAte && new Date(escudoAte).getTime() - t > 12 * HORA) return { ok: false, motivo: "o reino já está protegido por mais de 12 horas" };
  }
  return { ok: true };
}

/** O que forjar agora faz: o começo e o fim do efeito (o escudo soma ao que ainda resta do atual). */
export function efeitoDe(item, agora = new Date(), escudoAte = null) {
  const def = ARTEFATOS[item];
  const inicio = agora.getTime();
  const base = item === "escudo" && escudoAte ? Math.max(inicio, new Date(escudoAte).getTime()) : inicio;
  return { inicio: new Date(inicio).toISOString(), ate: new Date(base + def.horas * HORA).toISOString() };
}

/** O extra da poção: o que ela multiplicou sobre os pontos ganhos na janela dela, com teto. */
export function bonusDaPocao(pontosNaJanela) {
  const def = ARTEFATOS.pocao;
  return Math.min(def.tetoDoBonus, Math.max(0, Math.round(pontosNaJanela * (def.multiplicador - 1))));
}
