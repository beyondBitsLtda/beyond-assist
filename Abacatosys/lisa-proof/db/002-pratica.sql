-- Lisa_Proof — parte prática (fases 2 e 3): quiz e exercício diários, projetos da semana e do mês.
--
-- Uma tabela só para os quatro tipos. Eles têm o mesmo ciclo — a Lisa gera, a pessoa responde
-- ou entrega, a Lisa avalia, vale ponto — e o que muda entre eles mora em `conteudo`, `resposta`
-- e `avaliacao` (jsonb). Quatro tabelas quase iguais seriam quatro lugares para esquecer uma
-- regra.
--
-- Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/002-pratica.sql

create table if not exists public.proof_desafios (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  trilha_id   uuid not null references public.proof_trilhas(id) on delete cascade,
  tipo        text not null check (tipo in ('quiz', 'exercicio', 'projeto_semanal', 'projeto_mensal')),
  -- O período a que o desafio pertence: o dia (quiz, exercício), a segunda-feira da semana
  -- (projeto semanal) ou o dia 1 do mês (projeto mensal).
  periodo     date not null,
  -- Os assuntos (cards do Abacato) que o desafio cobre. Sem chave estrangeira de propósito: um
  -- card apagado no Abacato não pode apagar a história de um quiz já feito.
  card_ids    uuid[] not null default '{}',
  titulo      text not null,
  conteudo    jsonb not null,
  status      text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido')),
  resposta    jsonb not null default '{}'::jsonb,
  avaliacao   jsonb,
  nota        integer check (nota between 0 and 100),
  pontos      integer not null default 0,
  tentativas  integer not null default 0,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Um de cada tipo por trilha e período. É o que faz dois cliques em "gerar quiz" não gastarem
  -- a IA duas vezes nem criarem dois quizzes do mesmo dia.
  unique (usuario_id, trilha_id, tipo, periodo)
);

create index if not exists proof_desafios_usuario_periodo on public.proof_desafios (usuario_id, periodo);

alter table public.proof_desafios enable row level security;
