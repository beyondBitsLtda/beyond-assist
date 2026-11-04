-- 030 — a versão 1.0 (03/11/2026). Pode rodar duas vezes sem estragar nada.
--
--   proof_chefoes (colunas)  o roubo do chefão de pé (BEYOND-0018): quanto ele já levou e o relógio do
--                            último roubo — devolvido inteiro quando ele cai (src/lib/chefoes.js).
--   proof_ilhas              a Temporada das Ilhas (BEYOND-0020, src/dominio/ilhas.js): cada ilha do
--                            arquipélago, o dono (null = os nativos), as construções, os guardas, o relógio da
--                            produção e o escudo depois de uma conquista. `versao` barra duas gravações juntas.
--   proof_tripulacoes        a tripulação de cada jogador na temporada (treinada no Porto, paga em conchas).
--   proof_conchas            o livro-caixa das conchas 🐚 (a moeda das ilhas): o saldo é a soma.
--   proof_ilha_batalhas      cada ataque a uma ilha (contra os nativos ou outro jogador), com a receita da
--                            batalha para a tela mostrar de novo.
--   proof_pactos             a única paz das ilhas: um pacto entre dois jogadores, proposto e aceito.
--   proof_arena              a Arena Lúdica de Programação (BEYOND-0023, src/dominio/arena.js): as fases de
--                            cada jogo — concluída quando, tentativas, acertos, o melhor tempo e a recompensa.
--
-- E os tipos novos no livro-caixa do reino: 'ilhas' (comprar conchas, as pérolas e o prêmio da conquista) e
-- 'arena' (a recompensa de cada fase da Arena).

alter table public.proof_chefoes add column if not exists roubado integer not null default 0;
alter table public.proof_chefoes add column if not exists ultimo_roubo_em timestamptz;

create table if not exists public.proof_ilhas (
  id             text primary key,
  temporada      text not null,
  dono_id        uuid references public.abacato_usuarios(id) on delete set null,
  construcoes    jsonb not null default '{}'::jsonb,
  guardas        jsonb not null default '{}'::jsonb,
  coletado_em    timestamptz,
  conquistada_em timestamptz,
  escudo_ate     timestamptz,
  versao         integer not null default 0,
  atualizado_em  timestamptz not null default now()
);
create index if not exists proof_ilhas_dono_idx on public.proof_ilhas (dono_id);
alter table public.proof_ilhas enable row level security;

create table if not exists public.proof_tripulacoes (
  usuario_id     uuid primary key references public.abacato_usuarios(id) on delete cascade,
  temporada      text not null,
  tripulacao     jsonb not null default '{}'::jsonb,
  versao         integer not null default 0,
  atualizado_em  timestamptz not null default now()
);
alter table public.proof_tripulacoes enable row level security;

create table if not exists public.proof_conchas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  temporada   text not null,
  tipo        text not null check (tipo in ('compra', 'producao', 'construcao', 'treino', 'conquista', 'saque_ganho', 'saque_perdido', 'estorno')),
  valor       numeric(14, 2) not null,
  detalhe     jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);
create index if not exists proof_conchas_usuario_idx on public.proof_conchas (usuario_id, temporada);
alter table public.proof_conchas enable row level security;

create table if not exists public.proof_ilha_batalhas (
  id           uuid primary key default gen_random_uuid(),
  temporada    text not null,
  ilha_id      text not null,
  atacante_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  defensor_id  uuid references public.abacato_usuarios(id) on delete set null,
  dia          date not null,
  estrelas     integer not null default 0,
  destruicao   integer not null default 0,
  desfecho     text not null check (desfecho in ('conquista', 'saque', 'derrota')),
  conchas      integer not null default 0,
  moedas       integer not null default 0,
  combate      jsonb,
  criado_em    timestamptz not null default now()
);
create index if not exists proof_ilha_batalhas_atacante_idx on public.proof_ilha_batalhas (atacante_id, dia);
create index if not exists proof_ilha_batalhas_defensor_idx on public.proof_ilha_batalhas (defensor_id, criado_em desc);
alter table public.proof_ilha_batalhas enable row level security;

create table if not exists public.proof_pactos (
  id          uuid primary key default gen_random_uuid(),
  temporada   text not null,
  de_id       uuid not null references public.abacato_usuarios(id) on delete cascade,
  para_id     uuid not null references public.abacato_usuarios(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  aceito_em   timestamptz,
  ate         timestamptz
);
create index if not exists proof_pactos_de_idx on public.proof_pactos (de_id);
create index if not exists proof_pactos_para_idx on public.proof_pactos (para_id);
alter table public.proof_pactos enable row level security;

create table if not exists public.proof_arena (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.abacato_usuarios(id) on delete cascade,
  jogo             text not null check (jogo in ('masmorra', 'mascote', 'parsons')),
  fase             text not null,
  tentativas       integer not null default 0,
  acertos          integer not null default 0,
  melhor_tempo_ms  integer,
  concluida_em     timestamptz,
  recompensa       integer not null default 0,
  atualizado_em    timestamptz not null default now()
);
create unique index if not exists proof_arena_fase on public.proof_arena (usuario_id, jogo, fase);
alter table public.proof_arena enable row level security;

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno', 'correio',
                  'forja', 'chefao', 'duelo', 'ilhas', 'arena'));

alter table public.proof_teste_reino_movimentos drop constraint if exists proof_teste_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos add constraint proof_teste_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno', 'correio',
                  'forja', 'chefao', 'duelo', 'ilhas', 'arena'));

notify pgrst, 'reload schema';
