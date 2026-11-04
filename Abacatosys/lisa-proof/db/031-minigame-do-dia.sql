-- 031 — O minigame do dia (03/11/2026). Pode rodar duas vezes sem estragar nada.
--
-- A Arena Lúdica virou o minigame da prática diária ("igual o quiz"): a primeira fase vencida no dia vale pontos,
-- uma vez por dia, com a chave arena:<dia> (src/lib/arena.js). Entra o tipo 'arena' nos eventos de estudo.

alter table public.proof_eventos drop constraint if exists proof_eventos_tipo_check;
alter table public.proof_eventos add constraint proof_eventos_tipo_check check (tipo in (
  'item', 'card', 'meta_diaria',
  'quiz', 'exercicio', 'projeto_semanal', 'projeto_final', 'projeto_mensal',
  'conquista', 'dominio', 'cartoes', 'revisao', 'diario', 'arena'
));

notify pgrst, 'reload schema';
