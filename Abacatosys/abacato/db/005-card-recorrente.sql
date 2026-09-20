-- Abacato System — um card que se repete.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/005-card-recorrente.sql
-- É idempotente.
--
-- Já existia `abacato_recorrencias`: uma REGRA separada, que cria cards numa coluna quando o
-- quadro é aberto. Serve para o que nasce do calendário — "conferir os backups toda segunda" —
-- e não para o que a maioria das pessoas quer dizer com tarefa recorrente.
--
-- O que se espera, e que faltava: pegar um card que já existe, dizer que ele se repete, e ao
-- CONCLUIR o trabalho ver o próximo aparecer com a data recalculada. A regra vive no próprio
-- card, e não numa lista à parte que ninguém lembra de abrir.
--
-- O card concluído NÃO vira o próximo: ele fica concluído, e um card NOVO nasce. Reaproveitar o
-- mesmo card seria mais simples e apagaria o histórico — "quantas vezes isso foi feito em
-- agosto" deixaria de ter resposta, porque só existiria um card e ele só sabe a última vez.
alter table public.abacato_cards add column if not exists recorrencia_regra text;

-- Quem pergunta por isto sempre pergunta junto com "e esta concluido?".
create index if not exists abacato_cards_recorrencia_idx
  on public.abacato_cards (recorrencia_regra)
  where recorrencia_regra is not null and not arquivado;
