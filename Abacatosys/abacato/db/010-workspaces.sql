-- Workspaces: pastas de quadros, para cada pessoa organizar o que enxerga (BEYOND-0003).
--
-- ==========================================================================================
-- A DECISÃO QUE VALE A EXPLICAÇÃO: O WORKSPACE ORGANIZA, NÃO DÁ ACESSO.
--
-- Cada pessoa tem os SEUS workspaces e põe neles os quadros que já pode abrir — os dela e os
-- que dividiram com ela. Por isso a ligação quadro↔workspace mora numa tabela à parte, com o
-- dono junto, e não numa coluna `workspace_id` em abacato_quadros.
--
-- A coluna parecia mais simples e traria dois problemas reais:
--   1. Quem foi convidado para um quadro não conseguiria organizá-lo: o quadro estaria no
--      workspace de quem o criou, e só ali.
--   2. Mover um quadro de workspace viraria uma decisão de acesso. Aqui não é: tirar ou pôr um
--      quadro num workspace nunca muda quem o enxerga — quem decide isso continua sendo
--      abacato_membros, num lugar só.
--
-- `unique (dono_id, quadro_id)`: para cada pessoa, um quadro está em UM workspace, ou em
-- nenhum. Um quadro em dois workspaces da mesma pessoa aparece duas vezes na lista, e a
-- pergunta "onde está aquele quadro?" deixa de ter resposta.
-- ==========================================================================================
--
-- Rodar:  npm run migrar db/010-workspaces.sql
-- Pode rodar duas vezes sem estragar nada.

create table if not exists public.abacato_workspaces (
  id        uuid primary key default gen_random_uuid(),
  dono_id   uuid not null references public.abacato_usuarios (id) on delete cascade,
  nome      text not null,
  -- Numérico, como em colunas e cards: reordenar é uma linha alterada, não a lista renumerada.
  posicao   double precision not null default 1024,
  criado_em timestamptz not null default now()
);
create index if not exists abacato_workspaces_dono_idx on public.abacato_workspaces (dono_id, posicao);

create table if not exists public.abacato_workspace_quadros (
  workspace_id uuid not null references public.abacato_workspaces (id) on delete cascade,
  quadro_id    uuid not null references public.abacato_quadros (id) on delete cascade,
  -- Repetido do workspace de propósito: é o que permite a unicidade abaixo sem trigger.
  dono_id      uuid not null references public.abacato_usuarios (id) on delete cascade,
  primary key (workspace_id, quadro_id),
  unique (dono_id, quadro_id)
);
create index if not exists abacato_workspace_quadros_ws_idx on public.abacato_workspace_quadros (workspace_id);

-- Como em todo o resto do sistema: ligada, sem política nenhuma. Só o servidor, com a chave de
-- serviço, alcança estas tabelas — e ele só responde depois de conferir a sessão.
do $$
declare t text;
begin
  foreach t in array array['abacato_workspaces', 'abacato_workspace_quadros'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

comment on table public.abacato_workspaces is
  'Pastas de quadros de UMA pessoa. Organizam a lista dela; não dão acesso a nada (isso é abacato_membros).';
