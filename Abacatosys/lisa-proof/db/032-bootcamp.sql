-- 032 — Modo Bootcamp (04/11/2026). Pode rodar duas vezes sem estragar nada.
--
-- Um reality show de programação: até 8 competidores num escritório de TI em 3D, 3 jurados virtuais que lançam
-- o desafio de cada rodada e avaliam no fim dela, e dois formatos (mata-mata ou pontos corridos). As regras
-- moram em src/dominio/bootcamp.js; o banco, em src/lib/bootcamp.js.
--
--   proof_bootcamp_torneios   o torneio: quem organizou, o formato, o tempo opcional por desafio, as linguagens,
--                             os participantes (humanos e os personagens da Lisa, cada um com skin, nome e
--                             personalidade, num jsonb) e em que rodada está. `humanos` é a lista de contas que
--                             jogam: é por ela que cada pessoa acha os torneios em que está.
--   proof_bootcamp_rodadas    uma rodada por número: o desafio dos jurados (com os testes ocultos e a solução de
--                             referência, que só o servidor vê), os confrontos do mata-mata e a avaliação final.
--                             'avaliando' é a trava: só uma chamada aos jurados por vez.
--   proof_bootcamp_entregas   o trabalho de cada humano na rodada, no fluxo do exercício (leitura → análise →
--                             ambiente → código → testes → revisão → fim): o plano, o modo (editor ou GitHub),
--                             o código testado, o resultado dos testes e quando foi enviado aos jurados.

create table if not exists public.proof_bootcamp_torneios (
  id              uuid primary key default gen_random_uuid(),
  dono_id         uuid not null references public.abacato_usuarios(id) on delete cascade,
  nome            text not null check (char_length(nome) between 2 and 60),
  formato         text not null check (formato in ('mata-mata', 'pontos-corridos')),
  tempo_min       integer check (tempo_min is null or tempo_min between 5 and 240),
  linguagens      jsonb not null,
  rodadas_total   integer not null check (rodadas_total between 1 and 6),
  participantes   jsonb not null,
  humanos         uuid[] not null,
  rodada_atual    integer not null default 0,
  status          text not null default 'preparando' check (status in ('preparando', 'em-andamento', 'encerrado')),
  campeao         text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  encerrado_em    timestamptz
);
create index if not exists proof_bootcamp_torneios_humanos_idx on public.proof_bootcamp_torneios using gin (humanos);
create index if not exists proof_bootcamp_torneios_dono_idx on public.proof_bootcamp_torneios (dono_id, criado_em desc);
alter table public.proof_bootcamp_torneios enable row level security;

create table if not exists public.proof_bootcamp_rodadas (
  id            uuid primary key default gen_random_uuid(),
  torneio_id    uuid not null references public.proof_bootcamp_torneios(id) on delete cascade,
  numero        integer not null check (numero >= 1),
  desafio       jsonb not null,
  confrontos    jsonb,
  status        text not null default 'aberta' check (status in ('aberta', 'avaliando', 'avaliada')),
  avaliacao     jsonb,
  aberta_em     timestamptz not null default now(),
  prazo         timestamptz,
  avaliada_em   timestamptz,
  unique (torneio_id, numero)
);
alter table public.proof_bootcamp_rodadas enable row level security;

create table if not exists public.proof_bootcamp_entregas (
  id             uuid primary key default gen_random_uuid(),
  rodada_id      uuid not null references public.proof_bootcamp_rodadas(id) on delete cascade,
  torneio_id     uuid not null references public.proof_bootcamp_torneios(id) on delete cascade,
  usuario_id     uuid not null references public.abacato_usuarios(id) on delete cascade,
  etapa          text not null default 'leitura' check (etapa in ('leitura', 'analise', 'ambiente', 'codigo', 'testes', 'revisao', 'fim')),
  plano          text,
  modo           text check (modo is null or modo in ('editor', 'github')),
  linguagem      text,
  repo           text,
  caminho        text,
  codigo         text,
  commit_sha     text,
  testes         jsonb,
  passou         boolean not null default false,
  tentativas     integer not null default 0,
  enviada_em     timestamptz,
  atualizado_em  timestamptz not null default now(),
  unique (rodada_id, usuario_id)
);
create index if not exists proof_bootcamp_entregas_torneio_idx on public.proof_bootcamp_entregas (torneio_id);
alter table public.proof_bootcamp_entregas enable row level security;

notify pgrst, 'reload schema';
