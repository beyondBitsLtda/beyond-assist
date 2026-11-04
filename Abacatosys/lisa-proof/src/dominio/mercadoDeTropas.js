// O MERCADO DE TROPAS (pedido de 30/10/2026: "poder vender membros das tropas de defesa e do
// exército para liberar espaço; assim que a pessoa põe as tropas à venda, elas já saem, liberam
// espaço e ficam à venda para outros jogadores comprarem"). Puro — o banco mora em src/lib/reino.js.
//
//   ANUNCIAR — as tropas saem NA HORA da reserva (exército ou defesa) e viram um anúncio: o espaço
//              fica livre e elas não lutam mais por ninguém até alguém comprar. O preço é por
//              tropa, de 20% ao custo do treino: ninguém paga mais do que pagaria para treinar, e
//              moeda não se multiplica (quem vende já gastou ao menos isso para treinar).
//   COMPRAR  — quem compra escolhe a reserva dele e segue as MESMAS regras do treino (podeReceber):
//              a construção, o nível dela para a tropa, o espaço e a lotação do Acampamento. Paga o
//              preço do anúncio, e o vendedor recebe na hora. Dá para comprar só parte do anúncio.
//   RETIRAR  — o vendedor desiste do que sobrou: as tropas voltam para a reserva de onde saíram,
//              se ainda couberem lá.

import { TROPAS, ORDEM_DAS_TROPAS, RESERVAS, contagens, podeReceber } from "./tropas.js";
import { faltam } from "./moedas.js";

export const ANUNCIOS_POR_REINO = 10;
export const MAXIMO_POR_ANUNCIO = 60;
const PISO_DO_PRECO = 0.2;
const PRECO_SUGERIDO = 0.6;
const NA_RESERVA = { exercito: "no exército", guarnicao: "na defesa" };

/** O preço por tropa que um anúncio aceita: de 20% ao custo do treino (sugerido: 60%). */
export function faixaDePreco(tropa) {
  const custo = TROPAS[tropa]?.custo || 0;
  return {
    minimo: Math.max(1, Math.round(custo * PISO_DO_PRECO)),
    maximo: custo,
    sugerido: Math.max(1, Math.round(custo * PRECO_SUGERIDO)),
  };
}

/** Quanto mais barato que treinar (40 = "40% mais barato"). */
export function descontoSobreOTreino(tropa, preco) {
  const custo = TROPAS[tropa]?.custo || 0;
  return custo ? Math.round((1 - preco / custo) * 100) : 0;
}

/**
 * Pôr tropas à venda. `origem`: "exercito" ou "guarnicao"; `abertos`: quantos anúncios a pessoa
 * já tem no mercado. Devolve também quanto espaço o anúncio libera.
 */
export function podeAnunciar({ tropa, quantidade, preco, origem, reservas, abertos = 0 }) {
  const def = TROPAS[tropa];
  if (!def) return { ok: false, motivo: "tropa desconhecida" };
  if (!RESERVAS[origem]) return { ok: false, motivo: "vender do exército ou da defesa?" };
  const q = Number(quantidade);
  if (!Number.isInteger(q) || q < 1 || q > MAXIMO_POR_ANUNCIO) return { ok: false, motivo: `escolha de 1 a ${MAXIMO_POR_ANUNCIO} tropas` };
  const tem = contagens(reservas?.[origem])[tropa] || 0;
  if (q > tem) return { ok: false, motivo: tem ? `você tem só ${tem} ${def.nome}(s) ${NA_RESERVA[origem]}` : `não há ${def.nome} ${NA_RESERVA[origem]}` };
  const faixa = faixaDePreco(tropa);
  const p = Number(preco);
  if (!Number.isInteger(p) || p < faixa.minimo || p > faixa.maximo) {
    return { ok: false, motivo: `o preço de ${def.nome} vai de ${faixa.minimo} a ${faixa.maximo} moedas por tropa` };
  }
  if (abertos >= ANUNCIOS_POR_REINO) return { ok: false, motivo: `você já tem ${ANUNCIOS_POR_REINO} anúncios no mercado — retire um ou espere vender` };
  return { ok: true, quantidade: q, preco: p, libera: q * def.espaco };
}

/** O anúncio ainda tem tropas à venda? */
const aberto = (anuncio) => Boolean(anuncio) && anuncio.status === "aberta" && anuncio.restante > 0;

/** Comprar `quantidade` tropas de um anúncio para a reserva `destino` de quem compra. */
export function podeComprarDoMercado({ anuncio, usuarioId, quantidade, destino, niveis, reservas, saldo }) {
  if (!aberto(anuncio)) return { ok: false, motivo: "esse anúncio já foi vendido ou retirado" };
  if (anuncio.vendedor_id === usuarioId) return { ok: false, motivo: "essas tropas são suas — retire o anúncio para tê-las de volta" };
  const q = Number(quantidade);
  if (!Number.isInteger(q) || q < 1) return { ok: false, motivo: "escolha quantas tropas quer comprar" };
  if (q > anuncio.restante) return { ok: false, motivo: `só sobraram ${anuncio.restante} nesse anúncio` };
  const cabe = podeReceber({ tropa: anuncio.tropa, quantidade: q, destino, niveis, reservas });
  if (!cabe.ok) return cabe;
  const custo = q * anuncio.preco;
  if ((saldo || 0) < custo) return { ok: false, custo, motivo: faltam(custo, saldo) };
  return { ok: true, custo, quantidade: q };
}

/** O máximo que dá para comprar de um anúncio agora para `destino` (0 = nenhuma) e, se 0, o porquê. */
export function maximoParaComprar({ anuncio, usuarioId, destino, niveis, reservas, saldo }) {
  const pedido = { anuncio, usuarioId, destino, niveis, reservas, saldo };
  for (let q = Math.min(anuncio?.restante || 0, MAXIMO_POR_ANUNCIO); q > 0; q--) {
    if (podeComprarDoMercado({ ...pedido, quantidade: q }).ok) return { maximo: q, motivo: "" };
  }
  return { maximo: 0, motivo: podeComprarDoMercado({ ...pedido, quantidade: 1 }).motivo || "" };
}

/** O vendedor retira o que sobrou: as tropas voltam para a reserva de onde saíram, se couberem. */
export function podeRetirarAnuncio({ anuncio, usuarioId, niveis, reservas }) {
  if (!anuncio || anuncio.vendedor_id !== usuarioId) return { ok: false, motivo: "esse anúncio não é seu" };
  if (!aberto(anuncio)) return { ok: false, motivo: "esse anúncio já foi vendido ou retirado" };
  const cabe = podeReceber({ tropa: anuncio.tropa, quantidade: anuncio.restante, destino: anuncio.origem, niveis, reservas });
  if (!cabe.ok) return { ok: false, motivo: `não cabem de volta: ${cabe.motivo}` };
  return { ok: true, quantidade: anuncio.restante };
}

/** O anúncio depois de vender `quantidade`: o que sobra e se ainda está aberto. */
export function anuncioDepoisDaVenda(anuncio, quantidade) {
  const restante = Math.max(0, (anuncio?.restante || 0) - quantidade);
  return { restante, status: restante > 0 ? "aberta" : "vendida" };
}

/** A vitrine: na ordem do catálogo de tropas e, em cada tropa, do mais barato ao mais caro (o mais antigo desempata). */
export function ordenarOfertas(anuncios) {
  const ordem = (t) => { const i = ORDEM_DAS_TROPAS.indexOf(t); return i < 0 ? ORDEM_DAS_TROPAS.length : i; };
  return [...(anuncios || [])].sort((a, b) =>
    ordem(a.tropa) - ordem(b.tropa) || a.preco - b.preco || String(a.criado_em).localeCompare(String(b.criado_em)));
}
