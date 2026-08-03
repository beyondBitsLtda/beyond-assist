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
