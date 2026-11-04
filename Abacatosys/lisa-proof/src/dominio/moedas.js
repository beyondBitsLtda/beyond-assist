// As moedas do Reino com CENTAVOS (23/10/2026: "ponha centavos também no dinheiro, pois na bolsa
// tem, e quando o usuário vende ação esses centavos não contam"). Puro.
//
// Tudo o que é dinheiro passa por `centavos` (duas casas, sem o lixo da conta em ponto flutuante:
// 0,1 + 0,2 vira 0,3 e não 0,30000000000000004). Preços de construção, tropa e veículo continuam
// redondos; o que tem centavos vem da bolsa.

export const centavos = (x) => Math.round((Number(x) || 0) * 100 + Number.EPSILON) / 100;

const comCentavos = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const redondo = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "1.234" quando é redondo, "1.234,56" quando tem centavos (ou sempre com centavos, se pedir). */
export function formatarMoedas(x, { sempreComCentavos = false } = {}) {
  const v = centavos(x);
  return sempreComCentavos || !Number.isInteger(v) ? comCentavos.format(v) : redondo.format(v);
}

/** O motivo de "não dá": "faltam 293 moeda(s)" ou "faltam 292,65 moeda(s)". */
export const faltam = (custo, saldo) => `faltam ${formatarMoedas(centavos(custo) - centavos(saldo))} moeda(s)`;
