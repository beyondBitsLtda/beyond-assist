// O relógio da Lisa, e o carteiro dela.
//
// Existe por duas razões que se encontraram:
//
//  1. Cloudflare Pages NÃO tem agendamento. Quem tem Cron Triggers é o Workers. Sem este
//     arquivo a Lisa fica viva mas parada: não sincroniza o cérebro, não avisa de nada, e o Map
//     of Deploy nunca acumula histórico.
//
//  2. O `web-push` precisa de http/https/net do Node e não compila no Edge runtime do Pages —
//     foi a única coisa do app inteiro que não passou. Aqui, num Worker com `nodejs_compat`,
//     ele roda. Então a rota /api/cron/notify DETECTA e devolve a fila, e quem ENVIA é aqui.
//
// É um Worker minúsculo que roda algumas vezes por hora: cabe folgado no plano gratuito.

/** Qual rota cada horário chama. A Cloudflare entrega em `event.cron` o padrão que disparou,
 *  então um Worker só dá conta dos três. */
const ROTAS = {
  "*/5 * * * *": "/api/cron/notify",
  "*/15 * * * *": "/api/cron/deploy-check",
  "0 * * * *": "/api/cron/sync",
};

async function chamar(env, rota) {
  const res = await fetch(env.LISA_URL + rota, {
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${rota} → ${res.status} ${texto.slice(0, 200)}`);
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/**
 * Envia o que a rota de notificação deixou na fila.
 *
 * Inscrição morta (404/410) é apagada: o navegador foi desinstalado ou a permissão revogada, e
 * insistir nela desperdiça uma tentativa a cada cinco minutos, para sempre. Qualquer outro erro
 * é ignorado neste ciclo — uma rede instável não pode derrubar os avisos dos outros aparelhos.
 */
async function enviarPendentes(env, pendentes) {
  if (!pendentes?.length) return { enviados: 0, removidos: 0 };

  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  let enviados = 0;
  let removidos = 0;

  for (const item of pendentes) {
    await Promise.all(
      (item.inscricoes || []).map(async (inscricao) => {
        try {
          await webpush.sendNotification(inscricao, item.payload);
          enviados++;
        } catch (err) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            removidos++;
            await fetch(env.LISA_URL + "/api/notifications/subscribe", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ endpoint: inscricao.endpoint }),
            }).catch(() => {});
          }
        }
      })
    );
  }
  return { enviados, removidos };
}

export default {
  async scheduled(event, env, ctx) {
    const rota = ROTAS[event.cron];
    if (!rota) return;

    ctx.waitUntil(
      (async () => {
        const resposta = await chamar(env, rota);
        if (rota === "/api/cron/notify") {
          const envio = await enviarPendentes(env, resposta?.pendentes);
          console.log(`[notify] ${envio.enviados} enviados, ${envio.removidos} inscrições mortas removidas`);
        }
      })().catch((err) => console.error(`[cron] ${rota}: ${err.message}`))
    );
  },

  /** Um GET no Worker dispara o mesmo trabalho, pra dar pra testar sem esperar o horário:
   *  `curl https://lisa-cron.SEU-SUBDOMINIO.workers.dev/?cron=*%2F5+*+*+*+*` */
  async fetch(req, env, ctx) {
    const cron = new URL(req.url).searchParams.get("cron");
    if (!cron || !ROTAS[cron]) {
      return new Response(`use ?cron= com um destes:\n${Object.keys(ROTAS).join("\n")}\n`, { status: 400 });
    }
    const resposta = await chamar(env, ROTAS[cron]);
    const extra = ROTAS[cron] === "/api/cron/notify" ? await enviarPendentes(env, resposta?.pendentes) : null;
    return Response.json({ ok: true, rota: ROTAS[cron], resposta, envio: extra });
  },
};
