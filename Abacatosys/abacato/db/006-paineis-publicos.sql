-- Abacato System — o link que o cliente abre sem login.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/006-paineis-publicos.sql
-- É idempotente.
--
-- Era um dos pedidos originais: mandar ao cliente um endereço que mostre o andamento, sem
-- criar conta para ele, sem senha, sem nada para explicar.
--
-- Um link sem login é, por definição, acessível a quem tiver o endereço. O que protege é o
-- TOKEN: um sorteio longo o bastante para não ser adivinhado. E o que limita o estrago é o que
-- o link mostra — CONTAGENS e títulos, nunca descrição, comentário, anexo ou quem é responsável
-- pelo quê. Um painel de cliente responde "como está indo", e não "o que exatamente vocês
-- escreveram sobre mim".
create table if not exists public.abacato_paineis_publicos (
  id         uuid primary key default gen_random_uuid(),
  quadro_id  uuid not null references public.abacato_quadros (id) on delete cascade,
  -- O endereço em si. Único, porque é por ele que se encontra o painel.
  token      text not null unique,
  -- O que o cliente vê como título. Quase nunca é o nome interno do quadro: "Quarto de Guerra"
  -- não diz nada a quem está do lado de fora.
  titulo     text,
  -- Mostrar os títulos dos cards, ou só os números? Alguns quadros têm títulos que ninguém
  -- quer mostrar ao cliente, e um painel só de contagens continua sendo útil.
  com_titulos boolean not null default true,
  ativo      boolean not null default true,
  -- Um link que vence sozinho é melhor que um link eterno que ninguém lembra de desligar.
  -- Nulo significa "não vence" — é escolha de quem cria.
  expira_em  timestamptz,
  criado_por uuid references public.abacato_usuarios (id) on delete set null,
  criado_em  timestamptz not null default now(),
  -- Quando foi aberto pela última vez, e quantas vezes. Serve para saber se o cliente olhou —
  -- e para perceber um link que alguém encontrou e não deveria.
  visto_em   timestamptz,
  vistas     bigint not null default 0
);

create index if not exists abacato_paineis_quadro_idx on public.abacato_paineis_publicos (quadro_id) where ativo;

alter table public.abacato_paineis_publicos enable row level security;
-- (só acessada pela chave de serviço, a partir do servidor — mesmo padrão das demais)
