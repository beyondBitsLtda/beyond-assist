-- Workspaces também na documentação: os projetos entram nas MESMAS pastas dos quadros.
--
-- Um workspace é uma área de trabalho — "Delp", "Pessoal", "Clientes" —, e não uma pasta só de
-- quadros. Por isso esta migração não cria outra tabela de workspaces: liga os projetos de
-- documentação aos workspaces que já existem (db/010-workspaces.sql). Quem abre "Delp" nos
-- quadros e depois nos documentos encontra o mesmo "Delp" nos dois lugares.
--
-- As regras são as mesmas da ligação dos quadros, pelos mesmos motivos:
--   - o workspace ORGANIZA, não dá acesso — quem enxerga um projeto continua sendo decidido em
--     abacato_projeto_membros;
--   - para cada pessoa, um projeto está em um workspace, ou em nenhum (unique dono + projeto).
--
-- Rodar:  npm run migrar db/011-workspaces-documentos.sql
-- Pode rodar duas vezes sem estragar nada.

create table if not exists public.abacato_workspace_projetos (
  workspace_id uuid not null references public.abacato_workspaces (id) on delete cascade,
  projeto_id   uuid not null references public.abacato_projetos (id) on delete cascade,
  dono_id      uuid not null references public.abacato_usuarios (id) on delete cascade,
  primary key (workspace_id, projeto_id),
  unique (dono_id, projeto_id)
);
create index if not exists abacato_workspace_projetos_ws_idx on public.abacato_workspace_projetos (workspace_id);

-- Como em todo o resto do sistema: ligada, sem política nenhuma.
alter table public.abacato_workspace_projetos enable row level security;
