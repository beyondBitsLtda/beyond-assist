// O que está para hoje, e como vão as metas da semana e do mês.
//
// As metas de semana e mês são medidas em ASSUNTOS (cards) planejados para terminar no período,
// e não em pontos: "terminei os 3 assuntos desta semana" diz se a trilha anda no prazo; "fiz 150
// pontos" não diz. Os pontos ficam para a meta do dia, que é a que mantém o hábito.

import { inicioDaSemana, fimDaSemana, inicioDoMes, fimDoMes } from "./datas.js";

function noPeriodo(etapas, de, ate) {
  const planejadas = etapas.filter((e) => e.fim && e.fim >= de && e.fim <= ate);
  // Atraso de antes do período entra na conta dele: a semana só está em dia se o que ficou
  // para trás também foi feito.
  const atrasadas = etapas.filter((e) => e.fim && e.fim < de && !e.concluido);
  return {
    feitas: planejadas.filter((e) => e.concluido).length,
    total: planejadas.length + atrasadas.length,
    atrasadas: atrasadas.length,
  };
}

/** @param etapas  `{ fim, concluido }` de todas as trilhas ativas */
export function resumoDasMetas(etapas, hoje) {
  return {
    semana: { ...noPeriodo(etapas, inicioDaSemana(hoje), fimDaSemana(hoje)), de: inicioDaSemana(hoje), ate: fimDaSemana(hoje) },
    mes: { ...noPeriodo(etapas, inicioDoMes(hoje), fimDoMes(hoje)), de: inicioDoMes(hoje), ate: fimDoMes(hoje) },
  };
}

const PESO = { atrasada: 0, hoje: 1, adiantar: 2, feita: 3 };

/**
 * As etapas que aparecem na tela de hoje.
 *
 * - `atrasada`: o período acabou e o assunto não foi concluído.
 * - `hoje`: o período inclui hoje (ou já começou).
 * - `feita`: concluída hoje — continua na tela, porque sumir no instante em que se termina tira
 *   justamente a sensação de ter terminado.
 * - `adiantar`: a trilha não tem nada para hoje (fim de semana, ou tudo em dia), então o próximo
 *   assunto aparece para quem quiser adiantar.
 *
 * @param etapas  `{ trilhaId, ordem, inicio, fim, concluido, concluidoHoje }`
 */
export function tarefasDoDia(etapas, hoje) {
  const lista = [];
  const porTrilha = new Map();
  for (const e of etapas) {
    if (!porTrilha.has(e.trilhaId)) porTrilha.set(e.trilhaId, []);
    porTrilha.get(e.trilhaId).push(e);
  }

  for (const doTrilha of porTrilha.values()) {
    const ordenadas = [...doTrilha].sort((a, b) => a.ordem - b.ordem);
    let temPendenteHoje = false;
    for (const e of ordenadas) {
      if (e.concluidoHoje) {
        lista.push({ ...e, situacao: "feita" });
      } else if (!e.concluido && e.inicio && e.inicio <= hoje) {
        temPendenteHoje = true;
        lista.push({ ...e, situacao: e.fim < hoje ? "atrasada" : "hoje" });
      }
    }
    if (!temPendenteHoje) {
      const proxima = ordenadas.find((e) => !e.concluido && e.inicio && e.inicio > hoje);
      if (proxima) lista.push({ ...proxima, situacao: "adiantar" });
    }
  }

  return lista.sort((a, b) => PESO[a.situacao] - PESO[b.situacao] || (a.inicio || "").localeCompare(b.inicio || ""));
}
