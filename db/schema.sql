-- ============================================================
--  Beyond Bits — schema do "cérebro" (RAG)
--  Rode isto UMA vez no SQL Editor do projeto Supabase do Beyond Brain.
-- ============================================================

-- 1) Extensão de vetores
create extension if not exists vector;

-- 2) Tabela de documentos indexados (Trello + Beyond Brain)
create table if not exists public.documents (
  id            bigint generated always as identity primary key,
  source        text not null,                 -- 'trello' | 'brain'
  external_id   text,                           -- id do card / da nota (+ #chunk)
  board         text,                           -- board do Trello ou ref da nota
  title         text,
  content       text not null,
  embedding     vector(768),                    -- bate com GEMINI_EMBED_DIM=768
  last_modified timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (source, external_id)                  -- permite upsert idempotente
);

-- 3) Índice de similaridade (cosseno)
create index if not exists documents_embedding_idx
  on public.documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists documents_source_idx on public.documents (source);
create index if not exists documents_last_modified_idx on public.documents (last_modified desc);

-- 4) Função de busca por similaridade
--    similarity = 1 - distância_cosseno  (1.0 = idêntico)
create or replace function public.match_documents(
  query_embedding vector(768),
  match_count     int   default 5,
  min_similarity  float default 0.0,
  filter_source   text  default null
)
returns table (
  id            bigint,
  source        text,
  external_id   text,
  board         text,
  title         text,
  content       text,
  last_modified timestamptz,
  metadata      jsonb,
  similarity    float
)
language sql stable
as $$
  select
    d.id, d.source, d.external_id, d.board, d.title, d.content,
    d.last_modified, d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
    and (filter_source is null or d.source = filter_source)
    and 1 - (d.embedding <=> query_embedding) >= min_similarity
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- 5) RLS: a tabela documents é acessada só pela service_role (servidor),
--    então habilitamos RLS sem policies públicas (nega qualquer acesso anon).
alter table public.documents enable row level security;
-- (a service_role ignora RLS por design; o cliente anon fica sem acesso)

-- ============================================================
--  Notificações push — rode esta seção UMA vez a mais (aditivo,
--  não mexe nas tabelas acima). Guarda inscrições de push e o
--  registro de "já avisei sobre isso", pra não repetir notificação
--  a cada ciclo de verificação do cron.
-- ============================================================

-- 6) Inscrições Web Push (uma por dispositivo/navegador que ativou notificações)
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- 7) Registro de eventos já notificados (idempotência do cron de notificação)
create table if not exists public.notified_events (
  id          bigint generated always as identity primary key,
  event_type  text not null,   -- 'ticket_new' | 'ticket_reopened' | 'ticket_sla_breach' | 'ticket_sla_near' | 'trello_card_new' | 'trello_task_overdue'
  entity_id   text not null,   -- id do chamado/card (composto com timestamp p/ eventos repetíveis, ex. reabertura)
  created_at  timestamptz not null default now(),
  unique (event_type, entity_id)
);

alter table public.notified_events enable row level security;
create index if not exists notified_events_type_idx on public.notified_events (event_type);

-- 8) Último status conhecido de cada chamado do Sentinela — necessário pra detectar
--    reabertura (Resolvido/Fechado → Aberto), já que a API do Sentinela não guarda
--    histórico de transição de status.
create table if not exists public.sentinel_ticket_snapshot (
  ticket_id   uuid primary key,
  status      text not null,
  checked_at  timestamptz not null default now()
);

alter table public.sentinel_ticket_snapshot enable row level security;
-- (as 3 tabelas acima só são acessadas pela service_role, nas rotas /api/notifications
-- e /api/cron/notify — mesmo padrão de "nega tudo pro anon" da tabela documents)

-- ============================================================
--  SYNC automático (a cada hora) — rode esta seção UMA vez a mais (aditivo).
--  Guarda o progresso do ciclo de reindexação disparado pelo pg_cron do Supabase
--  (ver db/cron.sql), já que uma sincronização completa não cabe numa única chamada
--  de função da Vercel (limite de 60s no plano Hobby) — o progresso avança 1 fatia por
--  minuto, e esta linha única (id=1) é onde cada tick sabe em que passo retomar.
-- ============================================================

-- 9) Progresso do ciclo de SYNC (linha única, id sempre 1)
create table if not exists public.sync_progress (
  id           int primary key default 1,
  status       text not null default 'idle',  -- 'idle' | 'running'
  step_index   int not null default 0,        -- índice do passo atual (boards do Trello + brain)
  offset_val   int not null default 0,        -- offset de chunks dentro do passo atual
  grand_total  int not null default 0,        -- total de chunks processados neste ciclo
  started_at   timestamptz,
  last_error   text,
  updated_at   timestamptz not null default now(),
  constraint sync_progress_singleton check (id = 1)
);

insert into public.sync_progress (id) values (1) on conflict (id) do nothing;

alter table public.sync_progress enable row level security;
-- (só acessada pela service_role, em /api/cron/sync — mesmo padrão das tabelas acima)

-- ============================================================
--  Notificações DENTRO do app (a mais, aditivo) — antes o título/corpo da notificação
--  era montado só pra mandar o push e descartado; agora fica salvo, pra a aba aberta
--  também poder mostrar um aviso na tela + falar em voz alta, sem esperar o push do SO
--  (que exige permissão do navegador e só funciona por fora da aba).
-- ============================================================

-- 10) Guarda o texto de cada evento — /api/notifications/recent lê daqui
alter table public.notified_events add column if not exists title text;
alter table public.notified_events add column if not exists body  text;
alter table public.notified_events add column if not exists url   text;
create index if not exists notified_events_created_idx on public.notified_events (created_at);

-- ============================================================
--  Comandos remotos (a mais, aditivo) — "abre o dashboard" falado num dispositivo (ex.:
--  celular) navega os OUTROS dispositivos com o app aberto (desktop, TV em Modo TV...) pra
--  aquela tela, sem tocar no que deu o comando. Mesmo padrão de fila curta que as
--  notificações: cada dispositivo tem um id salvo no navegador e faz polling rápido
--  (ver src/lib/deviceId.js e src/components/shell/RemoteCommandListener.js).
-- ============================================================

-- 11) Fila de comandos — linhas antigas não importam, só as mais novas que o último
--     "since" de cada dispositivo (não precisa marcar como "lido")
create table if not exists public.remote_commands (
  id            bigint generated always as identity primary key,
  action        text not null,          -- só 'navigate' por enquanto
  target        text not null,          -- rota, ex.: '/dashboard'
  origin_device text not null,          -- id do dispositivo que mandou (ele mesmo ignora)
  created_at    timestamptz not null default now()
);

create index if not exists remote_commands_created_idx on public.remote_commands (created_at);
alter table public.remote_commands enable row level security;
-- (só acessada pela service_role, em /api/remote-command — mesmo padrão das tabelas acima)

-- ============================================================
--  Fix: criar nota nova pela aplicação (a mais, aditivo) — a tabela `notes` (criada fora
--  deste arquivo, antes deste app existir) tem `user_id` como NOT NULL, provavelmente
--  pensada pra um esquema com login (auth.users). Este app não tem login — é de uso
--  pessoal — e só preenche `user_id` se a env var BRAIN_USER_ID estiver configurada (ver
--  src/lib/notes.js); sem ela, o insert falhava com "null value in column user_id".
--  Relaxar o NOT NULL resolve sem precisar descobrir/inventar um UUID de usuário.
-- ============================================================

-- 12) Permite user_id nulo em notes — só afeta linhas novas sem BRAIN_USER_ID configurada;
--     linhas existentes (com ou sem user_id) continuam exatamente como estão.
alter table public.notes alter column user_id drop not null;

-- ============================================================
--  Saúde das chaves do Gemini (a mais, aditivo) — rodízio "burro" (só por posição na
--  lista) não sabia que CADA MODELO tem cota própria (uma chave pode estar ótima pro
--  chat e zerada pra voz, ao mesmo tempo) nem persistia nada entre invocações da função
--  na Vercel (variável em memória se perde a qualquer momento, sem aviso). Esta tabela é
--  a fonte de verdade duravel de "essa chave×modelo tá de cooldown até quando" — ver
--  src/lib/geminiKeyHealth.js.
-- ============================================================

-- 13) Uma linha por (índice da chave, nome do modelo) — só existe linha pra combinação
--     que já falhou alguma vez; ausência de linha = "nunca falhou, pode usar".
create table if not exists public.gemini_key_health (
  key_index      int  not null,   -- posição da chave em GEMINI_API_KEYS (0-based) — nunca a chave em si
  model          text not null,   -- ex.: 'gemini-3.6-flash', 'gemini-2.5-flash-preview-tts'
  cooldown_until timestamptz,     -- null/passado = disponível de novo
  reason         text,            -- 'rpd' (diário) | 'rpm' (por minuto) | 'other'
  last_error     text,
  updated_at     timestamptz not null default now(),
  primary key (key_index, model)
);

alter table public.gemini_key_health enable row level security;
-- (só acessada pela service_role, em src/lib/geminiKeyHealth.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Uso diário das chaves do Gemini (a mais, aditivo) — pro painel /gemini-keys mostrar
--  gráficos de consumo (pizza por modelo, barra por chave, curva por dia), não só o status
--  de cooldown. Uma LINHA POR DIA×CHAVE×MODELO (agregada, não uma linha por chamada — evita
--  a tabela crescer sem limite) incrementada via função (increment_gemini_usage), chamada de
--  markOk/markCooldown em src/lib/geminiKeyHealth.js — ou seja, em TODA tentativa de chamada
--  ao Gemini, sucesso ou falha.
-- ============================================================

-- 14) Contadores do dia (fuso UTC) — sucesso e falha separados, pra dar pra ver não só
--     "quanto foi usado" mas "quanto disso falhou" por chave/modelo.
create table if not exists public.gemini_key_usage_daily (
  day            date not null,
  key_index      int  not null,
  model          text not null,
  success_count  int  not null default 0,
  fail_count     int  not null default 0,
  primary key (day, key_index, model)
);

alter table public.gemini_key_usage_daily enable row level security;
-- (só acessada pela service_role, em src/lib/geminiKeyHealth.js — mesmo padrão das tabelas acima)

-- Incremento atômico — evita a corrida de "ler o valor, somar 1, escrever de volta" quando
-- duas invocações da função na Vercel tentam contar uma chamada no mesmíssimo instante.
create or replace function public.increment_gemini_usage(
  p_day date, p_key_index int, p_model text, p_success boolean
) returns void
language plpgsql
as $$
begin
  insert into public.gemini_key_usage_daily (day, key_index, model, success_count, fail_count)
  values (p_day, p_key_index, p_model, case when p_success then 1 else 0 end, case when p_success then 0 else 1 end)
  on conflict (day, key_index, model) do update
    set success_count = public.gemini_key_usage_daily.success_count + excluded.success_count,
        fail_count    = public.gemini_key_usage_daily.fail_count    + excluded.fail_count;
end;
$$;

-- ============================================================
--  Tarefas da Delp (a mais, aditivo) — Kanban de tarefas da empresa onde o usuário trabalha
--  (tela /delp-tasks), alimentado por upload manual de uma planilha exportada do PMO (ver
--  contexto/Delp.xlsx — NUNCA comitado no git, é dado confidencial da empresa; a fonte "de
--  verdade" fica aqui no Supabase, não no arquivo). Ver src/lib/delpTasks.js.
--  Cada upload SUBSTITUI tudo (não acumula histórico de uploads antigos).
-- ============================================================

-- 15) Uma linha por tarefa — id vem da própria planilha do PMO, não gerado aqui.
create table if not exists public.delp_tasks (
  id             int  primary key,
  titulo         text not null,
  legenda        text,
  prioridade     text,
  pontos         numeric,
  data_inicio    date,
  data_limite    date,
  etapa          text,
  relacionado_a  text,
  atribuido_a    text,
  colaboradores  text,
  status         text not null,
  sprint         text,
  updated_at     timestamptz not null default now()
);

alter table public.delp_tasks enable row level security;
-- (só acessada pela service_role, em src/lib/delpTasks.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Falas agendadas (a mais, aditivo) — programar um horário do dia em que a Lisa fala/reporta
--  algo sozinha, pra TODOS os dispositivos com o app aberto (reaproveita a MESMA fila de
--  notified_events que já existe — ver src/lib/notifications.js — então o banner + voz nos
--  dispositivos abertos e o push do sistema operacional já funcionam de graça, sem precisar
--  de nenhum mecanismo de entrega novo). Verificado pelo MESMO cron de 1 min que já checa
--  Sentinela/Trello (ver /api/cron/notify) — ver src/lib/scheduledAnnouncements.js.
-- ============================================================

-- 16) Uma linha por agendamento. `mode`:
--     'fixed'  → fala `message` literalmente, sem chamar o Gemini.
--     'report' → pede um relatório de verdade: roda `instruction` contra `scope` (mesmo
--                formato do seletor de escopo do Assistente) e fala o que o Gemini responder.
create table if not exists public.scheduled_announcements (
  id            bigint generated always as identity primary key,
  label         text not null,
  time_of_day   time not null,                            -- horário local (America/Sao_Paulo)
  days_of_week  int[] not null default '{0,1,2,3,4,5,6}',  -- 0=domingo..6=sábado
  mode          text not null default 'fixed',             -- 'fixed' | 'report'
  message       text,                                      -- usado quando mode='fixed'
  scope         jsonb,                                     -- usado quando mode='report'
  instruction   text,                                      -- usado quando mode='report'
  persona_mode  boolean not null default false,
  enabled       boolean not null default true,
  last_fired_on date,                                       -- evita disparar 2x no mesmo dia
  created_at    timestamptz not null default now()
);

alter table public.scheduled_announcements enable row level security;
-- (só acessada pela service_role, em src/lib/scheduledAnnouncements.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Indexação de código do GitHub (a mais, aditivo) — repositórios lidos por um fine-grained
--  PAT (GITHUB_TOKEN, só leitura), indexados pelo MESMO pipeline de embeddings do Trello/
--  Beyond Brain (tabela `documents` já existente, source='github' — ver
--  src/lib/ingest/github.js e src/lib/ingest/runSlice.js). Essa tabela aqui só guarda QUAIS
--  repositórios sincronizar (descobertos via /code-repos), não o código em si.
-- ============================================================

-- 17) Um repositório por linha — `enabled` decide se entra no ciclo de sincronização.
create table if not exists public.github_repos (
  id              bigint generated always as identity primary key,
  full_name       text not null unique,   -- "owner/repo"
  default_branch  text,
  private         boolean not null default false,
  enabled         boolean not null default true,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.github_repos enable row level security;
-- (só acessada pela service_role, em src/lib/ingest/github.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Escopo "Código" com repositório/arquivo específico (a mais, aditivo) — o seletor de
--  escopo do Assistente ganhou dois campos extras pra "Código": qual repositório e,
--  dentro dele, qual arquivo. Pra filtrar por repositório na busca semântica sem trazer
--  ruído de outros repos, match_documents precisa de mais um parâmetro (filter_board).
-- ============================================================

-- 18) Precisa DROPAR a versão antiga antes: adicionar um parâmetro novo cria uma segunda
--     função com o mesmo nome (overload) em vez de substituir — dá ambiguidade na chamada.
drop function if exists public.match_documents(vector(768), int, float, text);

create or replace function public.match_documents(
  query_embedding vector(768),
  match_count     int   default 5,
  min_similarity  float default 0.0,
  filter_source   text  default null,
  filter_board    text  default null
)
returns table (
  id            bigint,
  source        text,
  external_id   text,
  board         text,
  title         text,
  content       text,
  last_modified timestamptz,
  metadata      jsonb,
  similarity    float
)
language sql stable
as $$
  select
    d.id, d.source, d.external_id, d.board, d.title, d.content,
    d.last_modified, d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
    and (filter_source is null or d.source = filter_source)
    and (filter_board is null or d.board = filter_board)
    and 1 - (d.embedding <=> query_embedding) >= min_similarity
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
--  Tarefas de código (a mais, aditivo) — a Lisa PROPÕE mudança de código: cria uma branch
--  nova a partir da base escolhida, aplica os arquivos, e abre um Pull Request — nunca
--  mescla sozinha (ver src/lib/codeTasks.js). Exige que o GITHUB_TOKEN tenha permissão de
--  escrita (Contents + Pull requests: Read and write), diferente do resto da indexação
--  (que só precisa de leitura).
-- ============================================================

-- 19) Histórico de tarefas — pra tela /code-tasks mostrar o que já foi pedido e o link do PR.
create table if not exists public.code_tasks (
  id           bigint generated always as identity primary key,
  repo         text not null,
  base_branch  text not null,
  instruction  text not null,
  status       text not null default 'running',   -- 'running' | 'done' | 'error'
  branch_name  text,
  pr_url       text,
  summary      text,
  error        text,
  created_at   timestamptz not null default now()
);

alter table public.code_tasks enable row level security;
-- (só acessada pela service_role, em src/lib/codeTasks.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Painel visual de progresso do SYNC (a mais, aditivo) — /sync-status precisa saber quantos
--  pedaços já estão indexados por fonte/board (ex.: quantos chunks cada repositório do
--  GitHub já tem) sem trazer a tabela `documents` inteira pro servidor só pra contar.
-- ============================================================

-- 20) Contagem agregada por fonte+board — usada pelo painel, não pela busca em si.
create or replace function public.document_counts()
returns table (source text, board text, cnt bigint)
language sql stable
as $$
  select source, board, count(*) as cnt
  from public.documents
  group by source, board;
$$;

-- ============================================================
--  Cache de conteúdo do GitHub (a mais, aditivo) — repositórios grandes precisam de VÁRIOS
--  ticks do SYNC pra terminar (limite de chunks por chamada); sem isso, loadGithub rebuscava
--  a árvore + conteúdo de TODOS os arquivos em TODO tick, mesmo só continuando o mesmo
--  repositório — com o tick a cada 15s (ver db/cron.sql), isso estourou o limite de taxa da
--  API do GitHub (5000/hora, um token só, sem rodízio como o do Gemini). Ver
--  src/lib/ingest/github.js.
-- ============================================================

-- 21) Um snapshot por repositório (arquivos+conteúdo já buscados), com validade curta —
--     tempo de sobra pra um repositório terminar todos os ticks dele, mas curto o bastante
--     pra pegar mudança de código relativamente rápido no próximo ciclo.
create table if not exists public.github_fetch_cache (
  repo        text primary key,
  files       jsonb not null,   -- [{ path, sha, content }]
  fetched_at  timestamptz not null default now()
);

alter table public.github_fetch_cache enable row level security;
-- (só acessada pela service_role, em src/lib/ingest/github.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Tarefa de código RETOMÁVEL em vários pedidos (a mais, aditivo) — o plano Hobby da Vercel
--  tem teto FIXO de 60s por função, sem como aumentar. Uma tarefa de código (buscar contexto
--  + decidir arquivos + escrever cada um + criar branch + commitar + abrir PR) podia passar
--  disso fácil numa chamada só. Em vez de uma conexão única, agora cada "passo" é um pedido
--  HTTP separado (o cliente chama de novo sozinho até terminar — mesmo padrão já usado pro
--  SYNC dos repositórios, ver sync_progress) — cada passo tem seu PRÓPRIO teto de 60s, então
--  a tarefa inteira não fica mais presa a uma única janela de 60s. Ver
--  src/lib/codeTasks.js:runCodeTaskStep.
-- ============================================================

-- 22) Guarda o progresso entre um passo e o próximo (contexto já buscado, plano já decidido,
--     arquivos já escritos, branch já criada) — sem isso, cada pedido teria que refazer tudo
--     de novo do zero.
alter table public.code_tasks add column if not exists state jsonb not null default '{}'::jsonb;

-- ============================================================
--  Mapa de arquitetura (a mais, aditivo) — a Lisa gera um HTML autônomo (com diagrama) documen-
--  tando a arquitetura de um repositório escolhido: áreas lógicas (agrupadas por pasta), o que
--  cada uma faz (IA), e como se relacionam (grafo de dependência REAL, calculado a partir dos
--  imports indexados — não "achismo" da IA). Mesmo padrão retomável em passos de code_tasks
--  (cada passo é um pedido HTTP próprio, com seu próprio teto de 60s) — ver
--  src/lib/archDocs.js:runArchDocStep.
-- ============================================================

-- 23) Histórico + progresso das gerações — o HTML final fica em `html`, só quando status='done'.
create table if not exists public.arch_docs (
  id          bigint generated always as identity primary key,
  repo        text not null,
  status      text not null default 'running',   -- 'running' | 'done' | 'error'
  state       jsonb not null default '{}'::jsonb, -- progresso entre passos (áreas, grafo, resumos)
  html        text,                               -- documento final autônomo (só quando status='done')
  error       text,
  created_at  timestamptz not null default now()
);

alter table public.arch_docs enable row level security;
-- (só acessada pela service_role, em src/lib/archDocs.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Modo Vigia (a mais, aditivo) — memória das observações do Modo Tela. Toda vez que a
--  vigília do Modo Tela ("Vigiar sozinha") realmente comenta algo (não em todo ciclo — a
--  maioria fica muda, "nada digno de nota" não gera linha aqui), o comentário é salvo aqui
--  automaticamente. O modo "Vigia" (toggle novo, igual o Modo Código) lê os registros mais
--  recentes pra responder perguntas tipo "o que você notou na minha tela?" — e funciona de
--  QUALQUER dispositivo (inclusive celular), já que é só ler uma tabela na nuvem, não depende
--  de a TELA estar sendo compartilhada NAQUELE aparelho. Ver src/lib/screenWatch.js e
--  /api/screen-watch/*.
-- ============================================================

-- 24) Uma linha por observação real da vigília do Modo Tela (não por ciclo — só quando há
--     comentário de verdade).
create table if not exists public.screen_observations (
  id          bigint generated always as identity primary key,
  comment     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists screen_observations_created_at_idx on public.screen_observations (created_at desc);

alter table public.screen_observations enable row level security;
-- (só acessada pela service_role, em src/lib/screenWatch.js — mesmo padrão das tabelas acima)

-- ============================================================
--  Transmissão (a mais, aditivo) — ver a tela de UM dispositivo AO VIVO (vídeo de verdade, não
--  só texto) a partir de OUTRO, via WebRTC (peer-to-peer — o vídeo em si nunca passa pelo
--  servidor, só a "apresentação" inicial entre os dois aparelhos). Mesmo padrão de fila curta +
--  polling já usado pelos comandos remotos (ver remote_commands acima e
--  src/lib/remoteCommands.js), só que endereçado (cada sinal tem um destinatário específico,
--  não é "todo mundo escuta"). Ver src/lib/screenShareSignals.js (servidor) e
--  src/lib/screenShareRTC.js (WebRTC no navegador).
-- ============================================================

-- 25) Sinalização WebRTC (SDP offer/answer + candidatos ICE) — linhas antigas não importam,
--     só as mais novas endereçadas a mim que eu ainda não vi.
create table if not exists public.screen_share_signals (
  id          bigint generated always as identity primary key,
  from_device text not null,
  to_device   text not null,  -- id real do dispositivo, ou o pseudo-endereço 'HOST' (qualquer
                               -- dispositivo transmitindo agora escuta esse também, além do seu id)
  kind        text not null,  -- 'watch-request' | 'offer' | 'answer' | 'ice' | 'stop'
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists screen_share_signals_to_device_idx on public.screen_share_signals (to_device, created_at);

alter table public.screen_share_signals enable row level security;
-- (só acessada pela service_role, em src/lib/screenShareSignals.js — mesmo padrão das tabelas acima)
