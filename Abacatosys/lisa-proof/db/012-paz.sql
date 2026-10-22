-- Lisa_Proof — a paz entre os reinos, por votação (no lugar da aliança entre dois reinos).
--
-- Cria a proposta de paz e os votos, acrescenta o tipo paz_expedicao no livro-caixa (a parte do
-- saque das expedições que cada reino ganha durante a paz) e REMOVE a tabela da aliança, que
-- deixou de existir no jogo (pedido de 22/10/2026). Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/012-paz.sql
create table if not exists public.proof_pazes (
  id            uuid primary key default gen_random_uuid(),
  proposta_por  uuid not null references public.abacato_usuarios(id) on delete cascade,
  dias          smallint not null check (dias in (3, 7, 14, 30)),
  status        text not null default 'votacao' check (status in ('votacao', 'aprovada', 'rejeitada', 'expirada', 'cancelada')),
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null,           -- a votação fica aberta até aqui
  inicio        timestamptz,                    -- a paz aprovada vale de inicio a fim
  fim           timestamptz,
  total_reinos  integer                         -- quantos reinos votaram sim (o fator da mina)
);
-- uma proposta em votação por vez (dois cliques não viram duas)
create unique index if not exists proof_pazes_uma_votacao on public.proof_pazes ((true)) where status = 'votacao';
create index if not exists proof_pazes_status on public.proof_pazes (status, fim desc);

create table if not exists public.proof_paz_votos (
  paz_id      uuid not null references public.proof_pazes(id) on delete cascade,
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  voto        boolean not null,
  criado_em   timestamptz not null default now(),
  primary key (paz_id, usuario_id)               -- cada reino vota uma vez
);
alter table public.proof_pazes     enable row level security;
alter table public.proof_paz_votos enable row level security;

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao'));

-- a aliança entre dois reinos saiu do jogo
drop table if exists public.proof_aliancas;
