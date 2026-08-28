-- ============================================================
--  Beyond Bits — schema do "cérebro" (RAG)
--  Rode isto UMA vez no SQL Editor do projeto Supabase do Beyond Brain.
-- ============================================================

-- 1) Extensão de vetores
create extension if not exists vector;

-- 2) Tabela de documentos indexados (Trello + Beyond Brain)
create table if not exists public.documents (
  id            bigint generated always as identity primary key,
  source        text not null,                 -- 'trello' | 'brain'
  external_id   text,                           -- id do card / da nota (+ #chunk)
  board         text,                           -- board do Trello ou ref da nota
  title         text,
  content       text not null,
  embedding     vector(768),                    -- bate com GEMINI_EMBED_DIM=768
  last_modified timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (source, external_id)                  -- permite upsert idempotente
);

-- 3) Índice de similaridade (cosseno)
create index if not exists documents_embedding_idx
  on public.documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists documents_source_idx on public.documents (source);
create index if not exists documents_last_modified_idx on public.documents (last_modified desc);

-- 4) Função de busca por similaridade
--    similarity = 1 - distância_cosseno  (1.0 = idêntico)
create or replace function public.match_documents(
  query_embedding vector(768),
  match_count     int   default 5,
  min_similarity  float default 0.0,
  filter_source   text  default null
)
returns table (
  id            bigint,
  source        text,
  external_id   text,
  board         text,
  title         text,
  content       text,
  last_modified timestamptz,
  metadata      jsonb,
  similarity    float
)
language sql stable
as $$
  select
    d.id, d.source, d.external_id, d.board, d.title, d.content,
    d.last_modified, d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
    and (filter_source is null or d.source = filter_source)
    and 1 - (d.embedding <=> query_embedding) >= min_similarity
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- 5) RLS: a tabela documents é acessada só pela service_role (servidor),
--    então habilitamos RLS sem policies públicas (nega qualquer acesso anon).
alter table public.documents enable row level security;
-- (a service_role ignora RLS por design; o cliente anon fica sem acesso)

-- ============================================================
--  Notificações push — rode esta seção UMA vez a mais (aditivo,
--  não mexe nas tabelas acima). Guarda inscrições de push e o
--  registro de "já avisei sobre isso", pra não repetir notificação
--  a cada ciclo de verificação do cron.
-- ============================================================

-- 6) Inscrições Web Push (uma por dispositivo/navegador que ativou notificações)
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- 7) Registro de eventos já notificados (idempotência do cron de notificação)
create table if not exists public.notified_events (
  id          bigint generated always as identity primary key,
  event_type  text not null,   -- 'ticket_new' | 'ticket_reopened' | 'ticket_sla_breach' | 'ticket_sla_near' | 'trello_card_new' | 'trello_task_overdue'
  entity_id   text not null,   -- id do chamado/card (composto com timestamp p/ eventos repetíveis, ex. reabertura)
  created_at  timestamptz not null default now(),
  unique (event_type, entity_id)
);

alter table public.notified_events enable row level security;
create index if not exists notified_events_type_idx on public.notified_events (event_type);

-- 8) Último status conhecido de cada chamado do Sentinela — necessário pra detectar
--    reabertura (Resolvido/Fechado → Aberto), já que a API do Sentinela não guarda
--    histórico de transição de status.
create table if not exists public.sentinel_ticket_snapshot (
  ticket_id   uuid primary key,
  status      text not null,
  checked_at  timestamptz not null default now()
);

alter table public.sentinel_ticket_snapshot enable row level security;
-- (as 3 tabelas acima só são acessadas pela service_role, nas rotas /api/notifications
-- e /api/cron/notify — mesmo padrão de "nega tudo pro anon" da tabela documents)

-- ============================================================
--  SYNC automático (a cada hora) — rode esta seção UMA vez a mais (aditivo).
--  Guarda o progresso do ciclo de reindexação disparado pelo pg_cron do Supabase
--  (ver db/cron.sql), já que uma sincronização completa não cabe numa única chamada
--  de função da Vercel (limite de 60s no plano Hobby) — o progresso avança 1 fatia por
--  minuto, e esta linha única (id=1) é onde cada tick sabe em que passo retomar.
-- ============================================================

-- 9) Progresso do ciclo de SYNC (linha única, id sempre 1)
create table if not exists public.sync_progress (
  id           int primary key default 1,
  status       text not null default 'idle',  -- 'idle' | 'running'
  step_index   int not null default 0,        -- índice do passo atual (boards do Trello + brain)
  offset_val   int not null default 0,        -- offset de chunks dentro do passo atual
  grand_total  int not null default 0,        -- total de chunks processados neste ciclo
  started_at   timestamptz,
  last_error   text,
  updated_at   timestamptz not null default now(),
  constraint sync_progress_singleton check (id = 1)
);

insert into public.sync_progress (id) values (1) on conflict (id) do nothing;

alter table public.sync_progress enable row level security;
-- (só acessada pela service_role, em /api/cron/sync — mesmo padrão das tabelas acima)

-- ============================================================
--  Notificações DENTRO do app (a mais, aditivo) — antes o título/corpo da notificação
--  era montado só pra mandar o push e descartado; agora fica salvo, pra a aba aberta
--  também poder mostrar um aviso na tela + falar em voz alta, sem esperar o push do SO
--  (que exige permissão do navegador e só funciona por fora da aba).
-- ============================================================

-- 10) Guarda o texto de cada evento — /api/notifications/recent lê daqui
alter table public.notified_events add column if not exists title text;
alter table public.notified_events add column if not exists body  text;
alter table public.notified_events add column if not exists url   text;
create index if not exists notified_events_created_idx on public.notified_events (created_at);

-- ============================================================
--  Comandos remotos (a mais, aditivo) — "abre o dashboard" falado num dispositivo (ex.:
--  celular) navega os OUTROS dispositivos com o app aberto (desktop, TV em Modo TV...) pra
--  aquela tela, sem tocar no que deu o comando. Mesmo padrão de fila curta que as
--  notificações: cada dispositivo tem um id salvo no navegador e faz polling rápido
--  (ver src/lib/deviceId.js e src/components/shell/RemoteCommandListener.js).
-- ============================================================

-- 11) Fila de comandos — linhas antigas não importam, só as mais novas que o último
--     "since" de cada dispositivo (não precisa marcar como "lido")
create table if not exists public.remote_commands (
  id            bigint generated always as identity primary key,
  action        text not null,          -- só 'navigate' por enquanto
  target        text not null,          -- rota, ex.: '/dashboard'
  origin_device text not null,          -- id do dispositivo que mandou (ele mesmo ignora)
  created_at    timestamptz not null default now()
);

create index if not exists remote_commands_created_idx on public.remote_commands (created_at);
alter table public.remote_commands enable row level security;
-- (só acessada pela service_role, em /api/remote-command — mesmo padrão das tabelas acima)

-- ============================================================
--  Fix: criar nota nova pela aplicação (a mais, aditivo) — a tabela `notes` (criada fora
--  deste arquivo, antes deste app existir) tem `user_id` como NOT NULL, provavelmente
--  pensada pra um esquema com login (auth.users). Este app não tem login — é de uso
--  pessoal — e só preenche `user_id` se a env var BRAIN_USER_ID estiver configurada (ver
--  src/lib/notes.js); sem ela, o insert falhava com "null value in column user_id".
--  Relaxar o NOT NULL resolve sem precisar descobrir/inventar um UUID de usuário.
-- ============================================================

-- 12) Permite user_id nulo em notes — só afeta linhas novas sem BRAIN_USER_ID configurada;
--     linhas existentes (com ou sem user_id) continuam exatamente como estão.
alter table public.notes alter column user_id drop not null;
