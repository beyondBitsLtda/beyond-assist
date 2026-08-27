# Beyond Bits — assistente pessoal (HUD + cérebro RAG)

App Next.js que responde perguntas sobre seus dados do **Trello** e do **Beyond Brain**,
com uma interface HUD (estilo J.A.R.V.I.S.) ligada ao streaming real do Gemini.

> Fases 1–3 (cérebro/RAG) + interface (HUD ligado ao `/api/ask`). Voz (a assistente se chama "Lisa") é a Fase 4.

---

## ⚠️ Segurança — leia antes de subir pro GitHub

- O arquivo **`.env` contém segredos** (Gemini, Supabase *service_role*, Trello). Ele **já está no `.gitignore`** — **não** o remova de lá e **não** o commite.
- A **`SUPABASE_SERVICE_ROLE_KEY` é a chave-mestra do banco** (ignora RLS). Ela só é usada no **servidor** (`src/lib/supabase.js`, rotas de API e scripts). **Nunca** a coloque em código de cliente nem em variável `NEXT_PUBLIC_*`.
- Suas chaves apareceram em prints/arquivos compartilhados. O ideal é **regenerá-las** antes de usar em produção: Gemini (AI Studio → nova chave), Trello (`trello.com/app-key` → revogar token), Supabase (Settings → API → roll da service key). Depois é só atualizar o `.env` e as variáveis na Vercel.

---

## 1. Instalar

```bash
npm install
```

## 2. Criar o schema no Supabase

Abra o **SQL Editor** do projeto do Beyond Brain (`wcwikmszduuqlytikjwq`), cole o conteúdo de
`db/schema.sql` e rode. Isso ativa o `pgvector`, cria a tabela `documents` e a função `match_documents`.

## 3. Indexar seus dados

```bash
npm run ingest
```

Puxa os 4 boards do Trello + suas notas do Beyond Brain, gera embeddings (768d) e grava no banco.

## 4. Testar o cérebro por texto (sem interface)

```bash
npm run ask "quais clientes do CRM estão em negociação?"
```

Se responder com base nos seus dados, o cérebro está validado.

## 5. Rodar a interface (HUD)

```bash
npm run dev
```

Acesse `http://localhost:3000`. Digite uma pergunta na barra inferior e tecle **Enter**:
os cards da direita são preenchidos pelo RAG real e a resposta aparece em streaming no centro.

---

## Deploy na Vercel

1. Suba o repositório no GitHub (o `.env` **não** vai junto — é o esperado).
2. Na Vercel: **New Project** → importe o repo.
3. **Settings → Environment Variables**: cole **cada variável do `.env`** (mesmos nomes e valores).
   As variáveis de `db/schema.sql` continuam no Supabase; aqui vão só as do `.env`.
4. Deploy. A Vercel injeta as variáveis no servidor — as chaves nunca chegam ao navegador.

> A ingestão (`npm run ingest`) roda no seu terminal ou num cron; a Vercel serve a interface e a API.

---

## SYNC — como funciona, e como automatizar de hora em hora

O botão **◈ SYNC** (Topbar, aparece em toda aba) é o **único** jeito de puxar dado fresco de
verdade: ele lê o Trello + Beyond Brain, gera embeddings (Gemini) e grava em `public.documents`
(Supabase). O **↻ ATUALIZAR** de cada painel é outra coisa — só recarrega a tela com o que já
está indexado (rápido, sem custo de API); os painéis de Trello (Kanban, Boards, Dashboard,
Tarefas) ficam desatualizados até um SYNC rodar, mesmo clicando em "atualizar".

Como o plano Hobby da Vercel limita funções a 60s e o Gemini tem cota de embeddings por
minuto, uma sincronização completa é fatiada em várias chamadas pequenas a `/api/ingest`
(≤20 chunks por chamada) — é por isso que o SYNC "demora" e mostra progresso nos logs, em vez
de ser instantâneo.

**Pra rodar isso (e as notificações push) automaticamente, sem precisar clicar em nada:**

1. Rode `db/schema.sql` (se ainda não rodou) — cria `public.sync_progress`, que guarda o
   progresso do ciclo automático.
2. Rode `db/cron.sql` no SQL Editor do Supabase, depois de trocar os placeholders (domínio +
   `INGEST_SECRET` + `CRON_SECRET`) pelos valores reais. Isso agenda, via `pg_cron` + `pg_net`
   (extensões nativas do Supabase, sem custo extra):
   - **SYNC** — a cada hora (minuto 0) reinicia o ciclo, e a cada minuto avança uma fatia
     (`/api/cron/sync`) — sem custo quando não há ciclo em andamento;
   - **Notificações** — a cada 5 min chama `/api/cron/notify` (chamado novo/reaberto, SLA
     estourando, tarefa atrasada).

O progresso do SYNC mora inteiro no Postgres (`public.sync_progress`, linha única) — a Vercel
não precisa ficar "acordada" entre os ticks, e reiniciar o deploy não perde o lugar onde parou.
O Topbar mostra um indicador **AUTO-SYNC** com a última execução (passe o mouse pra detalhes).

⚠️ **Por que isso não está em `vercel.json`:** o plano Hobby da Vercel só permite cron nativo
**1x por dia** — um cron mais frequente que isso **falha o deploy inteiro** (foi o que aconteceu:
o `/api/cron/notify` ficou configurado pra rodar a cada 5 min em `vercel.json`, e isso quebrou
todo deploy subsequente por dias, sem sintoma óbvio além do "X" nos checks do GitHub). Por isso
os dois crons agora são agendados pelo **Supabase** (que não tem esse limite), e `vercel.json`
ficou vazio — as rotas continuam sendo funções normais da Vercel, só não são mais "cron jobs"
aos olhos dela.

---

## Estrutura

```
beyond-bits/
├─ .env                 # SEGREDOS (gitignored)
├─ .env.example         # modelo sem segredos (versionado)
├─ vercel.json          # vazio de propósito — crons vivem no Supabase, não aqui (ver db/cron.sql)
├─ db/
│  ├─ schema.sql        # pgvector + documents + match_documents + sync_progress
│  └─ cron.sql          # agenda SYNC (1x/hora) e notificações (1x/5min) via pg_cron + pg_net
├─ src/
│  ├─ lib/
│  │  ├─ supabase.js    # cliente service_role (SERVER-ONLY)
│  │  ├─ gemini.js      # embeddings + chat streaming
│  │  ├─ rag.js         # busca + prompt + persona (Lisa)
│  │  ├─ sync.js         # loop do botão SYNC manual (navegador)
│  │  └─ ingest/{chunk,trello,brain,runSlice}.js  # runSlice = 1 fatia, usado pelo manual E pelo cron
│  └─ app/
│     ├─ layout.js
│     ├─ page.js        # HUD (interface) ligado ao /api/ask
│     ├─ globals.css
│     └─ api/
│        ├─ ask/route.js         # SSE: context/token/done
│        ├─ ingest/route.js      # 1 fatia de reindexação (botão SYNC manual)
│        ├─ sync-status/route.js # status do SYNC automático (indicador AUTO-SYNC no Topbar)
│        ├─ cron/sync/route.js   # 1 fatia de reindexação (tick automático — Supabase pg_cron)
│        ├─ cron/notify/route.js # notificações push (tick automático — Supabase pg_cron)
│        └─ health/route.js      # bolinhas de conexão
└─ scripts/{ingest,ask}.mjs
```

## Próximas fases

- **Fase 4 — Voz:** wake word "Lisa" (Picovoice), STT e TTS; máquina de estados real.
- **Fase 6 — Produção:** webhook do Trello para reindexar em tempo real, auth, hardening.
