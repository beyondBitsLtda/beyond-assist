-- Abacato System — esquema do banco.
--
-- Mora no MESMO Postgres da Lisa, com prefixo `abacato_` em tudo. Um banco só é decisão
-- consciente: o Abacato vai substituir o Trello como fonte das tarefas da Lisa, e os dois
-- lendo a mesma base evita uma sincronização que nunca fica certa.
--
-- O prefixo não é enfeite — é o que permite `pg_dump -t 'abacato_*'` levar o Abacato inteiro
-- sem carregar as 26 tabelas da Lisa junto, no dia em que ele precisar sair de casa.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/schema.sql
-- É idempotente: rodar duas vezes não quebra nada.

-- ============================================================ pessoas

-- Usuários do Abacato, SEPARADOS dos da Lisa, e isto é requisito, não detalhe.
--
-- O Supabase Auth tem uma tabela de usuários por PROJETO, e o projeto é o mesmo. Usá-lo faria
-- qualquer login da Lisa valer aqui dentro — exatamente o que não se quer. Daí a tabela
-- própria, com senha guardada em PBKDF2 (ver src/lib/abacatoAuth.js).
--
-- A senha nunca é guardada; o que fica é o hash e o sal dele. Trocar o número de iterações
-- depois exige rehash no próximo login, e por isso ele é gravado junto de cada senha.
create table if not exists public.abacato_usuarios (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  nome         text not null,
  senha_hash   text not null,
  senha_sal    text not null,
  senha_iter   integer not null default 210000,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  ultimo_login timestamptz
);
create index if not exists abacato_usuarios_email_idx on public.abacato_usuarios (lower(email));

-- ============================================================ quadros

create table if not exists public.abacato_quadros (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  descricao        text,
  -- Papel de parede: uma cor, um gradiente ou o id de um anexo. Guardado como texto para o
  -- formato poder mudar sem migração de coluna.
  papel_de_parede  text,
  dono_id          uuid not null references public.abacato_usuarios (id) on delete cascade,
  arquivado        boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists abacato_quadros_dono_idx on public.abacato_quadros (dono_id) where not arquivado;

-- Quem mais enxerga o quadro, e com qual poder.
--
-- O papel é texto e não enum de propósito: acrescentar um nível depois não deveria exigir
-- `alter type`, que trava a tabela. A validação de qual papel pode o quê mora no código, num
-- lugar só (ver src/lib/permissoes.js).
create table if not exists public.abacato_membros (
  quadro_id  uuid not null references public.abacato_quadros (id) on delete cascade,
  usuario_id uuid not null references public.abacato_usuarios (id) on delete cascade,
  papel      text not null default 'editor',  -- dono | editor | comentarista | leitor
  criado_em  timestamptz not null default now(),
  primary key (quadro_id, usuario_id)
);

-- ============================================================ colunas e cards

-- `posicao` é NUMÉRICO e não inteiro sequencial. Arrastar um card entre outros dois vira uma
-- média das posições vizinhas — uma linha alterada, não a coluna inteira renumerada. Com
-- inteiros, mover o primeiro card de uma lista de duzentos reescreveria duzentas linhas.
create table if not exists public.abacato_colunas (
  id        uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.abacato_quadros (id) on delete cascade,
  nome      text not null,
  posicao   double precision not null,
  capa      text,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists abacato_colunas_quadro_idx on public.abacato_colunas (quadro_id, posicao) where not arquivada;

create table if not exists public.abacato_cards (
  id         uuid primary key default gen_random_uuid(),
  coluna_id  uuid not null references public.abacato_colunas (id) on delete cascade,
  titulo     text not null,
  descricao  text,
  posicao    double precision not null,
  inicio_em  timestamptz,
  fim_em     timestamptz,
  capa       text,
  arquivado  boolean not null default false,
  criado_em  timestamptz not null default now(),
  -- De onde veio, quando veio de fora. Guardar o id do Trello permite reimportar o mesmo
  -- quadro sem duplicar card — e é a única forma de a importação ser repetível.
  origem     text,
  origem_id  text
);
create index if not exists abacato_cards_coluna_idx on public.abacato_cards (coluna_id, posicao) where not arquivado;
create index if not exists abacato_cards_prazo_idx on public.abacato_cards (fim_em) where fim_em is not null and not arquivado;
create unique index if not exists abacato_cards_origem_idx on public.abacato_cards (origem, origem_id) where origem_id is not null;

-- ============================================================ etiquetas, responsáveis, links

create table if not exists public.abacato_etiquetas (
  id        uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.abacato_quadros (id) on delete cascade,
  nome      text not null default '',
  cor       text not null
);
create index if not exists abacato_etiquetas_quadro_idx on public.abacato_etiquetas (quadro_id);

create table if not exists public.abacato_card_etiquetas (
  card_id    uuid not null references public.abacato_cards (id) on delete cascade,
  etiqueta_id uuid not null references public.abacato_etiquetas (id) on delete cascade,
  primary key (card_id, etiqueta_id)
);

create table if not exists public.abacato_card_responsaveis (
  card_id    uuid not null references public.abacato_cards (id) on delete cascade,
  usuario_id uuid not null references public.abacato_usuarios (id) on delete cascade,
  primary key (card_id, usuario_id)
);

create table if not exists public.abacato_links (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.abacato_cards (id) on delete cascade,
  url       text not null,
  titulo    text,
  criado_em timestamptz not null default now()
);

-- ============================================================ checklists

create table if not exists public.abacato_checklists (
  id      uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.abacato_cards (id) on delete cascade,
  titulo  text not null default 'Checklist',
  posicao double precision not null
);

create table if not exists public.abacato_checklist_itens (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.abacato_checklists (id) on delete cascade,
  texto        text not null,
  feito        boolean not null default false,
  posicao      double precision not null
);
create index if not exists abacato_checklist_itens_idx on public.abacato_checklist_itens (checklist_id, posicao);

-- ============================================================ recorrência

-- Um card que se repete. O MODELO fica aqui e cada ocorrência vira um card de verdade — em vez
-- de um card "mágico" que muda de data sozinho. Assim o histórico do que foi feito em cada
-- ciclo continua existindo, que é justamente o que se perde quando se reaproveita o mesmo card.
create table if not exists public.abacato_recorrencias (
  id            uuid primary key default gen_random_uuid(),
  coluna_id     uuid not null references public.abacato_colunas (id) on delete cascade,
  titulo        text not null,
  descricao     text,
  regra         text not null,              -- diaria | semanal:1,3,5 | mensal:15
  proxima_em    timestamptz not null,
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create index if not exists abacato_recorrencias_proxima_idx on public.abacato_recorrencias (proxima_em) where ativa;

-- ============================================================ segurança

-- Tudo passa pela chave de serviço, vinda do servidor — nenhum navegador fala com o Postgres
-- direto. RLS ligada é a rede de segurança para o dia em que isso mudar: sem política, a tabela
-- fica fechada por padrão em vez de aberta.
do $$
declare t text;
begin
  foreach t in array array[
    'abacato_usuarios','abacato_quadros','abacato_membros','abacato_colunas','abacato_cards',
    'abacato_etiquetas','abacato_card_etiquetas','abacato_card_responsaveis','abacato_links',
    'abacato_checklists','abacato_checklist_itens','abacato_recorrencias'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
