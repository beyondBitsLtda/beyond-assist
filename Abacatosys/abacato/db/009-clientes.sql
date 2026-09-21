-- Contas de CLIENTE: gente de fora, com limite de uso e sem acesso a nada que já existe.
--
-- ==========================================================================================
-- DUAS DECISÕES DE MODELAGEM QUE VALEM A EXPLICAÇÃO
--
-- 1. O TIPO MORA NA PESSOA, E OS LIMITES MORAM NO CÓDIGO.
--    Poderia haver uma coluna por limite (max_quadros, max_projetos, bytes…). Não há, porque
--    limite é regra de produto: mudar "10 quadros" para "15" viraria uma migração e um
--    UPDATE em todas as linhas, e as contas criadas antes ficariam com o número velho para
--    sempre. Com o número no código (src/dominio/planos.js), mudar é uma linha e vale para
--    todo mundo na mesma hora.
--
-- 2. QUEM ESPERA APROVAÇÃO FICA NA MESMA TABELA, COM `aprovado = false`.
--    Uma tabela separada de "pedidos de cadastro" pareceria mais limpa e traria um problema
--    real: o e-mail precisa ser único entre pedidos E contas, senão duas pessoas pedem o
--    mesmo e-mail, as duas são aprovadas, e a segunda quebra na hora de virar conta. Aqui a
--    unicidade é a mesma de sempre.
-- ==========================================================================================

alter table public.abacato_usuarios
  -- 'interno' é quem é da casa; 'cliente' é quem vem de fora, com limites.
  add column if not exists tipo text not null default 'interno',
  -- Cadastro feito pela própria pessoa nasce FALSE e não entra até alguém de dentro deixar.
  add column if not exists aprovado boolean not null default true,
  -- De qual convite ela veio, quando veio de um. Serve ao painel de uso e a saber quem abriu
  -- a porta para quem.
  add column if not exists convite_id uuid;

-- As contas que já existem são todas internas e aprovadas — o default cuida disso, mas
-- deixar explícito evita depender de o default ter sido aplicado a todas.
update public.abacato_usuarios set tipo = 'interno', aprovado = true where tipo is null;

-- Cliente nunca fala com a assistente. A trava também está no código; aqui ela é estrutural,
-- e é a que sobrevive a alguém esquecer de conferir numa rota nova.
alter table public.abacato_usuarios
  drop constraint if exists abacato_usuarios_cliente_sem_lisa;
alter table public.abacato_usuarios
  add constraint abacato_usuarios_cliente_sem_lisa
  check (tipo <> 'cliente' or lisa = false);

alter table public.abacato_usuarios
  drop constraint if exists abacato_usuarios_tipo_conhecido;
alter table public.abacato_usuarios
  add constraint abacato_usuarios_tipo_conhecido
  check (tipo in ('interno', 'cliente'));

-- ============================================================ o link de cadastro
--
-- Um endereço que alguém de fora abre para criar a própria conta. O token é longo e sorteado:
-- ele é a única coisa entre a internet e um formulário de cadastro.
--
-- O link NÃO cria acesso a nada. Ele cria uma conta que ainda precisa ser aprovada — é o
-- equivalente a deixar alguém tocar a campainha, e não a dar a chave.
create table if not exists public.abacato_convites (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  rotulo      text,                    -- "clientes da obra X", para saber de onde veio
  tipo        text not null default 'cliente',
  criado_por  uuid references public.abacato_usuarios (id) on delete set null,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz,
  -- Um convite gasto é um convite que não serve mais. Sem teto, um link vazado vira cadastro
  -- infinito — e cada cadastro é uma notificação para quem administra.
  max_usos    integer not null default 20,
  usos        integer not null default 0,
  ativo       boolean not null default true
);

create index if not exists abacato_convites_token_idx on public.abacato_convites (token);

-- ============================================================ o registro de uso
--
-- O que aconteceu, quem fez e quando. É o que alimenta o painel de administração.
--
-- Guarda EVENTO, e não estado: "criou o quadro X" em vez de "tem 3 quadros". Estado a gente
-- conta no banco quando precisa; evento, se não for gravado na hora, não volta nunca.
create table if not exists public.abacato_eventos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references public.abacato_usuarios (id) on delete set null,
  -- entrou | criou_conta | aprovou_conta | criou_quadro | criou_projeto | enviou_documento |
  -- compartilhou | bateu_limite | ...
  tipo        text not null,
  alvo        text,                    -- nome legível do que foi tocado
  alvo_id     uuid,
  detalhe     jsonb,                   -- números, bytes, o limite que barrou
  criado_em   timestamptz not null default now()
);

-- O painel lê por data (os últimos) e por pessoa (o uso de fulano). Dois índices, porque são
-- duas perguntas diferentes e a tabela cresce todo dia.
create index if not exists abacato_eventos_data_idx on public.abacato_eventos (criado_em desc);
create index if not exists abacato_eventos_usuario_idx on public.abacato_eventos (usuario_id, criado_em desc);

-- ============================================================ RLS
--
-- Como em todo o resto do sistema: ligada, sem política nenhuma. Ninguém alcança estas tabelas
-- com a chave pública — só o servidor, com a chave de serviço, e ele só responde depois de
-- conferir a sessão.
do $$
declare t text;
begin
  foreach t in array array['abacato_convites', 'abacato_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

comment on column public.abacato_usuarios.tipo is
  'interno (da casa, sem limites) ou cliente (de fora, com os limites de src/dominio/planos.js)';
comment on column public.abacato_usuarios.aprovado is
  'Cadastro feito pela própria pessoa nasce false e não entra até alguém de dentro aprovar.';
