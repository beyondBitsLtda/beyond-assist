-- ============================================================
--  LISA MVP — o que é de cada USUÁRIO (01/11/2026)
--
--  Rodar (é idempotente):
--    docker exec -i supabase-db psql -U postgres -d postgres < db/mvp_usuarios.sql
--  ou, de fora de casa, pelo mesmo caminho que o Studio usa (/pg/query, com a chave de serviço):
--    node --env-file=<arquivo com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY> Abacatosys/lisa-proof/scripts/migrar.mjs db/mvp_usuarios.sql
--
--  Pedido: "quando um usuário que não seja eu logar, ele tem acesso a uma versão limitada da
--  aplicação". O usuário (papel em src/lib/authSession.js) ganha três coisas suas, separadas pelo
--  dono (o "sub" do token, como em lisa_fluxogramas):
--    - lisa_perfis: a entrevista do primeiro acesso (nome, área, nível, objetivos, preferências), só
--      depois do consentimento dele, e apagável a qualquer hora (LGPD: só o necessário);
--    - lisa_tarefas: a Lisa Task leve — SEM campo de arquivo ("Sem Hospedagem de Arquivos");
--    - lisa_uso: quantas perguntas, desenhos, comentários de tela e falas ele usou no dia, para
--      o limite diário (as chaves de IA são do admin).
--  Tudo só pela service_role, pelas rotas da Lisa (mesmo padrão das outras tabelas).
-- ============================================================

create table if not exists public.lisa_perfis (
  dono_id          uuid primary key,
  nome             text not null default '' check (char_length(nome) <= 80),
  area             text not null default '' check (char_length(area) <= 300),
  nivel            text not null default '' check (char_length(nivel) <= 80),
  objetivos        text not null default '' check (char_length(objetivos) <= 600),
  preferencias     jsonb not null default '{}'::jsonb,
  consentimento_em timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create table if not exists public.lisa_tarefas (
  id            uuid primary key default gen_random_uuid(),
  dono_id       uuid not null,
  titulo        text not null check (char_length(titulo) between 1 and 200),
  descricao     text not null default '' check (char_length(descricao) <= 2000),
  status        text not null default 'aberta' check (status in ('aberta', 'feita')),
  prioridade    text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
  lembrete_em   timestamptz,
  feita_em      timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists lisa_tarefas_dono_idx
  on public.lisa_tarefas (dono_id, status, criado_em desc);

create table if not exists public.lisa_uso (
  dono_id uuid not null,
  dia     date not null,
  tipo    text not null check (tipo in ('pergunta', 'desenho', 'tela', 'voz')),
  quantos integer not null default 0,
  primary key (dono_id, dia, tipo)
);

-- conta um uso e devolve quantos já foram no dia (no fuso de Brasília), numa operação só
create or replace function public.lisa_contar_uso(p_dono uuid, p_tipo text)
returns integer
language sql
as $$
  insert into public.lisa_uso (dono_id, dia, tipo, quantos)
  values (p_dono, (now() at time zone 'America/Sao_Paulo')::date, p_tipo, 1)
  on conflict (dono_id, dia, tipo) do update set quantos = public.lisa_uso.quantos + 1
  returning quantos;
$$;

-- (o Supabase dá execução às funções novas para anon e authenticated por padrão: só a service_role conta)
revoke all on function public.lisa_contar_uso(uuid, text) from public, anon, authenticated;
grant execute on function public.lisa_contar_uso(uuid, text) to service_role;

alter table public.lisa_perfis enable row level security;
alter table public.lisa_tarefas enable row level security;
alter table public.lisa_uso enable row level security;
