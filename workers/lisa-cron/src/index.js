// O relógio da Lisa, e o carteiro dela.
//
// Existe por duas razões que se encontraram:
//
//  1. O Worker principal da Lisa tem o arquivo de entrada GERADO pelo adaptador a cada build,
//     então pendurar um agendamento nele significaria remendar código gerado toda vez. Sem este
//     arquivo a Lisa fica viva mas parada: não sincroniza o cérebro, não avisa de nada, e o Map
//     of Deploy nunca acumula histórico.
//
//  2. O `web-push` precisa de http/https/net do Node e não compilava junto com o app. Aqui, num
//     Worker com `nodejs_compat`, ele roda. Então a rota /api/cron/notify DETECTA e devolve a
//     fila, e quem ENVIA é aqui.
//
// É um Worker minúsculo que roda algumas vezes por hora: cabe folgado no plano gratuito.

/**
 * As rotas de cron da Lisa NÃO usam o mesmo segredo, e confundir os dois dá 401 silencioso:
 *
 *   - notify e deploy-check esperam `Authorization: Bearer <CRON_SECRET>`
 *   - sync espera `x-ingest-secret: <INGEST_SECRET>` — é o mesmo segredo do botão SYNC manual,
 *     porque é o mesmo trabalho
 */
const TAREFAS = {
  notify: { rota: "/api/cron/notify", segredo: "CRON_SECRET" },
  "deploy-check": { rota: "/api/cron/deploy-check", segredo: "CRON_SECRET" },
  "sync-reinicia": { rota: "/api/cron/sync?reset=1", segredo: "INGEST_SECRET" },
  "sync-avanca": { rota: "/api/cron/sync", segredo: "INGEST_SECRET" },
};

/**
 * Qual tarefa cada horário dispara. A Cloudflare entrega em `event.cron` o padrão que disparou.
 *
 * Repare que o sync são DUAS tarefas em horários diferentes, e é assim de propósito. Uma
 * sincronização completa não cabe numa chamada só (cada fatia tem teto de 60s), então o ciclo é:
 * de hora em hora alguém REINICIA o progresso, e alguém frequente AVANÇA uma fatia por vez. Só o
 * reinício, sem os avanços, deixa o ciclo parado em "running" para sempre — que foi exatamente o
 * bug da primeira versão deste arquivo.
 *
 * Por que o avanço pega carona no horário do notify em vez de ter o seu próprio: o plano
 * gratuito limita quantos Cron Triggers um Worker pode ter, e três já é o que temos. Pegar
 * carona não custa gatilho nenhum.
 */
const CRONS = {
  "*/5 * * * *": ["notify", "sync-avanca"],
  "*/15 * * * *": ["deploy-check"],
  "0 * * * *": ["sync-reinicia"],
};

/**
 * Quantas fatias tentar por disparo. Para na primeira que não tiver mais trabalho, então não
 * desperdiça chamada nenhuma quando o ciclo já acabou.
 *
 * Eram 2, que é mais ou menos o ritmo do agendamento antigo (a cada 2 min). Não serve mais: na
 * Cloudflare o passo do GitHub precisa de várias invocações só para BAIXAR os arquivos de cada
 * repositório (limite de 50 chamadas de saída por invocação — ver ingest/github.js). Com 16
 * repositórios a conta dá ~450 fatias por ciclo; a 24 por hora isso é quase um dia, mais tempo
 * do que a validade do snapshot, e o ciclo nunca fecharia.
 *
 * Cada fatia é uma chamada de saída deste Worker — o limite de 50 vale por invocação, então 5
 * cabe folgado, e o trabalho pesado acontece do outro lado.
 */
const FATIAS_POR_DISPARO = 5;

async function chamar(env, nome) {
  const tarefa = TAREFAS[nome];
  const headers =
    tarefa.segredo === "INGEST_SECRET"
      ? { "x-ingest-secret": env.INGEST_SECRET }
      : { authorization: `Bearer ${env.CRON_SECRET}` };

  const res = await fetch(env.LISA_URL + tarefa.rota, { headers });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${tarefa.rota} → ${res.status} ${texto.slice(0, 200)}`);
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/**
 * Avança o ciclo de sincronização algumas fatias.
 *
 * A rota devolve um `note` que diz o que aconteceu. Enquanto houver trabalho ele começa com
 * `passo "..."`; qualquer outra coisa ("sem ciclo em andamento", "ciclo concluído", "nenhuma
 * fonte configurada") significa que não adianta insistir agora.
 */
async function avancarSync(env) {
  const notas = [];
  for (let i = 0; i < FATIAS_POR_DISPARO; i++) {
    const resposta = await chamar(env, "sync-avanca");
    const nota = resposta?.note || "sem resposta";
    notas.push(nota);
    if (!nota.startsWith("passo ")) break;
  }
  return notas;
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

/** Roda as tarefas de um horário, em ordem, e devolve o que cada uma respondeu. Uma tarefa que
 *  falha não impede as outras — notificação atrasada não pode derrubar a sincronização. */
async function executar(env, nomes) {
  const saida = {};
  for (const nome of nomes) {
    try {
      if (nome === "sync-avanca") {
        saida[nome] = await avancarSync(env);
        continue;
      }
      const resposta = await chamar(env, nome);
      if (nome === "notify") {
        const envio = await enviarPendentes(env, resposta?.pendentes);
        saida.envio = envio;
        console.log(`[notify] ${envio.enviados} enviados, ${envio.removidos} inscrições mortas removidas`);
      }
      saida[nome] = resposta;
    } catch (err) {
      saida[nome] = { erro: err.message };
      console.error(`[cron] ${nome}: ${err.message}`);
    }
  }
  return saida;
}

export default {
  async scheduled(event, env, ctx) {
    const nomes = CRONS[event.cron];
    if (!nomes) return;
    ctx.waitUntil(executar(env, nomes));
  },

  /** Um GET no Worker dispara o mesmo trabalho, pra dar pra testar sem esperar o horário:
   *  `curl https://lisa-cron.SEU-SUBDOMINIO.workers.dev/?cron=*%2F5+*+*+*+*` */
  async fetch(req, env) {
    const cron = new URL(req.url).searchParams.get("cron");
    if (!cron || !CRONS[cron]) {
      const lista = Object.entries(CRONS)
        .map(([horario, nomes]) => `  ${horario}  →  ${nomes.join(", ")}`)
        .join("\n");
      return new Response(`use ?cron= com um destes:\n${lista}\n`, { status: 400 });
    }
    return Response.json({ ok: true, cron, resultado: await executar(env, CRONS[cron]) });
  },
};
