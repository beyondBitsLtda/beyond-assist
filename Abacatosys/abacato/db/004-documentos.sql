-- Abacato System — o repositório de documentos.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/004-documentos.sql
-- É idempotente.
--
-- A ideia: PROJETOS guardam PASTAS (que aninham), pastas guardam DOCUMENTOS, e cada documento
-- guarda REVISÕES. O arquivo em si vive no Storage do iMac; aqui ficam só os nomes, a árvore e
-- a história.

-- ============================================================ projetos

create table if not exists public.abacato_projetos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  descricao     text,
  -- Uma cor por projeto, da mesma paleta dos quadros. Numa lista que vai crescer, ela é o que
  -- permite achar o projeto certo sem ler nome por nome.
  cor           text,
  dono_id       uuid not null references public.abacato_usuarios (id) on delete cascade,
  arquivado     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists abacato_projetos_dono_idx on public.abacato_projetos (dono_id) where not arquivado;

-- Mesmo desenho dos membros de quadro, em tabela própria: um projeto de documentação e um
-- quadro são coisas diferentes, e misturar os dois numa tabela só obrigaria toda consulta a
-- carregar uma coluna de "que tipo de coisa é esta" que nunca é a pergunta real.
create table if not exists public.abacato_projeto_membros (
  projeto_id uuid not null references public.abacato_projetos (id) on delete cascade,
  usuario_id uuid not null references public.abacato_usuarios (id) on delete cascade,
  papel      text not null default 'editor',  -- dono | editor | comentarista | leitor
  criado_em  timestamptz not null default now(),
  primary key (projeto_id, usuario_id)
);

-- ============================================================ pastas, que aninham

-- `pai_id` aponta para outra pasta do MESMO projeto — é o que faz subpasta existir.
--
-- O `on delete cascade` apontando para si mesma apaga a subárvore inteira quando uma pasta
-- some. É o comportamento certo, e é justamente por ser tão definitivo que a tela nunca apaga:
-- ela arquiva.
create table if not exists public.abacato_pastas (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.abacato_projetos (id) on delete cascade,
  pai_id     uuid references public.abacato_pastas (id) on delete cascade,
  nome       text not null,
  posicao    double precision not null default 1024,
  arquivada  boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists abacato_pastas_projeto_idx on public.abacato_pastas (projeto_id) where not arquivada;
create index if not exists abacato_pastas_pai_idx on public.abacato_pastas (pai_id);

-- ============================================================ documentos

-- `pasta_id` nulo significa "na raiz do projeto". É melhor que inventar uma pasta-raiz
-- invisível: com a pasta falsa, toda consulta precisaria saber ignorá-la, e o dia em que
-- alguém a renomeasse seria muito confuso.
--
-- `revisao_atual_id` aponta para a revisão que vale agora. Sem esta coluna, "qual é a versão
-- atual" viraria um `order by numero desc limit 1` em toda listagem — e a listagem de um
-- projeto com 200 documentos faria 200 dessas.
create table if not exists public.abacato_documentos (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references public.abacato_projetos (id) on delete cascade,
  pasta_id         uuid references public.abacato_pastas (id) on delete set null,
  nome             text not null,
  -- Categoria é texto livre com sugestões na tela, e não uma tabela de categorias. Uma tabela
  -- obrigaria a cadastrar antes de usar, e o custo disso é documento sem categoria nenhuma.
  categoria        text,
  descricao        text,
  revisao_atual_id uuid,
  arquivado        boolean not null default false,
  criado_por       uuid references public.abacato_usuarios (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  -- De onde veio, quando veio de fora: 'doc-gen' para o que os geradores produzem.
  origem           text,
  origem_id        text
);
create index if not exists abacato_documentos_projeto_idx on public.abacato_documentos (projeto_id) where not arquivado;
create index if not exists abacato_documentos_pasta_idx on public.abacato_documentos (pasta_id) where not arquivado;
create unique index if not exists abacato_documentos_origem_idx on public.abacato_documentos (origem, origem_id);

-- ============================================================ revisões

-- Cada envio de arquivo é uma revisão NOVA, e as antigas ficam.
--
-- O caminho mais fácil seria sobrescrever o arquivo no Storage e guardar só a data. Aí "o que
-- mudou da versão 2 para a 3?" deixa de ter resposta, e "o cliente aprovou qual versão?"
-- também — que são as duas perguntas que um repositório de documentos existe para responder.
create table if not exists public.abacato_revisoes (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.abacato_documentos (id) on delete cascade,
  numero       integer not null,
  caminho      text not null,          -- onde o arquivo está no bucket abacato-documentos
  tipo         text not null,          -- o content-type, para servir e para saber como abrir
  tamanho      bigint not null default 0,
  nota         text,                   -- "corrigido o valor da parcela 3"
  criado_por   uuid references public.abacato_usuarios (id) on delete set null,
  criado_em    timestamptz not null default now()
);
-- Duas revisões com o mesmo número no mesmo documento seriam duas "versão 3" diferentes.
create unique index if not exists abacato_revisoes_numero_idx on public.abacato_revisoes (documento_id, numero);
create index if not exists abacato_revisoes_doc_idx on public.abacato_revisoes (documento_id, numero desc);

-- A ligação do documento para a revisão atual só pode ser criada DEPOIS da tabela de revisões
-- existir. `not valid` não é preciso aqui porque as duas nascem vazias.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'abacato_documentos_revisao_fk'
  ) then
    alter table public.abacato_documentos
      add constraint abacato_documentos_revisao_fk
      foreign key (revisao_atual_id) references public.abacato_revisoes (id) on delete set null;
  end if;
end $$;

-- ============================================================ segurança

do $$
declare t text;
begin
  foreach t in array array[
    'abacato_projetos','abacato_projeto_membros','abacato_pastas',
    'abacato_documentos','abacato_revisoes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
