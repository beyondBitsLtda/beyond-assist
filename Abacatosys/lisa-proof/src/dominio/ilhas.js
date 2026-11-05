// A TEMPORADA DAS ILHAS (03/11/2026, BEYOND-0020: "uma expedição diferente, de conquista de território —
// ilhas paradisíacas; o veículo é um navio novo; nas ilhas dominamos os nativos e podemos construir como no
// reino, com uma moeda muito mais barata; o jogo terá temporadas de domínio e a primeira são as ilhas; tropas
// temáticas; extrair muito recurso; invadir o território de outros jogadores; nada de paz geral nas ilhas,
// só entre dois jogadores; a Lisa também tem a ilha dela"). Puro.
//
// O ARQUIPÉLAGO é o mesmo para todo mundo: 12 ilhas, das fáceis às lendárias. Toda ilha começa com os nativos.
// Quem chega de NAVIO com a tripulação e vence com ⭐⭐ (a Cabana do Chefe no chão, ou metade da ilha) fica
// com ela; com ⭐ só leva conchas. A ilha conquistada produz CONCHAS 🐚 (a moeda das ilhas, 10 por moeda do
// reino — território desvalorizado) e moedas de verdade (as pérolas), e se constrói com conchas. Outros
// jogadores podem tomar a ilha de você; o que segura um vizinho é um PACTO entre os dois (a paz geral do
// reino não vale aqui). A batalha roda no mesmo motor do reino (combate.js), com as chaves de sempre e os
// nomes da ilha. O banco fica em src/lib/ilhas.js. Testado em scripts/dominio-check.mjs.

import { TROPAS, ORDEM_DA_TRIPULACAO, contagens, espacoUsado } from "./tropas.js";
import { contagensDeMonstros } from "./monstros.js";
import { resolverCombate } from "./combate.js";

export const TEMPORADA = {
  id: "ilhas-1", nome: "Temporada das Ilhas", emoji: "🏝️", inicio: "2026-11-03", fim: "2027-01-31",
  moeda: { nome: "concha", plural: "conchas", emoji: "🐚" },
};
export const CONCHAS_POR_MOEDA = 10;
export const PACOTES_DE_CONCHAS = [10, 50, 100, 300]; // em moedas do reino
export const ILHAS_POR_JOGADOR = 3;
export const ATAQUES_DE_ILHA_POR_DIA = 3;
export const HORAS_DE_ESCUDO_DA_CONQUISTA = 12;
export const HORAS_ATE_ENCHER_NA_ILHA = 12;
export const DIAS_DO_PACTO = 7;
export const HORAS_PARA_ACEITAR_PACTO = 48;
export const VEICULO_DAS_ILHAS = "navio";
// a ilha tropical (cenariosDasExpedicoes.js): o mar, a praia, a cachoeira e a vegetação, com as construções do
// reino em cima — na vista da ilha e na batalha (03/11/2026)
export const CENARIO_DAS_ILHAS = "ilha-tropical";

/** A temporada está aberta? (Depois do fim, as ilhas ficam como estão até a próxima.) */
export const temporadaAberta = (dia) => dia >= TEMPORADA.inicio && dia <= TEMPORADA.fim;

/**
 * O arquipélago: `x`/`y` no mapa (0–100), o `nivel` (1 fácil a 5 lendária), as construções dos nativos (as
 * chaves do motor de combate; toda ilha tem o Terreno 1) e os nativos que a defendem.
 */
export const ARQUIPELAGO = [
  { id: "coqueiro", nome: "Ilha do Coqueiro", emoji: "🥥", x: 14, y: 22, nivel: 1, construcoes: { castelo: 1, mina: 1, quartel: 1 }, nativos: { nativo: 3 } },
  { id: "areia-branca", nome: "Praia de Areia Branca", emoji: "🏖️", x: 33, y: 12, nivel: 1, construcoes: { castelo: 1, mina: 1, quartel: 1, torre: 1 }, nativos: { nativo: 5 } },
  { id: "tartarugas", nome: "Atol das Tartarugas", emoji: "🐢", x: 52, y: 22, nivel: 2, construcoes: { castelo: 2, mina: 1, torre: 1, canhao: 1 }, nativos: { nativo: 5, xama: 1 } },
  { id: "manguezal", nome: "Manguezal Escondido", emoji: "🌿", x: 73, y: 11, nivel: 2, construcoes: { castelo: 2, mina: 2, torre: 1, canhao: 1, muralha: 1 }, nativos: { nativo: 6, xama: 1 } },
  { id: "lagoa-azul", nome: "Lagoa Azul", emoji: "💧", x: 88, y: 32, nivel: 2, construcoes: { castelo: 2, mina: 2, torre: 2, canhao: 1, quartel: 1 }, nativos: { nativo: 6, xama: 2 } },
  { id: "recife", nome: "Recife de Coral", emoji: "🪸", x: 68, y: 43, nivel: 3, construcoes: { castelo: 3, mina: 2, biblioteca: 1, torre: 2, canhao: 2, muralha: 1 }, nativos: { nativo: 7, xama: 2 } },
  { id: "vulcaozinho", nome: "Ilha do Vulcãozinho", emoji: "🌋", x: 42, y: 45, nivel: 3, construcoes: { castelo: 3, mina: 2, torre: 2, canhao: 2, muralha: 2, quartel: 1 }, nativos: { nativo: 6, xama: 3 } },
  { id: "papagaios", nome: "Ilha dos Papagaios", emoji: "🦜", x: 18, y: 50, nivel: 3, construcoes: { castelo: 3, mina: 3, biblioteca: 1, torre: 2, canhao: 2, defesaAerea: 1, muralha: 2 }, nativos: { nativo: 7, xama: 3 } },
  { id: "caveira", nome: "Rochedo da Caveira", emoji: "💀", x: 13, y: 78, nivel: 4, construcoes: { castelo: 4, mina: 3, biblioteca: 2, torre: 3, canhao: 3, defesaAerea: 1, muralha: 3, quartel: 2 }, nativos: { nativo: 8, xama: 3, chefeTiki: 1 } },
  { id: "perolas", nome: "Baía das Pérolas", emoji: "🦪", x: 35, y: 80, nivel: 4, construcoes: { castelo: 4, mina: 3, biblioteca: 3, torre: 3, canhao: 3, defesaAerea: 2, muralha: 3 }, nativos: { nativo: 8, xama: 4, chefeTiki: 1 } },
  { id: "tesouro", nome: "Ilha do Tesouro", emoji: "🗝️", x: 62, y: 74, nivel: 5, construcoes: { castelo: 5, mina: 4, biblioteca: 3, torre: 4, canhao: 4, defesaAerea: 2, muralha: 4, quartel: 3, cofre: 2 }, nativos: { nativo: 10, xama: 4, chefeTiki: 1 } },
  { id: "grande-tiki", nome: "Ilha do Grande Tiki", emoji: "🗿", x: 86, y: 70, nivel: 5, construcoes: { castelo: 5, mina: 5, biblioteca: 4, torre: 4, canhao: 4, defesaAerea: 3, muralha: 5, quartel: 3, cofre: 3 }, nativos: { nativo: 10, xama: 5, chefeTiki: 2 } },
];
export const ilhaPorId = (id) => ARQUIPELAGO.find((i) => i.id === id) || null;
export const NOMES_DOS_NIVEIS = { 1: "Fácil", 2: "Médio", 3: "Difícil", 4: "Muito difícil", 5: "Lendária" };

/**
 * As construções da ilha: as mesmas chaves do motor (a Torre do Neuro vira a Cabana do Chefe…), com o nome e
 * o preço da ilha — em conchas. `custos[i]`: o que custa chegar ao nível i+1. Nenhuma passa do nível da Cabana.
 */
export const CONSTRUCOES_DA_ILHA = {
  castelo: { nome: "Cabana do Chefe", emoji: "🛖", custos: [0, 600, 1400, 2800, 5000], efeito: "o coração da ilha: caiu, a ilha está perdida · nenhuma construção passa do nível dela" },
  mina: { nome: "Coqueiral", emoji: "🌴", custos: [300, 700, 1400, 2600, 4400], efeito: "produz conchas" },
  biblioteca: { nome: "Recife de Pérolas", emoji: "🦪", custos: [500, 1100, 2100, 3600, 6000], efeito: "produz pérolas: moedas de verdade para o reino" },
  quartel: { nome: "Porto", emoji: "⚓", custos: [400, 900, 1800, 3200, 5200], efeito: "mais espaço na tripulação e tropas novas" },
  cofre: { nome: "Baú do Tesouro", emoji: "🧰", custos: [300, 700, 1400, 2600, 4400], efeito: "guarda conchas a salvo dos saques" },
  muralha: { nome: "Paliçada", emoji: "🪵", custos: [250, 600, 1200, 2300, 4000], efeito: "cerca a Cabana do Chefe" },
  torre: { nome: "Torre Tiki", emoji: "🗿", custos: [350, 800, 1600, 3000, 5000], efeito: "atira de longe, no chão e no ar" },
  canhao: { nome: "Canhão de Coco", emoji: "💣", custos: [400, 900, 1800, 3300, 5400], efeito: "dano forte, só no chão" },
  defesaAerea: { nome: "Lança-Arpões", emoji: "🎯", custos: [600, 1300, 2500, 4200, 6800], efeito: "derruba quem voa" },
};
export const ORDEM_DA_ILHA = ["castelo", "mina", "biblioteca", "quartel", "cofre", "muralha", "torre", "canhao", "defesaAerea"];
export const NIVEL_MAXIMO_NA_ILHA = 5;

/** A produção de uma ilha por hora: conchas (Coqueiral) e moedas das pérolas (Recife de Pérolas). */
export const producaoDaIlha = (c = {}) => ({ conchas: 25 * Math.max(0, c.mina || 0), moedas: 2 * Math.max(0, c.biblioteca || 0) });
/** O que a ilha juntou desde a última coleta (no máximo HORAS_ATE_ENCHER_NA_ILHA horas), em inteiros. */
export function juntadoNaIlha(construcoes, coletadoEm, agora = new Date()) {
  const horas = Math.min(HORAS_ATE_ENCHER_NA_ILHA, Math.max(0, (agora.getTime() - new Date(coletadoEm || agora).getTime()) / 3_600_000));
  const p = producaoDaIlha(construcoes);
  return { conchas: Math.floor(p.conchas * horas), moedas: Math.floor(p.moedas * horas), horas: Math.round(horas * 10) / 10 };
}

/** Dá para melhorar a construção da ilha? Precisa ser sua, ter conchas e respeitar o nível da Cabana. */
export function podeConstruirNaIlha({ souDono, construcoes = {}, chave, conchas }) {
  const def = CONSTRUCOES_DA_ILHA[chave];
  if (!def) return { ok: false, motivo: "construção desconhecida" };
  if (!souDono) return { ok: false, motivo: "a ilha não é sua" };
  const nivel = construcoes[chave] || 0;
  if (nivel >= NIVEL_MAXIMO_NA_ILHA) return { ok: false, motivo: "já está no nível máximo" };
  const custo = def.custos[nivel];
  if (chave !== "castelo" && nivel + 1 > (construcoes.castelo || 1)) return { ok: false, custo, motivo: `suba a Cabana do Chefe para o nível ${nivel + 1} antes` };
  if (conchas < custo) return { ok: false, custo, motivo: `faltam ${Math.ceil(custo - conchas)} conchas` };
  return { ok: true, custo };
}

/** O espaço da tripulação: 16 no navio, mais 12 por nível de Porto em cada ilha sua. */
export const capacidadeDaTripulacao = (ilhasMinhas = []) => 16 + ilhasMinhas.reduce((s, i) => s + 12 * Math.max(0, i?.construcoes?.quartel || 0), 0);
/** O Porto mais alto das suas ilhas libera as tropas (sem ilha, o navio conta como Porto 1). */
export const nivelDoPorto = (ilhasMinhas = []) => Math.max(1, ...ilhasMinhas.map((i) => i?.construcoes?.quartel || 0));

/** Dá para treinar a tripulação? Só as tropas da temporada, no espaço do navio e dos Portos, pagas em conchas. */
export function podeTreinarTripulacao({ tropa, quantidade, tripulacao, ilhasMinhas = [], conchas }) {
  const def = TROPAS[tropa];
  if (!def || !ORDEM_DA_TRIPULACAO.includes(tropa)) return { ok: false, motivo: "essa tropa não é da tripulação das ilhas" };
  const qtd = Math.floor(Number(quantidade) || 0);
  if (qtd < 1 || qtd > 60) return { ok: false, motivo: "quantidade inválida" };
  const porto = nivelDoPorto(ilhasMinhas);
  if (porto < def.nivelMinimo) return { ok: false, motivo: `${def.nome} pede um Porto no nível ${def.nivelMinimo}` };
  const livre = capacidadeDaTripulacao(ilhasMinhas) - espacoUsado(tripulacao);
  if (qtd * def.espaco > livre) return { ok: false, motivo: livre > 0 ? `só cabe mais ${livre} de espaço no navio` : "o navio está cheio" };
  const custo = qtd * def.custo;
  if (conchas < custo) return { ok: false, custo, motivo: `faltam ${Math.ceil(custo - conchas)} conchas` };
  return { ok: true, custo, quantidade: qtd };
}

/** O pacto entre dois jogadores (a única paz das ilhas): aceito e dentro do prazo. */
export function pactoVigente(pactos = [], a, b, agora = new Date()) {
  return pactos.find((p) => p.aceito_em && new Date(p.ate).getTime() > agora.getTime()
    && ((p.de_id === a && p.para_id === b) || (p.de_id === b && p.para_id === a))) || null;
}
/** Um pedido de pacto ainda esperando resposta (some depois de HORAS_PARA_ACEITAR_PACTO). */
export const pactoPendente = (p, agora = new Date()) => !p.aceito_em && agora.getTime() - new Date(p.criado_em).getTime() < HORAS_PARA_ACEITAR_PACTO * 3_600_000;

/**
 * Dá para atacar a ilha? Precisa do Navio, de tripulação, de ataque sobrando no dia; a ilha não pode ser sua,
 * nem estar com escudo, nem ser de alguém com quem você tem pacto; e quem já tem ILHAS_POR_JOGADOR não conquista mais.
 */
export function podeAtacarIlha({ usuarioId, ilha, temNavio, tripulacao, ataquesHoje, ilhasMinhas = [], pactos = [], agora = new Date() }) {
  if (!temNavio) return { ok: false, motivo: "compre o Navio na garagem do reino para navegar até as ilhas" };
  if (!ilha) return { ok: false, motivo: "essa ilha não existe" };
  if (ilha.dono_id === usuarioId) return { ok: false, motivo: "a ilha já é sua" };
  if (ataquesHoje >= ATAQUES_DE_ILHA_POR_DIA) return { ok: false, motivo: `já foram os ${ATAQUES_DE_ILHA_POR_DIA} ataques de hoje — amanhã o navio sai de novo` };
  // 05/11/2026 ("estou com o navio comprado, mas a opção de conquistar fica desabilitada"): a mensagem diz onde e como
  if (!Object.keys(contagens(tripulacao)).length) return { ok: false, semTripulacao: true, motivo: "o navio está sem tripulação: treine piratas (pagos em conchas) para zarpar — os passos estão logo abaixo" };
  if (ilhasMinhas.length >= ILHAS_POR_JOGADOR) return { ok: false, motivo: `você já tem ${ILHAS_POR_JOGADOR} ilhas — o máximo da temporada` };
  if (ilha.escudo_ate && new Date(ilha.escudo_ate).getTime() > agora.getTime()) return { ok: false, motivo: "a ilha acabou de ser conquistada e está com escudo" };
  if (ilha.dono_id && pactoVigente(pactos, usuarioId, ilha.dono_id, agora)) return { ok: false, motivo: "vocês têm um pacto: nada de ataque até ele acabar" };
  return { ok: true };
}

/** Os guardas da ilha conquistada: metade dos nativos da ilha (arredondando para cima) fica do lado do novo dono. */
export function guardasDaConquista(ilhaId) {
  const def = ilhaPorId(ilhaId);
  const g = {};
  for (const [t, n] of Object.entries(contagensDeMonstros(def?.nativos))) g[t] = Math.ceil(n / 2);
  return g;
}

/** O defensor da ilha para o motor de combate: as construções (com o Terreno 1), os nativos ou os guardas, e o cenário. */
export function defensorDaIlha(ilha) {
  const def = ilhaPorId(ilha.id);
  return {
    construcoes: { ...(ilha.construcoes || def.construcoes), terreno: 1 },
    neuro_nivel: 0,
    guarnicao: {},
    monstros: contagensDeMonstros(ilha.dono_id ? ilha.guardas : def.nativos),
    tema: "ilha",
    cenario: CENARIO_DAS_ILHAS,
    veiculo: VEICULO_DAS_ILHAS,
  };
}

/** A batalha na ilha, decidida aqui (o mesmo motor do reino; a tela roda a mesma entrada para mostrar). */
export function batalhaNaIlha({ tripulacao, ilha, semente }) {
  const entrada = {
    semente: semente >>> 0 || 1,
    atacante: { exercito: contagens(tripulacao), neuro_nivel: 0 },
    defensor: defensorDaIlha(ilha),
  };
  const r = resolverCombate(entrada);
  const caidas = {};
  for (const [tipo, n] of Object.entries(entrada.atacante.exercito)) {
    const caiu = n - (r.sobreviventes[tipo] || 0);
    if (caiu > 0) caidas[tipo] = caiu;
  }
  return { ...r, caidas, entrada };
}

/** O que a batalha decide: ⭐⭐ ou mais conquista; ⭐ leva conchas; nada, volta para casa. */
export function desfechoNaIlha({ estrelas, ilha }) {
  const def = ilhaPorId(ilha.id);
  if (estrelas >= 2) return { tipo: "conquista", moedas: ilha.dono_id ? 0 : 20 * def.nivel, conchas: ilha.dono_id ? 0 : 100 * def.nivel };
  if (estrelas === 1) return { tipo: "saque", moedas: 0, conchas: ilha.dono_id ? null : 60 * def.nivel }; // de jogador: saqueDeConchas
  return { tipo: "derrota", moedas: 0, conchas: 0 };
}

/** O saque de conchas de uma ilha de jogador (⭐): 20% do que ele tem acima do Baú do Tesouro, até 1.500. */
export const protecaoDoBau = (ilhasDoDono = []) => 300 * Math.max(0, ...ilhasDoDono.map((i) => i?.construcoes?.cofre || 0));
export const saqueDeConchas = (conchasDoDono, protecao) => Math.min(1500, Math.floor(Math.max(0, conchasDoDono - protecao) * 0.2));

/** A ilha depois de trocar de dono: cada construção perde um nível (a Cabana fica no 1, no mínimo). */
export function construcoesAposConquista(construcoes = {}) {
  const c = {};
  for (const k of ORDEM_DA_ILHA) {
    const n = Math.max(0, (construcoes[k] || 0) - 1);
    if (k === "castelo") c[k] = Math.max(1, n);
    else if (n > 0) c[k] = n;
  }
  return c;
}
