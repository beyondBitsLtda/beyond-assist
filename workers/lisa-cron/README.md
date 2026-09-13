# lisa-cron

O relógio e o carteiro da Lisa. Projeto separado de propósito — ver o comentário no topo de
`src/index.js`.

Faz duas coisas:

1. **Agenda.** Cloudflare Pages não tem Cron Triggers; Workers tem. Este Worker chama as três
   rotas de cron da Lisa nos horários certos.
2. **Envia as notificações.** O `web-push` não compila no Edge runtime do Pages (precisa de
   `http`/`https`/`net` do Node). A rota `/api/cron/notify` detecta o que merece virar aviso e
   devolve a fila; este Worker envia.

## Subir

```bash
cd workers/lisa-cron
npm install
npx wrangler secret put CRON_SECRET        # o MESMO valor que está na Lisa
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY   # o valor de NEXT_PUBLIC_VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler deploy
```

Antes de subir, ajuste `LISA_URL` no `wrangler.jsonc` para o endereço da Lisa.

## Testar sem esperar o horário

```bash
curl "https://lisa-cron.SEU-SUBDOMINIO.workers.dev/?cron=*/15+*+*+*+*"
npx wrangler tail          # acompanha os tiques de verdade
```
