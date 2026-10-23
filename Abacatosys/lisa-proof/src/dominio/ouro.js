// A MINA DE OURO e os OPERÁRIOS (pedido de 23/10/2026): "uma mina terrestre em cada reino;
// comprar operários para extrair ouro — demora mais para sair, mas vale mais moedas; os jogadores
// podem deixar operários disponíveis para aluguel de outros; todo jogador já ganha um pelotão
// mínimo de operários". Puro, como o resto de src/dominio.
//
// Cada operário trabalhando tira 1 pepita a cada HORAS_POR_PEPITA horas, e cada pepita vale
// VALOR_DA_PEPITA moedas na coleta (a venda é automática). A mina guarda até PEPITAS_POR_VAGA
// pepitas por vaga — cheia, para de juntar, como a Mina de Moedas.
//
// DIAMANTES (23/10/2026): cada pedra que um operário tira tem uma chance de ser um diamante
// (chanceDeDiamante, maior quanto mais funda — maior o nível — a mina), que vale VALOR_DO_DIAMANTE.
// O sorteio é fixo por coleta (a semente é a pessoa e a hora da última coleta) e não muda quando
// mais pedras saem: a 3ª pedra é diamante ou não é, para sempre — recarregar a tela não sorteia
// de novo; só coletar começa uma rodada nova.
//
// Quem trabalha na minha mina: os meus operários (menos os que estão alugados para alguém) mais os
// que eu aluguei de outros reinos — até as vagas da mina (vagasDaMina). O aluguel dura
// HORAS_DE_ALUGUEL: quem aluga paga na hora, direto ao dono, o preço por operário × a quantidade;
// enquanto dura, o operário trabalha (e junta ouro) na mina de quem alugou.

export const OPERARIOS_INICIAIS = 3;
export const HORAS_POR_PEPITA = 8;
export const VALOR_DA_PEPITA = 6;
export const PEPITAS_POR_VAGA = 3;
export const HORAS_DE_ALUGUEL = 24;
export const PRECO_MINIMO_DO_ALUGUEL = 5;
export const PRECO_MAXIMO_DO_ALUGUEL = 40;
export const VALOR_DO_DIAMANTE = 45;
/** A chance de uma pedra ser diamante: 4% no nível 1, +1% a cada nível (8% no 5). */
export const chanceDeDiamante = (nivel) => 0.03 + 0.01 * Math.max(1, Math.min(5, nivel || 1));
const HORA = 3_600_000;
const instante = (x) => new Date(x).getTime();

/** Quantos operários cabem na mina: 3 no nível 1 e +2 a cada nível. */
export const vagasDaMina = (nivel) => 3 + 2 * (Math.max(1, nivel || 1) - 1);
export const capacidadeEmPepitas = (nivel) => vagasDaMina(nivel) * PEPITAS_POR_VAGA;
/** O próximo operário: 120 moedas, e +40 a cada um além do pelotão inicial. */
export const precoDoOperario = (tenho) => 120 + 40 * Math.max(0, (tenho || 0) - OPERARIOS_INICIAIS);
/** Quanto um operário rende por dia, em moedas (para quem decide o preço do aluguel). */
export const moedasPorOperarioPorDia = () => (24 / HORAS_POR_PEPITA) * VALOR_DA_PEPITA;

const ativo = (a, agora) => instante(a.inicio) <= agora && instante(a.fim) > agora;

/**
 * Operário-horas trabalhadas na minha mina entre `desde` e `agora`: os meus o tempo todo, menos o
 * tempo que cada um passou alugado fora, mais o tempo dos que aluguei de outros. Os aluguéis são
 * { quantidade, inicio, fim }. (Comprar operário coleta antes, então `operarios` não muda no meio.)
 */
export function horasTrabalhadas({ operarios, desde, agora = new Date(), alugadosParaFora = [], alugadosDeFora = [] }) {
  const ini = instante(desde), fim = instante(agora);
  if (!(fim > ini)) return 0;
  const sobrepoe = (a) => Math.max(0, Math.min(fim, instante(a.fim)) - Math.max(ini, instante(a.inicio))) / HORA;
  let h = (Math.max(0, operarios || 0) * (fim - ini)) / HORA;
  for (const a of alugadosParaFora) h -= (a.quantidade || 0) * sobrepoe(a);
  for (const a of alugadosDeFora) h += (a.quantidade || 0) * sobrepoe(a);
  return Math.max(0, h);
}

function sorteio(semente) {
  let a = (semente >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A semente da rodada de uma mina: a pessoa e a hora da última coleta. */
export function sementeDaMina(usuarioId, coletadoEm) {
  let h = 0x811c9dc5;
  for (const ch of `${usuarioId}|${coletadoEm}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Quantas das `pedras` são diamante (as mesmas, sempre, para a mesma semente). */
export function diamantesEntre(pedras, nivel, semente) {
  const r = sorteio(semente);
  const chance = chanceDeDiamante(nivel);
  let n = 0;
  for (let i = 0; i < pedras; i++) if (r() < chance) n++;
  return n;
}

/**
 * O que a mina juntou desde a última coleta: pedras inteiras (`pepitas`), até encher — algumas
 * podem ser diamantes (`diamantes`, com a `semente` da rodada); o resto é ouro (`ouro`).
 */
export function ouroAcumulado({ nivel, semente = 1, ...trabalho }) {
  const capacidade = capacidadeEmPepitas(nivel);
  const pepitas = Math.min(capacidade, Math.floor(horasTrabalhadas(trabalho) / HORAS_POR_PEPITA));
  const diamantes = diamantesEntre(pepitas, nivel, semente);
  const ouro = pepitas - diamantes;
  return { pepitas, ouro, diamantes, moedas: ouro * VALOR_DA_PEPITA + diamantes * VALOR_DO_DIAMANTE, capacidade, cheia: pepitas >= capacidade };
}

/** Quem está na mina agora: os meus, os que estão fora (alugados) e os que vieram de fora. */
export function equipeDeAgora({ operarios, alugadosParaFora = [], alugadosDeFora = [], agora = new Date() }) {
  const t = instante(agora);
  const fora = alugadosParaFora.filter((a) => ativo(a, t)).reduce((s, a) => s + a.quantidade, 0);
  const deFora = alugadosDeFora.filter((a) => ativo(a, t)).reduce((s, a) => s + a.quantidade, 0);
  const proprios = Math.max(0, operarios || 0);
  return { proprios, alugadosParaFora: fora, alugadosDeFora: deFora, emCasa: Math.max(0, proprios - fora), trabalhando: Math.max(0, proprios - fora) + deFora };
}

/** Contratar mais um operário: cabe na mina? tem moedas? */
export function podeComprarOperario({ operarios, nivel, saldo }) {
  const vagas = vagasDaMina(nivel);
  const custo = precoDoOperario(operarios);
  if ((operarios || 0) >= vagas) return { ok: false, custo, motivo: `a Mina de Ouro no nível ${nivel || 1} tem ${vagas} vagas — melhore a mina para contratar mais` };
  if ((saldo || 0) < custo) return { ok: false, custo, motivo: `faltam ${custo - (saldo || 0)} moeda(s)` };
  return { ok: true, custo };
}

/** Pôr operários para alugar (ou tirar: quantidade 0). Preço por operário, por 24 h. */
export function podeOfertar({ quantidade, preco, operarios }) {
  const q = Number(quantidade), p = Number(preco);
  if (!Number.isInteger(q) || q < 0) return { ok: false, motivo: "escolha quantos operários quer alugar" };
  if (q > (operarios || 0)) return { ok: false, motivo: `você tem ${operarios || 0} operário(s)` };
  if (q === 0) return { ok: true, quantidade: 0, preco: 0 };
  if (!Number.isInteger(p) || p < PRECO_MINIMO_DO_ALUGUEL || p > PRECO_MAXIMO_DO_ALUGUEL) {
    return { ok: false, motivo: `o preço vai de ${PRECO_MINIMO_DO_ALUGUEL} a ${PRECO_MAXIMO_DO_ALUGUEL} moedas por operário` };
  }
  return { ok: true, quantidade: q, preco: p };
}

/**
 * Alugar operários de outro reino. `oferta`: { quantidade, preco } do dono; `jaAlugados`: quantos
 * dele estão alugados agora (para qualquer pessoa); `vagasLivres`: as da minha mina.
 */
export function podeAlugar({ souODono, oferta, jaAlugados = 0, quantidade, vagasLivres, saldo }) {
  if (souODono) return { ok: false, motivo: "esses operários já são seus" };
  if (!oferta || !(oferta.quantidade > 0)) return { ok: false, motivo: "esse reino não tem operários para alugar" };
  const disponiveis = Math.max(0, oferta.quantidade - jaAlugados);
  const q = Number(quantidade);
  if (!Number.isInteger(q) || q < 1) return { ok: false, motivo: "escolha quantos operários quer alugar" };
  if (q > disponiveis) return { ok: false, motivo: disponiveis ? `só ${disponiveis} operário(s) disponível(is) agora` : "os operários desse reino já estão todos alugados" };
  if (q > (vagasLivres || 0)) return { ok: false, motivo: vagasLivres ? `a sua Mina de Ouro só tem ${vagasLivres} vaga(s) livre(s)` : "a sua Mina de Ouro está lotada — melhore a mina para caber mais" };
  const custo = q * oferta.preco;
  if ((saldo || 0) < custo) return { ok: false, custo, motivo: `faltam ${custo - (saldo || 0)} moeda(s)` };
  return { ok: true, custo, quantidade: q };
}

/** O período de um aluguel que começa agora. */
export function periodoDoAluguel(agora = new Date()) {
  return { inicio: agora.toISOString(), fim: new Date(agora.getTime() + HORAS_DE_ALUGUEL * HORA).toISOString() };
}
