-- Lisa_Proof — veículos e combustível, expedições novas (fundo do mar, montanhas, lava e
-- planetoides), a Mina de Ouro com operários e aluguel, e a Bolsa do Reino (pedido de 23/10/2026).
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA: colunas novas nos reinos e nas
-- expedições, tabelas novas e tipos novos no livro-caixa. Nenhum dado existente muda — todo reino
-- ganha o Barco Voador, o pelotão de 3 operários e a Mina de Ouro começa a contar agora.
-- Aplicar:  npm run migrar -- db/013-veiculos-ouro-bolsa.sql

-- ---------------------------------------------------------------- reinos: veículos e operários
alter table public.proof_reinos add column if not exists veiculos          jsonb       not null default '["barco"]'::jsonb;
alter table public.proof_reinos add column if not exists operarios         integer     not null default 3 check (operarios >= 0);
alter table public.proof_reinos add column if not exists ouro_coletado_em  timestamptz not null default now();

-- ---------------------------------------------------------------- expedições: por veículo
-- O limite do dia agora é do TANQUE de cada veículo (3 de graça + até 5 abastecidas): o número da
-- expedição conta por veículo, e o índice único barra a corrida de dois cliques no mesmo número.
alter table public.proof_expedicoes add column if not exists veiculo text  not null default 'barco';
alter table public.proof_expedicoes add column if not exists detalhe jsonb not null default '{}'::jsonb; -- o planetoide sorteado
alter table public.proof_expedicoes drop constraint if exists proof_expedicoes_numero_check;
alter table public.proof_expedicoes add constraint proof_expedicoes_numero_check check (numero between 1 and 8);
drop index if exists public.proof_expedicoes_limite_do_dia;
create unique index if not exists proof_expedicoes_limite_do_tanque on public.proof_expedicoes (usuario_id, veiculo, dia, numero);

-- ---------------------------------------------------------------- operários para alugar
-- Uma oferta por reino: quantos operários o dono deixa para alugar e o preço por operário (24 h).
create table if not exists public.proof_operarios_ofertas (
  dono_id        uuid primary key references public.abacato_usuarios(id) on delete cascade,
  quantidade     integer not null default 0 check (quantidade >= 0),
  preco          integer not null default 0 check (preco >= 0),
  atualizado_em  timestamptz not null default now()
);
-- Cada aluguel: os operários trabalham na mina de quem alugou de `inicio` a `fim`.
create table if not exists public.proof_alugueis (
  id            uuid primary key default gen_random_uuid(),
  dono_id       uuid not null references public.abacato_usuarios(id) on delete cascade,
  inquilino_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  quantidade    integer not null check (quantidade > 0),
  preco         integer not null check (preco >= 0),
  total         integer not null check (total >= 0),
  inicio        timestamptz not null,
  fim           timestamptz not null,
  criado_em     timestamptz not null default now(),
  check (dono_id <> inquilino_id)
);
create index if not exists proof_alugueis_dono      on public.proof_alugueis (dono_id, fim desc);
create index if not exists proof_alugueis_inquilino on public.proof_alugueis (inquilino_id, fim desc);
alter table public.proof_operarios_ofertas enable row level security;
alter table public.proof_alugueis          enable row level security;

-- ---------------------------------------------------------------- a Bolsa do Reino
-- O mercado é um só: as mesmas ações e os mesmos preços para todos.
create table if not exists public.proof_bolsa_acoes (
  id             text primary key check (id ~ '^[A-Z]{3,5}$'),   -- o ticker
  nome           text not null,
  setor          text not null,
  emoji          text not null default '🏢',
  descricao      text not null default '',
  preco          integer not null check (preco >= 0),
  preco_inicial  integer not null,
  status         text not null default 'ativa' check (status in ('ativa', 'falida', 'fechada')),
  criada_em      date not null,
  saiu_em        date
);
-- O preço de cada ação em cada pregão (o gráfico e a garantia de não aplicar o mesmo pregão duas vezes).
create table if not exists public.proof_bolsa_precos (
  acao_id   text not null references public.proof_bolsa_acoes(id) on delete cascade,
  dia       date not null,
  preco     integer not null,
  variacao  numeric(6, 1) not null default 0,
  noticia   text not null default '',
  primary key (acao_id, dia)
);
-- Um pregão por dia: quem chega primeiro depois da meia-noite abre (status 'gerando' trava os outros).
create table if not exists public.proof_bolsa_pregoes (
  dia         date primary key,
  status      text not null default 'gerando' check (status in ('gerando', 'pronto')),
  manchete    text not null default '',
  gerado_por  text not null default 'lisa' check (gerado_por in ('lisa', 'reserva')),
  criado_em   timestamptz not null default now(),
  pronto_em   timestamptz
);
create table if not exists public.proof_bolsa_posicoes (
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  acao_id     text not null references public.proof_bolsa_acoes(id) on delete cascade,
  quantidade  integer not null default 0 check (quantidade >= 0),
  custo       integer not null default 0 check (custo >= 0),   -- quanto pagou pelas que ainda tem
  primary key (usuario_id, acao_id)
);
create table if not exists public.proof_bolsa_ordens (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  acao_id     text not null references public.proof_bolsa_acoes(id) on delete cascade,
  tipo        text not null check (tipo in ('compra', 'venda', 'resgate', 'falencia')),
  quantidade  integer not null,
  preco       integer not null,
  taxa        integer not null default 0,
  total       integer not null,
  criado_em   timestamptz not null default now()
);
create index if not exists proof_bolsa_ordens_usuario on public.proof_bolsa_ordens (usuario_id, criado_em desc);
alter table public.proof_bolsa_acoes    enable row level security;
alter table public.proof_bolsa_precos   enable row level security;
alter table public.proof_bolsa_pregoes  enable row level security;
alter table public.proof_bolsa_posicoes enable row level security;
alter table public.proof_bolsa_ordens   enable row level security;

-- ---------------------------------------------------------------- livro-caixa: os tipos novos
alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate'));
