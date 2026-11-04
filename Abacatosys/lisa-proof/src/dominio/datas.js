// Dias de calendário, sempre no fuso de São Paulo.
//
// Tudo aqui trabalha com o texto "AAAA-MM-DD", e não com Date. Um Date carrega hora e fuso, e
// a ofensiva é uma conta de DIAS: um estudo às 23h de segunda feito no Worker (que roda em UTC)
// viraria terça, e a sequência quebraria sem a pessoa ter faltado.

export const FUSO = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
});

/** O dia de calendário (em São Paulo) de um instante. */
export function diaDe(instante = new Date()) {
  const partes = Object.fromEntries(formatador.formatToParts(instante).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function paraUTC(dia) {
  const [a, m, d] = String(dia).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export const somarDias = (dia, n) => deUTC(paraUTC(dia) + n * 86_400_000);

/** 0 = domingo ... 6 = sábado. */
export const diaDaSemana = (dia) => new Date(paraUTC(dia)).getUTCDay();

export const diasEntre = (de, ate) => Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000);

/** A semana começa na segunda: é como a pessoa pensa "esta semana de estudo". */
export const inicioDaSemana = (dia) => somarDias(dia, -((diaDaSemana(dia) + 6) % 7));
export const fimDaSemana = (dia) => somarDias(inicioDaSemana(dia), 6);

export const inicioDoMes = (dia) => `${String(dia).slice(0, 7)}-01`;
export function fimDoMes(dia) {
  const [a, m] = String(dia).split("-").map(Number);
  return deUTC(Date.UTC(a, m, 0));
}

/** É um "AAAA-MM-DD" que existe no calendário? (31/02 não passa.) */
export function diaValido(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto || ""))) return false;
  return deUTC(paraUTC(texto)) === texto;
}

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const NOMES_DOS_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "06/10" ou "ter, 06/10". */
export function formatarDia(dia, { comSemana = false } = {}) {
  if (!dia) return "";
  const [, m, d] = String(dia).split("-");
  const curto = `${d}/${m}`;
  return comSemana ? `${SEMANA_CURTA[diaDaSemana(dia)]}, ${curto}` : curto;
}
