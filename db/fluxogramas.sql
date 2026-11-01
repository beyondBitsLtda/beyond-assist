-- ============================================================
--  PROCESSMAP NA LISA — projetos e fluxogramas guardados (01/11/2026)
--
--  Rodar (é idempotente):
--    docker exec -i supabase-db psql -U postgres -d postgres < db/fluxogramas.sql
--  ou, de fora de casa, pelo mesmo caminho que o Studio usa (/pg/query, com a chave de serviço):
--    node --env-file=<arquivo com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY> Abacatosys/lisa-proof/scripts/migrar.mjs db/fluxogramas.sql
--
--  Pedido: "quero poder usar o processmap livremente de dentro da Lisa, podendo criar projetos e
--  salvar os fluxogramas, inclusive os fluxos que a Lisa desenha". Até aqui o ProcessMap
--  (public/diagramas) só guardava o desenho baixando um .json, e o quadro da Lisa perdia o desenho
--  ao fechar a janela.
--
--  Um projeto é uma pasta de fluxogramas. O fluxograma guarda o documento inteiro do ProcessMap
--  (o mesmo JSON do "Exportar", formato 4: abas, formas, ligações, imagens coladas em base64) — o
--  banco não interpreta o desenho, só o devolve igual. `formas` e `modo` ficam de fora do JSON para
--  a lista mostrar sem baixar documento nenhum.
--
--  Cada linha tem dono (o usuário da sessão da Lisa, o "sub" do token do Supabase Auth): a rota
--  filtra por ele, então uma pessoa nunca vê nem grava os fluxos de outra. Excluir é arquivar —
--  nada some do banco por um clique errado.
-- ============================================================

create table if not exists public.lisa_projetos (
  id            uuid primary key default gen_random_uuid(),
  dono_id       uuid not null,
  nome          text not null check (char_length(nome) between 1 and 80),
  descricao     text not null default '' check (char_length(descricao) <= 500),
  arquivado     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists lisa_projetos_dono_idx
  on public.lisa_projetos (dono_id, arquivado, atualizado_em desc);

create table if not exists public.lisa_fluxogramas (
  id            uuid primary key default gen_random_uuid(),
  dono_id       uuid not null,
  projeto_id    uuid not null references public.lisa_projetos (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 120),
  documento     jsonb not null,
  modo          text not null default 'diagram' check (modo in ('diagram', 'mindmap')),
  -- quem começou o desenho: a pessoa no ProcessMap ou a Lisa no quadro dela
  origem        text not null default 'pessoa' check (origem in ('pessoa', 'lisa')),
  formas        integer not null default 0,
  -- sobe a cada gravação: duas abas mexendo no mesmo fluxo não se sobrescrevem sem aviso
  versao        integer not null default 1,
  arquivado     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists lisa_fluxogramas_projeto_idx
  on public.lisa_fluxogramas (projeto_id, arquivado, atualizado_em desc);
create index if not exists lisa_fluxogramas_dono_idx
  on public.lisa_fluxogramas (dono_id, arquivado);

alter table public.lisa_projetos enable row level security;
alter table public.lisa_fluxogramas enable row level security;
-- (só acessadas pela service_role, pelas rotas da Lisa — mesmo padrão das outras tabelas)
