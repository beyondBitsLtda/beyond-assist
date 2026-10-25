-- Lisa_Proof — Cadernos, Biblioteca e cursos a partir de livros (pedido de 25/10/2026):
-- "um caderno de notas tipo Notepad++, com identificação de sintaxe… vários cadernos, linkar com
-- trilhas, cursos, torres de domínio, até páginas e módulos específicos do caderno… uma biblioteca
-- onde eu possa subir PDF e ler com marcação, igual aos melhores leitores… e gerar cursos com base
-- nesses livros". As regras moram em src/dominio/cadernos.js, biblioteca.js e cursoDoLivro.js.
--
--   proof_cadernos          um caderno (título, cor, ícone)
--   proof_caderno_paginas   um módulo (seção) ou uma página do caderno; a página pode morar num
--                           módulo. `versao` sobe a cada gravação: é o que impede uma aba velha de
--                           apagar o que outra aba (ou outro aparelho) acabou de gravar
--   proof_vinculos          o caderno inteiro, ou uma página/módulo dele, ligado a uma trilha, um
--                           assunto, uma torre, um andar ou um livro (e a página do livro)
--   proof_livros            um PDF da biblioteca: o arquivo no Storage, o sumário, a capa, onde parou
--   proof_livro_paginas     o texto de cada página (extraído no navegador ao subir): busca, cursos
--                           e as perguntas da Lisa leem daqui, sem abrir o PDF de novo
--   proof_marcacoes         destaques, sublinhados, áreas, notas e marcadores de página
--   proof_leituras          as páginas do livro que cada assunto de um curso do livro cobre
--
-- E o bucket PRIVADO proof-biblioteca (os PDFs, no disco do iMac, como os documentos do Abacato).
--
-- Só ACRESCENTA. Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/019-cadernos-e-biblioteca.sql

-- ============================================================ cadernos

create table if not exists public.proof_cadernos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.abacato_usuarios(id) on delete cascade,
  titulo         text not null check (char_length(titulo) between 1 and 120),
  descricao      text not null default '',
  cor            text not null default 'vermelho',
  icone          text not null default '📓',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists proof_cadernos_usuario on public.proof_cadernos (usuario_id, atualizado_em desc);

create table if not exists public.proof_caderno_paginas (
  id             uuid primary key default gen_random_uuid(),
  caderno_id     uuid not null references public.proof_cadernos(id) on delete cascade,
  modulo_id      uuid references public.proof_caderno_paginas(id) on delete cascade, -- null = na raiz
  tipo           text not null default 'pagina' check (tipo in ('modulo', 'pagina')),
  titulo         text not null check (char_length(titulo) between 1 and 160),
  linguagem      text not null default 'markdown',
  conteudo       text not null default '' check (octet_length(conteudo) <= 1048576), -- 1 MB por página
  ordem          integer not null default 0,
  versao         integer not null default 1,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists proof_caderno_paginas_caderno on public.proof_caderno_paginas (caderno_id, ordem);

-- ============================================================ biblioteca

create table if not exists public.proof_livros (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references public.abacato_usuarios(id) on delete cascade,
  titulo             text not null check (char_length(titulo) between 1 and 200),
  autor              text not null default '',
  arquivo            text not null,               -- caminho no bucket: <usuario>/<livro>.pdf
  tamanho            bigint not null check (tamanho > 0),
  paginas            integer not null check (paginas between 1 and 5000),
  sumario            jsonb not null default '[]'::jsonb, -- [{ titulo, pagina, nivel }]
  capa               text,                        -- miniatura da 1ª página (data:image/jpeg)
  status             text not null default 'enviando' check (status in ('enviando', 'lendo', 'pronto')),
  paginas_com_texto  integer not null default 0,
  ultima_pagina      integer not null default 1,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  lido_em            timestamptz
);
create index if not exists proof_livros_usuario on public.proof_livros (usuario_id, criado_em desc);

create table if not exists public.proof_livro_paginas (
  livro_id  uuid not null references public.proof_livros(id) on delete cascade,
  numero    integer not null check (numero >= 1),
  texto     text not null default '',
  primary key (livro_id, numero)
);

create table if not exists public.proof_marcacoes (
  id             uuid primary key default gen_random_uuid(),
  livro_id       uuid not null references public.proof_livros(id) on delete cascade,
  pagina         integer not null check (pagina >= 1),
  tipo           text not null default 'destaque' check (tipo in ('destaque', 'sublinhado', 'area', 'marcador')),
  cor            text not null default 'amarelo',
  texto          text not null default '',
  nota           text not null default '',
  retangulos     jsonb not null default '[]'::jsonb, -- [[x, y, largura, altura]] de 0 a 1 na página
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists proof_marcacoes_livro on public.proof_marcacoes (livro_id, pagina);

-- ============================================================ vínculos

create table if not exists public.proof_vinculos (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.abacato_usuarios(id) on delete cascade,
  caderno_id   uuid not null references public.proof_cadernos(id) on delete cascade,
  pagina_id    uuid references public.proof_caderno_paginas(id) on delete cascade, -- null = o caderno inteiro
  alvo_tipo    text not null check (alvo_tipo in ('trilha', 'assunto', 'torre', 'andar', 'livro')),
  alvo_id      uuid not null,     -- a trilha, o card (assunto), a torre (proof_dominios) ou o livro
  alvo_numero  integer,           -- o andar da torre, ou a página do livro
  rotulo       text not null default '', -- o nome do alvo quando foi vinculado (se ele sumir, ainda diz o que era)
  criado_em    timestamptz not null default now()
);
create unique index if not exists proof_vinculos_unico on public.proof_vinculos (
  caderno_id, coalesce(pagina_id, '00000000-0000-0000-0000-000000000000'::uuid), alvo_tipo, alvo_id, coalesce(alvo_numero, 0)
);
create index if not exists proof_vinculos_alvo on public.proof_vinculos (usuario_id, alvo_tipo, alvo_id);

-- ============================================================ cursos a partir de um livro

alter table public.proof_trilhas add column if not exists livro_id uuid references public.proof_livros(id) on delete set null;

create table if not exists public.proof_leituras (
  card_id   uuid primary key references public.abacato_cards(id) on delete cascade,
  livro_id  uuid not null references public.proof_livros(id) on delete cascade,
  de        integer not null check (de >= 1),
  ate       integer not null,
  secao     text not null default '',
  check (ate >= de)
);
create index if not exists proof_leituras_livro on public.proof_leituras (livro_id);

-- ============================================================ funções (o trabalho pesado fica no banco)
-- O Worker gratuito tem pouco processamento por pedido: juntar e cortar o texto de 300 páginas
-- lá dentro estoura o limite. Aqui o Postgres faz isso e devolve só o pedaço que importa.

-- O texto de faixas de páginas, cada faixa cortada em `por_faixa` caracteres. faixas: [{ "de": 1, "ate": 12 }]
create or replace function public.proof_trechos_do_livro(livro uuid, faixas jsonb, por_faixa integer)
returns table (de integer, ate integer, trecho text, caracteres integer)
language sql stable
as $$
  select f.de, f.ate,
         left(coalesce(string_agg('[p. ' || p.numero || '] ' || p.texto, E'\n' order by p.numero), ''), greatest(por_faixa, 0)) as trecho,
         coalesce(sum(char_length(p.texto)), 0)::integer as caracteres
  from jsonb_to_recordset(faixas) as f(de integer, ate integer)
  left join public.proof_livro_paginas p
    on p.livro_id = livro and p.numero between f.de and f.ate
  group by f.de, f.ate
  order by f.de;
$$;

-- As páginas onde o termo aparece, com um pedaço do texto em volta (sem diferenciar maiúsculas).
create or replace function public.proof_busca_no_livro(livro uuid, termo text, limite integer)
returns table (numero integer, trecho text, vezes integer)
language sql stable
as $$
  select p.numero,
         substr(p.texto, greatest(strpos(lower(p.texto), lower(termo)) - 80, 1), 220) as trecho,
         ((char_length(p.texto) - char_length(replace(lower(p.texto), lower(termo), ''))) / greatest(char_length(termo), 1))::integer as vezes
  from public.proof_livro_paginas p
  where p.livro_id = livro and char_length(termo) >= 2 and strpos(lower(p.texto), lower(termo)) > 0
  order by p.numero
  limit least(greatest(limite, 1), 300);
$$;

-- Só o servidor (chave de serviço) chama estas funções: por padrão o Postgres deixa qualquer papel
-- executar, e a chave anônima não pode ler o texto de um livro só por saber o id dele.
revoke all on function public.proof_trechos_do_livro(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.proof_busca_no_livro(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.proof_trechos_do_livro(uuid, jsonb, integer) to service_role;
grant execute on function public.proof_busca_no_livro(uuid, text, integer) to service_role;

-- ============================================================ RLS (fechado: só a chave de serviço, pelo servidor)

alter table public.proof_cadernos        enable row level security;
alter table public.proof_caderno_paginas enable row level security;
alter table public.proof_vinculos        enable row level security;
alter table public.proof_livros          enable row level security;
alter table public.proof_livro_paginas   enable row level security;
alter table public.proof_marcacoes       enable row level security;
alter table public.proof_leituras        enable row level security;

-- ============================================================ o bucket dos PDFs

-- PRIVADO: livro é de quem subiu. Cada abertura passa pelo servidor, que confere o dono e devolve
-- um endereço assinado de vida curta. O envio também: o servidor assina um endereço de envio para
-- aquele caminho, e o navegador manda o arquivo direto para o Storage (o PDF não atravessa o Worker).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-biblioteca', 'proof-biblioteca', false,
  52428800,                     -- 50 MB, o mesmo teto dos documentos do Abacato
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
