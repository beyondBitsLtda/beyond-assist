-- Lisa_Proof — rodadas extras da prática, ranking mundial e o Reino do Neuro.
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA: colunas novas com padrão, tabelas e
-- visões novas. Nenhum dado existente muda (os desafios de antes viram a rodada 1).
-- Aplicar:  npm run migrar -- db/005-rodadas-ranking-reino.sql

-- ------------------------------------------------------------------ rodadas da prática
-- Até 3 quizzes e 3 exercícios por dia, por trilha. A rodada entra na chave única no lugar
-- do "um por dia": continua impossível dois cliques criarem dois quizzes da MESMA rodada.
alter table public.proof_desafios add column if not exists rodada smallint not null default 1;
alter table public.proof_desafios drop constraint if exists proof_desafios_rodada_check;
alter table public.proof_desafios add constraint proof_desafios_rodada_check check (rodada between 1 and 3);
alter table public.proof_desafios drop constraint if exists proof_desafios_usuario_id_trilha_id_tipo_periodo_key;
create unique index if not exists proof_desafios_unico_por_rodada
  on public.proof_desafios (usuario_id, trilha_id, tipo, periodo, rodada);

-- ------------------------------------------------------------------ nome no ranking
-- O nome que aparece para os outros. Vazio = primeiro nome + inicial do sobrenome. A pessoa pode
-- sair do ranking (aparece como "Estudante anônimo") — o nome completo nunca é público.
alter table public.proof_perfis add column if not exists apelido text;
alter table public.proof_perfis add column if not exists no_ranking boolean not null default true;

-- ------------------------------------------------------------------ ranking
-- Somas prontas, para a tela não varrer todos os eventos de todo mundo a cada visita.
create or replace view public.proof_ranking_total as
  select usuario_id, sum(pontos)::int as pontos, count(distinct dia)::int as dias
  from public.proof_eventos
  group by usuario_id;

create or replace view public.proof_ranking_semana as
  select usuario_id, sum(pontos)::int as pontos, count(distinct dia)::int as dias
  from public.proof_eventos
  where dia >= ((now() at time zone 'America/Sao_Paulo')::date - 6)
  group by usuario_id;

-- Visão não obedece ao RLS das tabelas de baixo, e o Supabase dá acesso de leitura às roles
-- públicas por padrão: sem isto, a chave anônima leria os pontos de todo mundo pela API REST.
revoke all on public.proof_ranking_total  from anon, authenticated;
revoke all on public.proof_ranking_semana from anon, authenticated;

-- ------------------------------------------------------------------ Reino do Neuro
-- Um reino por pessoa. Os níveis das construções ficam num jsonb ({"castelo":1,"mina":1,...}):
-- as regras (custos, efeitos, limites) moram no código, em src/dominio/reino.js.
-- `versao` é a trava contra gasto em dobro: toda compra grava "onde versao = a que eu li".
create table if not exists public.proof_reinos (
  usuario_id    uuid primary key references public.abacato_usuarios(id) on delete cascade,
  nome          text not null default 'Reino do Neuro',
  neuro_nivel   smallint not null default 1,
  construcoes   jsonb not null default '{"castelo":1,"mina":1,"cofre":0,"muralha":0,"torre":0,"quartel":0}'::jsonb,
  coletado_em   timestamptz not null default now(),
  escudo_ate    timestamptz,
  trofeus       integer not null default 0,
  versao        integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- O livro-caixa das moedas. O saldo é: pontos de estudo (cada ponto vale uma moeda) + a soma
-- destes movimentos (gastos negativos, coletas e saques positivos). Nada se apaga daqui.
create table if not exists public.proof_reino_movimentos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.abacato_usuarios(id) on delete cascade,
  tipo       text not null check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido')),
  valor      integer not null,
  detalhe    jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);
create index if not exists proof_reino_movimentos_usuario on public.proof_reino_movimentos (usuario_id, criado_em desc);

-- Cada invasão, vencida ou não: o relatório de batalhas e o limite de ataques por dia saem daqui.
create table if not exists public.proof_invasoes (
  id           uuid primary key default gen_random_uuid(),
  atacante_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  defensor_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  dia          date not null,
  numero       smallint not null check (numero between 1 and 3),  -- 1ª, 2ª ou 3ª invasão do dia
  ataque       integer not null,
  defesa       integer not null,
  venceu       boolean not null,
  saque        integer not null default 0,
  trofeus_atacante integer not null default 0,
  trofeus_defensor integer not null default 0,
  criado_em    timestamptz not null default now()
);
-- As duas regras de limite moram no banco, não só no código: dois cliques ao mesmo tempo não
-- viram a 4ª invasão do dia, nem a segunda no mesmo reino.
create unique index if not exists proof_invasoes_limite_do_dia on public.proof_invasoes (atacante_id, dia, numero);
create unique index if not exists proof_invasoes_um_por_alvo   on public.proof_invasoes (atacante_id, defensor_id, dia);
create index if not exists proof_invasoes_defensor on public.proof_invasoes (defensor_id, criado_em desc);

-- Mesma política do resto: RLS ligado e nenhuma policy — só o servidor alcança.
alter table public.proof_reinos           enable row level security;
alter table public.proof_reino_movimentos enable row level security;
alter table public.proof_invasoes         enable row level security;
