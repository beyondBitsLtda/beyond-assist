/**
 * Datas escritas por gente viram instantes absolutos.
 *
 * Puro: nenhuma dependência, nenhum relógio escondido. O fuso entra por parâmetro porque o
 * servidor não tem como adivinhá-lo — e adivinhar errado é o defeito que já apareceu duas
 * vezes neste sistema.
 */

/**
 * "2026-10-05" e "2026-10-05 17:00" não dizem em que fuso estão.
 *
 * O servidor roda em UTC. Interpretar ali faria "17:00" virar 14:00 para quem escreveu no
 * Brasil — foi exatamente isto que aconteceu no campo de prazo da tela, e um prazo errado em
 * três horas é pior que prazo nenhum, porque ninguém desconfia dele.
 *
 * `fusoMinutos` é o que `Date.prototype.getTimezoneOffset()` devolve no navegador de quem
 * está pedindo: 180 no horário de Brasília.
 *
 * SEM HORA, O PRAZO É O FIM DO DIA. "Entrega dia 5" quer dizer "até o fim do dia 5", e não
 * "à meia-noite, quando o dia 5 começa" — que adiantaria o prazo em um dia inteiro.
 */
export function paraInstante(texto, fusoMinutos = 180) {
  const bruto = String(texto || "").trim();
  if (!bruto) return null;

  // Já veio com fuso (Z ou ±hh:mm): o próprio texto manda, e não há o que interpretar.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(bruto)) {
    const d = new Date(bruto);
    return isNaN(d) ? null : d.toISOString();
  }

  const m = bruto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, ano, mes, dia, hora, minuto] = m;

  const temHora = hora !== undefined;
  const h = temHora ? Number(hora) : 23;
  const min = temHora ? Number(minuto) : 59;

  // Date.UTC monta o instante como se o texto fosse UTC; somar o deslocamento o traz para o
  // fuso de quem escreveu.
  const utc = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), h, min, temHora ? 0 : 59);
  const d = new Date(utc + fusoMinutos * 60000);
  return isNaN(d) ? null : d.toISOString();
}
