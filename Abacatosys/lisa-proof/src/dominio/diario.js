// O DIÁRIO DE ESTUDO (pedido de 31/10/2026, da proposta dos cursos que não são de programação): por
// trilha, uma entrada por dia — o que aprendi e onde travei. Não tem nota; escrever conta para a
// ofensiva e dá uns poucos pontos, uma vez por dia. Onde a pessoa travou entra no pedido do exercício
// do dia seguinte, para a Lisa trabalhar o ponto fraco. Puro.

export const LIMITES_DO_DIARIO = { aprendi: 1500, travei: 1500, minimo: 15, ultimas: 14 };
export const PONTOS_DO_DIARIO = 5;
export const chaveDoDiario = (dia) => `diario:${dia}`;

const texto = (v, max) => String(v ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

/** A entrada conferida. Lança erro com o motivo. */
export function validarEntradaDoDiario(bruto) {
  const aprendi = texto(bruto?.aprendi, LIMITES_DO_DIARIO.aprendi);
  const travei = texto(bruto?.travei, LIMITES_DO_DIARIO.travei);
  if (aprendi.length < LIMITES_DO_DIARIO.minimo) throw new Error("conte em uma ou duas frases o que você aprendeu hoje");
  return { aprendi, travei };
}

/** Onde a pessoa travou nos últimos dias (mais recente primeiro), para o pedido do exercício. */
export function pontosFracos(entradas, maximo = 2) {
  return (entradas || []).filter((e) => String(e?.travei || "").trim()).slice(0, maximo).map((e) => texto(e.travei, 300));
}
