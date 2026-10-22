-- Lisa_Proof — alianças entre reinos (convite com dias de paz, mina em dobro, reforços e reinos
-- vizinhos; as regras moram em src/dominio/alianca.js).
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA uma tabela. Nenhum dado existente muda.
-- Aplicar:  npm run migrar -- db/011-aliancas.sql
create table if not exists public.proof_aliancas (
  id            uuid primary key default gen_random_uuid(),
  de_id         uuid not null references public.abacato_usuarios(id) on delete cascade,  -- quem convidou
  para_id       uuid not null references public.abacato_usuarios(id) on delete cascade,  -- quem foi convidado
  dias          smallint not null check (dias in (3, 7, 14, 30)),                        -- os dias de paz
  status        text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada', 'cancelada', 'expirada')),
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null,           -- o convite espera resposta até aqui
  respondido_em timestamptz,
  inicio        timestamptz,                    -- a aliança aceita vale de inicio a fim
  fim           timestamptz,
  check (de_id <> para_id)
);
-- um convite esperando resposta por par de reinos, nos dois sentidos (dois cliques não viram dois)
create unique index if not exists proof_aliancas_um_pendente_por_par
  on public.proof_aliancas (least(de_id, para_id), greatest(de_id, para_id)) where status = 'pendente';
create index if not exists proof_aliancas_de   on public.proof_aliancas (de_id, status);
create index if not exists proof_aliancas_para on public.proof_aliancas (para_id, status);
alter table public.proof_aliancas enable row level security;
