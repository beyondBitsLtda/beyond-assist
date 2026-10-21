-- Lisa_Proof — combate no estilo Clash: exército, tropas de defesa, Canhão e replay das batalhas.
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA: colunas novas com padrão e um tipo novo
-- no livro-caixa. Nenhum dado existente muda (as batalhas antigas só não têm replay).
-- Aplicar:  npm run migrar -- db/007-combate.sql

-- As duas reservas de tropas ({"guerreiro": 10, "arqueira": 5, ...}); as regras moram em
-- src/dominio/tropas.js. O exército é gasto em cada invasão; a guarnição defende a Torre.
alter table public.proof_reinos add column if not exists exercito  jsonb not null default '{}'::jsonb;
alter table public.proof_reinos add column if not exists guarnicao jsonb not null default '{}'::jsonb;
-- reino novo já nasce sabendo do Canhão (os antigos ganham o nível 0 pelo código)
alter table public.proof_reinos alter column construcoes
  set default '{"castelo":1,"mina":1,"cofre":0,"muralha":0,"torre":0,"canhao":0,"quartel":0}'::jsonb;

-- Treinar tropas gasta moedas.
alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino'));

-- O resultado e a "receita" de cada batalha: com a semente e as duas forças, a tela roda a mesma
-- simulação de novo e mostra a luta (src/dominio/combate.js é determinístico).
alter table public.proof_invasoes add column if not exists estrelas   smallint;
alter table public.proof_invasoes add column if not exists destruicao smallint;
alter table public.proof_invasoes add column if not exists combate    jsonb;
