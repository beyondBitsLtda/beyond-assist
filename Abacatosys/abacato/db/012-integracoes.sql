-- Integrações: um sistema de fora (hoje, o Beyond-Lead) lendo UM quadro e criando card nele.
--
-- Não é uma conta. Uma conta é uma pessoa: senha, sessão de uma semana, convite quadro a
-- quadro. Uma integração é uma chave que abre um quadro só, e a coluna de entrada diz o único
-- lugar onde ela pode criar card. Sem coluna de entrada, ela só lê.
--
-- O token NÃO fica aqui — só o SHA-256 dele (ver src/dominio/integracao.js). Quem cria é o
-- `scripts/criar-integracao.mjs`, que grava o token num arquivo da sua máquina e imprime o SQL.
--
-- Revogar é desligar, não apagar: o registro de quando ela foi usada pela última vez é o que
-- responde "isso ainda está em uso?" antes de alguém decidir.
--
--   update public.abacato_integracoes set ativo = false where nome = 'Beyond-Lead';
--
-- Pode rodar duas vezes.

create table if not exists public.abacato_integracoes (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  quadro_id          uuid not null references public.abacato_quadros (id) on delete cascade,
  -- Onde nascem os cards que ela cria. Nulo = só leitura. `set null` porque arquivar ou apagar
  -- a coluna deve tirar o poder de criar, e não apagar a integração junto.
  coluna_entrada_id  uuid references public.abacato_colunas (id) on delete set null,
  token_hash         text not null unique,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  usado_em           timestamptz
);

create index if not exists abacato_integracoes_quadro_idx
  on public.abacato_integracoes (quadro_id) where ativo;

-- Mesma rede de segurança das outras tabelas: RLS ligado e nenhuma política. Só a chave de
-- serviço (o servidor do Abacato) alcança a tabela.
alter table public.abacato_integracoes enable row level security;
