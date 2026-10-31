-- 023 — Cartões, revisão da turma e torres de tema (31/10/2026). Pode rodar duas vezes sem estragar nada.
--
-- O que tinha ficado para depois na proposta dos cursos que não são de programação:
--
--   proof_cartoes     os cartões com repetição espaçada (frente e verso) de cada trilha, com a agenda
--                     do SM-2 (src/dominio/cartoes.js). A Lisa cria os do assunto da vez; a pessoa
--                     escreve os dela.
--   proof_revisoes    a revisão da turma (src/dominio/revisoes.js): o pedido de quem contesta um
--                     critério que a Lisa deu como não cumprido e o veredito de um colega. Guarda uma
--                     cópia do que já ficava no desafio (texto, link do vídeo, miniaturas das fotos) —
--                     sem nome de ninguém para quem revisa. Nenhum áudio, nenhuma foto inteira.
--   proof_dominios    a torre de TEMA no Modo Domínio (música, idiomas, matemática ou livre): sem
--                     repositório, cada andar entregue por texto, fotos, áudio ou vídeo do YouTube.
--
-- E os tipos "cartoes" e "revisao" no livro de pontos (os pontos viram moedas, ranking e ofensiva).
-- Ritmo e afinação ao vivo não mexem no banco: o motor mora no `conteudo` jsonb de proof_desafios.
--
-- Aplicar:  npm run migrar -- db/023-cartoes-turma-e-torres-de-tema.sql

-- ---------------------------------------------------------------- os cartões

create table if not exists public.proof_cartoes (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.abacato_usuarios(id) on delete cascade,
  trilha_id    uuid not null references public.proof_trilhas(id) on delete cascade,
  card_id      uuid,                              -- o assunto (card do Abacato) de onde veio; sem FK de propósito
  frente       text not null check (char_length(frente) between 1 and 200),
  verso        text not null check (char_length(verso) between 1 and 400),
  exemplo      text not null default '' check (char_length(exemplo) <= 300),
  origem       text not null default 'lisa' check (origem in ('lisa', 'pessoa')),
  intervalo    smallint not null default 0,       -- em dias
  facilidade   numeric(4, 2) not null default 2.5,
  repeticoes   smallint not null default 0,
  lapsos       smallint not null default 0,
  proxima_em   date not null default current_date,
  revisado_em  timestamptz,
  criado_em    timestamptz not null default now()
);
create index if not exists proof_cartoes_agenda on public.proof_cartoes (usuario_id, proxima_em);
create index if not exists proof_cartoes_trilha on public.proof_cartoes (trilha_id, criado_em);
alter table public.proof_cartoes enable row level security;

-- ---------------------------------------------------------------- a revisão da turma

create table if not exists public.proof_revisoes (
  id            uuid primary key default gen_random_uuid(),
  desafio_id    uuid not null unique references public.proof_desafios(id) on delete cascade,
  autor_id      uuid not null references public.abacato_usuarios(id) on delete cascade,
  revisor_id    uuid references public.abacato_usuarios(id) on delete set null,
  perfil        text not null,
  tema          text not null,
  tipo          text not null,                   -- o tipo do desafio (exercicio, projeto_semanal, projeto_final)
  titulo        text not null,
  enunciado     text not null default '',
  criterios     jsonb not null,                  -- [{ texto, atendido, observacao }] como a Lisa avaliou
  contestados   jsonb not null,                  -- [{ indice, justificativa }]
  entrega       jsonb not null,                  -- { texto, video, miniaturas, audio: { segundos } }
  status        text not null default 'aberta' check (status in ('aberta', 'revisada')),
  vereditos     jsonb,                           -- [{ indice, veredito, observacao }]
  comentario    text,
  confirmados   smallint,
  criado_em     timestamptz not null default now(),
  revisado_em   timestamptz
);
create index if not exists proof_revisoes_fila on public.proof_revisoes (status, criado_em);
create index if not exists proof_revisoes_autor on public.proof_revisoes (autor_id, criado_em desc);
create index if not exists proof_revisoes_revisor on public.proof_revisoes (revisor_id, revisado_em desc);
alter table public.proof_revisoes enable row level security;

-- ---------------------------------------------------------------- a torre de tema

alter table public.proof_dominios add column if not exists origem text not null default 'repositorio';
alter table public.proof_dominios add column if not exists perfil text;
alter table public.proof_dominios add column if not exists tema text;
alter table public.proof_dominios alter column provedor drop not null;
alter table public.proof_dominios alter column repo_caminho drop not null;
alter table public.proof_dominios alter column repo_url drop not null;
alter table public.proof_dominios drop constraint if exists proof_dominios_origem_check;
alter table public.proof_dominios add constraint proof_dominios_origem_check check (
  (origem = 'repositorio' and provedor is not null and repo_caminho is not null and repo_url is not null)
  or (origem = 'tema' and tema is not null and perfil in ('musica', 'idiomas', 'matematica', 'livre'))
);

-- ---------------------------------------------------------------- o livro de pontos

alter table public.proof_eventos drop constraint if exists proof_eventos_tipo_check;
alter table public.proof_eventos add constraint proof_eventos_tipo_check check (tipo in (
  'item', 'card', 'meta_diaria',
  'quiz', 'exercicio', 'projeto_semanal', 'projeto_final', 'projeto_mensal',
  'conquista', 'dominio', 'cartoes', 'revisao'
));

notify pgrst, 'reload schema';
