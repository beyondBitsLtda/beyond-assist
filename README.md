# Beyond Bits — assistente pessoal (HUD + cérebro RAG)

App Next.js que responde perguntas sobre seus dados do **Trello** e do **Beyond Brain**,
com uma interface HUD (estilo J.A.R.V.I.S.) ligada ao streaming real do Gemini.

> Fases 1–3 (cérebro/RAG) + interface (HUD ligado ao `/api/ask`). Voz ("Beyond") é a Fase 4.

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

## Estrutura

```
beyond-bits/
├─ .env                 # SEGREDOS (gitignored)
├─ .env.example         # modelo sem segredos (versionado)
├─ db/schema.sql        # pgvector + documents + match_documents
├─ src/
│  ├─ lib/
│  │  ├─ supabase.js    # cliente service_role (SERVER-ONLY)
│  │  ├─ gemini.js      # embeddings + chat streaming
│  │  ├─ rag.js         # busca + prompt + persona
│  │  └─ ingest/{chunk,trello,brain}.js
│  └─ app/
│     ├─ layout.js
│     ├─ page.js        # HUD (interface) ligado ao /api/ask
│     ├─ globals.css
│     └─ api/
│        ├─ ask/route.js    # SSE: context/token/done
│        └─ health/route.js # bolinhas de conexão
└─ scripts/{ingest,ask}.mjs
```

## Próximas fases

- **Fase 4 — Voz:** wake word "Beyond" (Picovoice), STT e TTS; máquina de estados real.
- **Fase 6 — Produção:** webhook do Trello para reindexar em tempo real, auth, hardening.
