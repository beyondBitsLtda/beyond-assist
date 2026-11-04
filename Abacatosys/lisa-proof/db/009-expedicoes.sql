-- Lisa_Proof — expedições contra a CPU (vilas, florestas, bosques e acampamentos de monstros) e a
-- regra das 48 h entre invasões ao mesmo reino.
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA: uma tabela nova, um índice novo nas
-- invasões e um tipo novo no livro-caixa. Nenhum dado existente muda.
-- Aplicar:  npm run migrar -- db/009-expedicoes.sql

-- Cada expedição feita: o limite do dia e o "os monstros voltam amanhã" saem daqui, e a receita
-- da batalha (combate) deixa assistir de novo.
create table if not exists public.proof_expedicoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  expedicao   text not null,
  dia         date not null,
  numero      smallint not null check (numero between 1 and 3),  -- 1ª, 2ª ou 3ª expedição do dia
  estrelas    smallint not null default 0 check (estrelas between 0 and 3),
  destruicao  smallint not null default 0 check (destruicao between 0 and 100),
  saque       integer not null default 0,
  perdas      jsonb not null default '{}'::jsonb,
  combate     jsonb,
  criado_em   timestamptz not null default now()
);
-- As regras moram no banco também: dois cliques ao mesmo tempo não viram a 4ª expedição do dia,
-- nem o mesmo lugar saqueado duas vezes no dia.
create unique index if not exists proof_expedicoes_limite_do_dia on public.proof_expedicoes (usuario_id, dia, numero);
create unique index if not exists proof_expedicoes_um_por_lugar  on public.proof_expedicoes (usuario_id, expedicao, dia);
create index if not exists proof_expedicoes_usuario on public.proof_expedicoes (usuario_id, criado_em desc);
alter table public.proof_expedicoes enable row level security;

-- A regra das 48 h (o mesmo reino só a cada dois dias, por quem ataca) lê as invasões recentes de
-- quem ataca, por data.
create index if not exists proof_invasoes_atacante_tempo on public.proof_invasoes (atacante_id, criado_em desc);

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao'));
