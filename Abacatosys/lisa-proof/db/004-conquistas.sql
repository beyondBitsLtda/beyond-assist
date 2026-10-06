-- Lisa_Proof — conquistas.
--
-- Conquista é um evento como os outros (`proof_eventos`, tipo 'conquista', chave
-- 'conquista:<codigo>'): a chave única já garante que cada uma é desbloqueada e pontuada uma vez
-- só. Esta migração só acrescenta o tipo novo à lista permitida.
--
-- Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/004-conquistas.sql

alter table public.proof_eventos drop constraint if exists proof_eventos_tipo_check;
alter table public.proof_eventos add constraint proof_eventos_tipo_check check (tipo in (
  'item', 'card', 'meta_diaria',
  'quiz', 'exercicio', 'projeto_semanal', 'projeto_mensal',
  'conquista'
));
