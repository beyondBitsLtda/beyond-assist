-- 021 — O Mercado de Tropas (30/10/2026). Pode rodar duas vezes sem estragar nada.
--
-- Pedido: "vender membros das tropas de defesa e do exército para liberar espaço; assim que a pessoa
-- põe as tropas à venda, elas já saem, liberam espaço e ficam à venda para outros jogadores".
-- Cada linha é um anúncio: as tropas que saíram do reino de `vendedor_id` e esperam comprador.
-- `quantidade` é o que foi anunciado; `restante`, o que ainda está à venda. Comprar desconta de
-- `restante` por "compare e troque" (só grava se ainda é o valor lido), então dois compradores ao
-- mesmo tempo nunca levam a mesma tropa. As regras moram em src/dominio/mercadoDeTropas.js.
--
-- Aplicar:  npm run migrar -- db/021-mercado-de-tropas.sql

create table if not exists public.proof_mercado_tropas (
  id             uuid primary key default gen_random_uuid(),
  vendedor_id    uuid not null references public.abacato_usuarios(id) on delete cascade,
  tropa          text not null check (tropa ~ '^[a-z]+$'),
  origem         text not null check (origem in ('exercito', 'guarnicao')),   -- a reserva de onde saiu (e para onde volta se retirar)
  quantidade     integer not null check (quantidade between 1 and 60),
  restante       integer not null check (restante >= 0),
  preco          integer not null check (preco >= 1),                       -- por tropa
  status         text not null default 'aberta' check (status in ('aberta', 'vendida', 'retirada')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (restante <= quantidade)
);
create index if not exists proof_mercado_tropas_vitrine  on public.proof_mercado_tropas (status, preco, criado_em);
create index if not exists proof_mercado_tropas_vendedor on public.proof_mercado_tropas (vendedor_id, status);
alter table public.proof_mercado_tropas enable row level security;

-- o livro-caixa do Reino ganha a compra e a venda no mercado (os tipos de antes continuam todos)
alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda'));

-- ============================================================ o Reino de Teste (db/016)
-- A gêmea do mercado, e o livro-caixa de teste aceitando os tipos novos. A checagem dele foi copiada
-- da de verdade na 016 (o LIKE mantém o nome dela); as duas formas do nome saem antes de recriar.
create table if not exists public.proof_teste_mercado_tropas (like public.proof_mercado_tropas including all);
alter table public.proof_teste_mercado_tropas enable row level security;

alter table public.proof_teste_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos drop constraint if exists proof_teste_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos add constraint proof_teste_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda'));

-- a API enxerga as tabelas novas na hora
notify pgrst, 'reload schema';
