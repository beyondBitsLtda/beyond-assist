-- Lisa_Proof — a trilha amarrada à prática (pedido de 23/10/2026: "as tarefas semanais têm que ser
-- critério para passar de trilha; hoje as trilhas e a prática estão muito desvinculadas; e um plano de
-- 5 dias tem que ser adaptado"). As regras moram em src/dominio/avanco.js:
--   - o assunto só conclui com a teoria E um quiz dele aprovado;
--   - a semana seguinte do plano só abre com o projeto da semana aprovado;
--   - a última semana termina no PROJETO FINAL (o projeto do mês deixou de existir).
--
-- 1) O que já estava concluído continua concluído: os assuntos concluídos ATÉ AGORA ficam dispensados
--    do quiz. A foto é tirada uma vez só (quando a coluna nasce) — rodar de novo não dispensa os
--    assuntos concluídos depois.
-- 2) O tipo novo "projeto_final" nos desafios e no livro de pontos.
--
-- Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/017-trilha-amarrada.sql
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proof_etapas' and column_name = 'dispensa_quiz'
  ) then
    alter table public.proof_etapas add column dispensa_quiz boolean not null default false;
    update public.proof_etapas e set dispensa_quiz = true
      from public.abacato_cards c
      where c.id = e.card_id and c.concluido;
  end if;
end $$;

alter table public.proof_desafios drop constraint if exists proof_desafios_tipo_check;
alter table public.proof_desafios add constraint proof_desafios_tipo_check
  check (tipo in ('quiz', 'exercicio', 'projeto_semanal', 'projeto_final', 'projeto_mensal'));

alter table public.proof_eventos drop constraint if exists proof_eventos_tipo_check;
alter table public.proof_eventos add constraint proof_eventos_tipo_check check (tipo in (
  'item', 'card', 'meta_diaria',
  'quiz', 'exercicio', 'projeto_semanal', 'projeto_final', 'projeto_mensal',
  'conquista'
));

notify pgrst, 'reload schema';
