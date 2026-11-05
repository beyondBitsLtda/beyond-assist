-- 037: a IDE livre da Prática (1.9.0, 05/11/2026). Cada pessoa guarda os seus projetos de código: os arquivos
-- (caminho → conteúdo), as pastas vazias e o arquivo principal. O projeto inteiro é uma linha (um jsonb), com
-- `versao` para duas abas não apagarem o trabalho uma da outra. Os limites (300 arquivos, 1,5 milhão de letras)
-- são conferidos em src/dominio/ide.js antes de gravar. Pode rodar duas vezes sem estragar nada.
--
-- Aplicar:  npm run migrar -- db/037-ide.sql

create table if not exists public.proof_ide_projetos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.abacato_usuarios(id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 80),
  arquivos      jsonb not null default '{}'::jsonb,
  pastas        jsonb not null default '[]'::jsonb,
  principal     text not null default '',
  versao        integer not null default 1,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists proof_ide_projetos_usuario on public.proof_ide_projetos (usuario_id, atualizado_em desc);
alter table public.proof_ide_projetos enable row level security;

notify pgrst, 'reload schema';
