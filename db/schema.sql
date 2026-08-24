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
