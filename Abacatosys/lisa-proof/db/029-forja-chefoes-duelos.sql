-- 029 — Forja de Artefatos, Chefões da Procrastinação e Duelo de Lógica (03/11/2026). Pode rodar duas vezes
-- sem estragar nada.
--
--   proof_forja      os artefatos forjados com a mana dos estudos (src/dominio/forja.js): a Poção de Foco
--                    (2 h; o extra é pago quando ela acaba, uma vez: liquidado_em) e o Escudo de Folga (24 h
--                    no escudo_ate do reino). `mana` é o que custou; a mana que sobra = a dos estudos − a soma.
--   proof_chefoes    o chefão de cada um, nascido das matérias e revisões atrasadas (src/dominio/chefoes.js).
--                    Um vivo por pessoa (índice parcial); o dano vem dos estudos desde nasceu_em; derrotado,
--                    paga a recompensa uma vez (pago_em).
--   proof_duelos     o Duelo de Lógica contra a Lisa (src/dominio/duelo.js): as perguntas (com o gabarito, que
--                    só o servidor vê), as respostas, os acertos dos dois e a aposta. Um aberto por pessoa.
--
-- E os tipos novos no livro-caixa do reino: 'forja' (o extra da poção), 'chefao' (a recompensa) e 'duelo'
-- (a aposta e o prêmio, dos dois lados).

create table if not exists public.proof_forja (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.abacato_usuarios(id) on delete cascade,
  item          text not null check (item in ('pocao', 'escudo')),
  mana          integer not null check (mana > 0),
  inicio        timestamptz not null default now(),
  ate           timestamptz not null,
  bonus         integer,
  liquidado_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index if not exists proof_forja_usuario_idx on public.proof_forja (usuario_id, criado_em desc);
alter table public.proof_forja enable row level security;

create table if not exists public.proof_chefoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.abacato_usuarios(id) on delete cascade,
  tipo          text not null check (tipo in ('lesma', 'hidra', 'tita')),
  vida          integer not null check (vida > 0),
  recompensa    integer not null check (recompensa >= 0),
  atraso        integer not null default 0,
  nasceu_em     timestamptz not null default now(),
  derrotado_em  timestamptz,
  pago_em       timestamptz
);
create index if not exists proof_chefoes_usuario_idx on public.proof_chefoes (usuario_id, nasceu_em desc);
create unique index if not exists proof_chefoes_um_vivo on public.proof_chefoes (usuario_id) where derrotado_em is null;
alter table public.proof_chefoes enable row level security;

create table if not exists public.proof_duelos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.abacato_usuarios(id) on delete cascade,
  adversario_id    uuid references public.abacato_usuarios(id) on delete set null,
  dia              date not null,
  aposta           integer not null check (aposta > 0),
  perguntas        jsonb not null,
  respostas        jsonb,
  acertos          integer,
  acertos_da_lisa  integer not null,
  resultado        text check (resultado in ('venceu', 'perdeu', 'empate')),
  status           text not null default 'aberto' check (status in ('aberto', 'encerrado')),
  criado_em        timestamptz not null default now(),
  expira_em        timestamptz not null,
  encerrado_em     timestamptz
);
create index if not exists proof_duelos_usuario_idx on public.proof_duelos (usuario_id, dia);
create unique index if not exists proof_duelos_um_aberto on public.proof_duelos (usuario_id) where status = 'aberto';
alter table public.proof_duelos enable row level security;

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno', 'correio',
                  'forja', 'chefao', 'duelo'));

alter table public.proof_teste_reino_movimentos drop constraint if exists proof_teste_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos add constraint proof_teste_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno', 'correio',
                  'forja', 'chefao', 'duelo'));

notify pgrst, 'reload schema';
