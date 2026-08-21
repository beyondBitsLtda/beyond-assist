/**
 * Limites de data (hoje/amanhã/semana) em horário de São Paulo (UTC-3),
 * compartilhados entre /api/tasks e /api/tasks-summary.
 */
export function getDateBoundaries() {
  const now = new Date();
  const tz = -3 * 60; // minutos
  const local = new Date(now.getTime() + (tz - now.getTimezoneOffset()) * 60000);
  const y = local.getFullYear(), m = local.getMonth(), d = local.getDate();

  const startOfToday = new Date(Date.UTC(y, m, d, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
  const endOfToday = new Date(startOfToday.getTime() + 24 * 3600 * 1000);
  const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 3600 * 1000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 3600 * 1000);

  return { startOfToday, endOfToday, endOfTomorrow, endOfWeek };
}
