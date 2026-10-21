-- Lisa_Proof — personagens (visuais do Neuro) comprados com moedas.
--
-- Pode rodar duas vezes sem estragar nada. Só ACRESCENTA: duas colunas com padrão no reino e um
-- tipo novo no livro-caixa. Nenhum dado existente muda (todo mundo continua com o Neuro Clássico).
-- Aplicar:  npm run migrar -- db/008-personagens.sql
--
-- Moram no reino (e não no perfil) para a compra usar a mesma trava de versão das outras
-- compras do reino: dois cliques ao mesmo tempo não cobram duas vezes.
alter table public.proof_reinos add column if not exists personagem  text  not null default 'neuro';
alter table public.proof_reinos add column if not exists personagens jsonb not null default '["neuro"]'::jsonb;

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem'));
