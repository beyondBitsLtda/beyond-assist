-- Lisa_Proof — trilhas de estudo em cima dos quadros STUDY do Abacato.
--
-- Mesmo Postgres da Lisa e do Abacato, tabelas com prefixo `proof_`. O conteúdo (cards,
-- checklists, itens) continua morando nas tabelas do Abacato: aqui fica só o que o Abacato não
-- tem — a ordem da trilha, os pontos, a ofensiva e as explicações da IA.
--
-- Escrito para poder rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/001-proof.sql

-- ------------------------------------------------------------------ perfil
-- Uma linha por pessoa, criada na primeira vez que ela muda alguma preferência. Quem nunca
-- mudou nada usa os padrões do código (META_DIARIA_PADRAO).
create table if not exists public.proof_perfis (
  usuario_id    uuid primary key references public.abacato_usuarios(id) on delete cascade,
  meta_diaria   integer not null default 30 check (meta_diaria between 10 and 500),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------------ trilhas
-- Uma trilha por quadro STUDY por pessoa. O quadro é a fonte do conteúdo; a trilha é a ORDEM
-- em que esse conteúdo vai ser estudado, independente das colunas do quadro.
create table if not exists public.proof_trilhas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.abacato_usuarios(id) on delete cascade,
  quadro_id      uuid not null references public.abacato_quadros(id) on delete cascade,
  tema           text not null,
  inicio_em      date not null,
  -- Dias da semana em que a pessoa estuda (0 = domingo ... 6 = sábado).
  dias_de_estudo smallint[] not null default '{1,2,3,4,5}',
  resumo         text,
  gerada_por     text not null default 'ia' check (gerada_por in ('ia', 'ordem')),
  status         text not null default 'ativa' check (status in ('ativa', 'pausada', 'concluida')),
  criada_em      timestamptz not null default now(),
  atualizada_em  timestamptz not null default now(),
  unique (usuario_id, quadro_id)
);

-- ------------------------------------------------------------------ etapas
-- Cada card do quadro vira uma etapa com período planejado. `inicio`/`fim` nulos querem dizer
-- "já estava concluído quando a trilha foi montada": entra no progresso, não ocupa agenda.
create table if not exists public.proof_etapas (
  id        uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references public.proof_trilhas(id) on delete cascade,
  card_id   uuid not null references public.abacato_cards(id) on delete cascade,
  ordem     integer not null,
  semana    integer,
  inicio    date,
  fim       date,
  dias      smallint not null default 1,
  nivel     text not null default 'basico' check (nivel in ('basico', 'intermediario', 'avancado')),
  objetivo  text,
  unique (trilha_id, card_id)
);
create index if not exists proof_etapas_trilha_ordem on public.proof_etapas (trilha_id, ordem);

-- ------------------------------------------------------------------ eventos (pontos)
-- Tudo que vale ponto vira uma linha. A ofensiva sai daqui: um dia conta se tem evento.
--
-- `chave` é o que impede ganhar duas vezes pela mesma coisa (`item:<id>`, `card:<id>`,
-- `meta:<dia>`). Desmarcar e marcar de novo um item de outro dia não gera ponto nem salva
-- ofensiva — senão bastava um clique duplo por dia para manter a sequência.
--
-- Os tipos de prática (quiz, exercício, projetos) já estão na lista para a fase 2 não
-- precisar de migração só para isso.
create table if not exists public.proof_eventos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.abacato_usuarios(id) on delete cascade,
  trilha_id  uuid references public.proof_trilhas(id) on delete set null,
  tipo       text not null check (tipo in (
               'item', 'card', 'meta_diaria',
               'quiz', 'exercicio', 'projeto_semanal', 'projeto_mensal')),
  chave      text not null,
  pontos     integer not null default 0,
  -- O dia no fuso de São Paulo, gravado pronto. Calcular a partir de `criado_em` em cada
  -- consulta faria um evento das 22h contar para o dia seguinte (UTC).
  dia        date not null,
  detalhe    jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now(),
  unique (usuario_id, chave)
);
create index if not exists proof_eventos_usuario_dia on public.proof_eventos (usuario_id, dia);

-- ------------------------------------------------------------------ explicações da IA
-- Guardadas para não gastar cota do modelo toda vez que a pessoa reabre o mesmo assunto.
create table if not exists public.proof_explicacoes (
  usuario_id uuid not null references public.abacato_usuarios(id) on delete cascade,
  card_id    uuid not null references public.abacato_cards(id) on delete cascade,
  texto      text not null,
  criada_em  timestamptz not null default now(),
  primary key (usuario_id, card_id)
);

-- ------------------------------------------------------------------ RLS
-- Mesma política do Abacato: RLS ligado e nenhuma policy. Só a service role (o servidor)
-- alcança estas tabelas; quem decide o que cada pessoa vê é o código, num lugar só.
alter table public.proof_perfis      enable row level security;
alter table public.proof_trilhas     enable row level security;
alter table public.proof_etapas      enable row level security;
alter table public.proof_eventos     enable row level security;
alter table public.proof_explicacoes enable row level security;
