-- 027 — O correio dos jogadores (03/11/2026, BEYOND-0016). Pode rodar duas vezes sem estragar nada.
--
--   proof_correio   uma carta: um recado (que quem recebe avalia — útil, os dois ganham moedas) ou uma
--                   pergunta do quiz do dia (que quem recebe responde — acertou, os dois ganham). A pergunta
--                   guarda a resposta certa: a tela só a mostra depois de responder (src/lib/correio.js).
--   'correio'       o tipo das moedas que o correio dá, no livro do Reino.

create table if not exists public.proof_correio (
  id             uuid primary key default gen_random_uuid(),
  de_id          uuid not null references public.abacato_usuarios(id) on delete cascade,
  para_id        uuid not null references public.abacato_usuarios(id) on delete cascade,
  tipo           text not null check (tipo in ('recado', 'pergunta')),
  texto          text not null default '',
  pergunta       jsonb,
  desafio_id     uuid references public.proof_desafios(id) on delete set null,
  indice         smallint,
  lida           boolean not null default false,
  avaliacao      text check (avaliacao in ('util', 'nao_util')),
  escolha        smallint,
  acertou        boolean,
  moedas_de      integer not null default 0,
  moedas_para    integer not null default 0,
  criado_em      timestamptz not null default now(),
  respondido_em  timestamptz
);
create index if not exists proof_correio_para_idx on public.proof_correio (para_id, criado_em desc);
create index if not exists proof_correio_de_idx on public.proof_correio (de_id, criado_em desc);
-- uma pergunta de um quiz vai pelo correio uma vez só
create unique index if not exists proof_correio_pergunta_unica on public.proof_correio (desafio_id, indice) where desafio_id is not null;
alter table public.proof_correio enable row level security;

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno', 'correio'));

alter table public.proof_teste_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos drop constraint if exists proof_teste_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos add constraint proof_teste_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno', 'correio'));

notify pgrst, 'reload schema';
