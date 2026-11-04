// O Worker do Proof: o do OpenNext (todas as páginas e rotas) mais o RELÓGIO DA LISA (03/11/2026: "não tô vendo a
// Lisa ativa; quero ver ela jogando mais vezes"). O gatilho de horário (triggers.crons no wrangler.jsonc) chama a
// rodada dela pela própria rota /api/lisa/rodada, com o segredo PROOF_SEGREDO_DO_RELOGIO (configurado no painel
// com `wrangler secret put`). Antes, quem chamava era um crontab no iMac, que nunca ficou ligado.

import openNext from "./.open-next/worker.js";

// as classes que o OpenNext exporta precisam sair daqui também
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export default {
  fetch: openNext.fetch,
  async scheduled(evento, env, ctx) {
    const pedido = new Request("https://proof.beyond.dev.br/api/lisa/rodada", {
      method: "POST",
      headers: { "x-proof-relogio": env.PROOF_SEGREDO_DO_RELOGIO || "" },
    });
    ctx.waitUntil(openNext.fetch(pedido, env, ctx).then(async (r) => {
      if (!r.ok) console.log("relógio da Lisa:", r.status, (await r.text()).slice(0, 300));
    }));
  },
};
