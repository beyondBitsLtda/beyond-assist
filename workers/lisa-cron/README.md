# lisa-cron

O relógio e o carteiro da Lisa. Projeto separado de propósito — ver o comentário no topo de
`src/index.js`.

Faz duas coisas:

1. **Agenda.** O arquivo de entrada do Worker principal é gerado pelo adaptador a cada build,
   então o agendamento mora aqui em vez de ser remendado lá toda vez. Este Worker chama as rotas
   de cron da Lisa nos horários certos.
2. **Envia as notificações.** O `web-push` precisa de `http`/`https`/`net` do Node e não
   compilava junto com o app. A rota `/api/cron/notify` detecta o que merece virar aviso e
   devolve a fila; este Worker envia.

## Os horários

| Horário (UTC)    | O que dispara                              |
| ---------------- | ------------------------------------------ |
| `*/5 * * * *`    | notificações **+ avanço do ciclo de sync**  |
| `*/15 * * * *`   | Map of Deploy                              |
| `0 * * * *`      | reinício do ciclo de sync (`?reset=1`)     |

O sync são **duas** tarefas, e é assim de propósito: uma sincronização completa não cabe numa
chamada só (cada fatia tem teto de 60s), então de hora em hora alguém reinicia o progresso e
alguém frequente avança uma fatia por vez. Só o reinício, sem os avanços, deixa o ciclo parado em
"running" para sempre.

O avanço pega carona no horário das notificações em vez de ter o seu próprio porque o plano
gratuito limita quantos Cron Triggers um Worker pode ter, e três já é o que temos.

## Subir

```bash
cd workers/lisa-cron
npm install
npx wrangler secret put CRON_SECRET        # o MESMO valor que está na Lisa
npx wrangler secret put INGEST_SECRET      # idem — é o segredo que a rota de sync exige
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY   # o valor de NEXT_PUBLIC_VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler deploy
```

São **cinco** segredos, e os dois primeiros não são intercambiáveis: `notify` e `deploy-check`
esperam `Authorization: Bearer <CRON_SECRET>`, e `sync` espera `x-ingest-secret:
<INGEST_SECRET>` — é o mesmo segredo do botão SYNC manual, porque é o mesmo trabalho. Trocar os
dois dá 401 calado: o Worker roda no horário, a rota recusa, e nada acontece.

Antes de subir, ajuste `LISA_URL` no `wrangler.jsonc` para o endereço da Lisa.

## Testar

```bash
npm run cron-check        # na RAIZ do repositório — confere a lógica sem subir nada
```

Depois de publicado, para disparar na hora em vez de esperar o horário:

```bash
curl "https://lisa-cron.SEU-SUBDOMINIO.workers.dev/?cron=*/15+*+*+*+*"
npx wrangler tail          # acompanha os tiques de verdade
```
