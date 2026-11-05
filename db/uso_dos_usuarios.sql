-- ============================================================
--  LISA — o uso dos usuários (04/11/2026, o painel "Uso dos usuários" do admin, em /uso)
--
--  Rodar (é idempotente):
--    docker exec -i supabase-db psql -U postgres -d postgres < db/uso_dos_usuarios.sql
--  ou, de fora de casa, pelo mesmo caminho que o Studio usa (/pg/query, com a chave de serviço):
--    node --env-file=<arquivo com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY> Abacatosys/lisa-proof/scripts/migrar.mjs db/uso_dos_usuarios.sql
--
--  Um ACESSO é um período contínuo de uso: o login abre um, e a batida de presença da tela (uma por minuto, com a aba
--  visível) soma o tempo e a tela; uma pausa de mais de 5 minutos fecha o acesso e a próxima batida abre outro
--  (src/lib/usoDosUsuarios.js). Guarda só quando, quanto tempo, onde e o tipo de aparelho: nada do que a pessoa fala
--  ou escreve. Só pela service_role, pelas rotas da Lisa (mesmo padrão das outras tabelas).
-- ============================================================

create table if not exists public.lisa_presenca (
  id       uuid primary key default gen_random_uuid(),
  dono_id  uuid not null,
  inicio   timestamptz not null default now(),
  ultimo   timestamptz not null default now(),
  segundos integer not null default 0 check (segundos >= 0),
  -- minutos (batidas) em cada tela: { "assistant": 12, "fluxogramas": 5 }
  paginas  jsonb not null default '{}'::jsonb,
  aparelho text not null default 'computador' check (aparelho in ('computador', 'celular', 'tablet')),
  -- o acesso começou por um login (e não por uma sessão que já estava aberta)
  entrou   boolean not null default false
);
create index if not exists lisa_presenca_dono_idx on public.lisa_presenca (dono_id, ultimo desc);
create index if not exists lisa_presenca_ultimo_idx on public.lisa_presenca (ultimo desc);
alter table public.lisa_presenca enable row level security;

notify pgrst, 'reload schema';
