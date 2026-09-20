/** Resposta JSON sem cache. `no-store` em TODA rota de API é deliberado: quadro e card mudam a
 *  cada segundo, e uma resposta guardada em cache mostraria o passado sem avisar. */
export function json(corpo, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cabecalhos },
  });
}
