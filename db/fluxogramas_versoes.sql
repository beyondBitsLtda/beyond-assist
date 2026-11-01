-- ============================================================
--  PROCESSMAP NA LISA — versões anteriores dos fluxogramas (01/11/2026)
--
--  Rodar (é idempotente), depois de db/fluxogramas.sql:
--    docker exec -i supabase-db psql -U postgres -d postgres < db/fluxogramas_versoes.sql
--  ou, de fora de casa, pelo mesmo caminho que o Studio usa (/pg/query, com a chave de serviço):
--    node --env-file=<arquivo com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY> Abacatosys/lisa-proof/scripts/migrar.mjs db/fluxogramas_versoes.sql
--
--  Pedido: "ela estragou o meu fluxograma das funcionalidades da versão desktop" — a Lisa gravou por
--  cima uma aba pela metade, e o fluxo só guardava a última versão. Agora, antes de gravar por cima,
--  a versão de antes fica aqui (src/lib/fluxogramas.js: guardarAntes): sempre que a Lisa grava,
--  quando somem formas, e no máximo a cada 10 minutos de trabalho da pessoa. Ficam as 60 mais novas
--  de cada fluxo; o painel ProcessMap lista e volta para qualquer uma ("Versões anteriores…").
-- ============================================================

create table if not exists public.lisa_fluxogramas_versoes (
  id         uuid primary key default gen_random_uuid(),
  fluxo_id   uuid not null references public.lisa_fluxogramas (id) on delete cascade,
  dono_id    uuid not null,
  -- a versão do fluxo que foi guardada (a que estava no banco antes da gravação)
  versao     integer not null,
  nome       text not null default '',
  documento  jsonb not null,
  modo       text not null default 'diagram',
  formas     integer not null default 0,
  -- por que foi guardada ("antes de a Lisa mudar: …", "antes de sumirem formas", "automática")
  motivo     text not null default '' check (char_length(motivo) <= 200),
  criado_em  timestamptz not null default now()
);

create index if not exists lisa_fluxogramas_versoes_fluxo_idx
  on public.lisa_fluxogramas_versoes (fluxo_id, criado_em desc);

alter table public.lisa_fluxogramas_versoes enable row level security;
-- (só acessada pela service_role, pelas rotas da Lisa — mesmo padrão das outras tabelas)
