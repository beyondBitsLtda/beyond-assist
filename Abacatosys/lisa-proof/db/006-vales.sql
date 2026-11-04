-- Lisa_Proof — vales de moedas para resgatar (o primeiro: 450 de boas-vindas para todo mundo).
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA: duas tabelas, um tipo novo no
-- livro-caixa do reino e o vale de boas-vindas. Nenhum dado existente muda.
-- Aplicar:  npm run migrar -- db/006-vales.sql
--
-- O vale vira MOEDAS do Reino (livro-caixa), não pontos de estudo: ponto de estudo conta como
-- dia estudado, bate a meta do dia e mexe na ofensiva — um presente não pode fazer isso.

-- Os vales que existem. `ativo` = aparece para quem ainda não resgatou (novos e antigos).
create table if not exists public.proof_vales (
  id         text primary key,
  titulo     text not null,
  descricao  text not null default '',
  moedas     integer not null check (moedas > 0),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Quem já resgatou. A chave primária é a trava: o mesmo vale nunca entra duas vezes.
create table if not exists public.proof_vales_resgates (
  vale_id      text not null references public.proof_vales(id) on delete cascade,
  usuario_id   uuid not null references public.abacato_usuarios(id) on delete cascade,
  resgatado_em timestamptz not null default now(),
  primary key (vale_id, usuario_id)
);

-- O livro-caixa do reino ganha o tipo "vale".
alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale'));

insert into public.proof_vales (id, titulo, descricao, moedas)
values ('boas-vindas-450', 'Vale de boas-vindas', '450 moedas para construir o seu Reino do Neuro.', 450)
on conflict (id) do nothing;

-- Mesma política do resto: RLS ligado e nenhuma policy — só o servidor alcança.
alter table public.proof_vales          enable row level security;
alter table public.proof_vales_resgates enable row level security;
