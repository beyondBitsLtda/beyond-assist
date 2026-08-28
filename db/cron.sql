-- ============================================================
--  Cron jobs automáticos — Supabase aciona a Vercel
--
--  Dois ciclos agendados aqui, ambos rodando no Postgres do Supabase (pg_cron + pg_net,
--  extensões nativas, sem custo extra) — NENHUM dos dois usa o cron nativo da Vercel,
--  de propósito: o plano Hobby da Vercel só permite cron 1x/dia (mais frequente que isso
--  FALHA O DEPLOY — foi o que quebrou o deploy dias atrás). Fazendo o agendamento aqui no
--  Supabase em vez de vercel.json, a frequência real (1x/hora, 1x/5min) não é limitada
--  pelo plano da Vercel — só a EXECUÇÃO roda lá (como função normal, sem ser um "cron job"
--  aos olhos da Vercel).
--
--    1) beyond-sync-start / beyond-sync-tick → SYNC automático (Trello+Gemini): reinicia
--       1x/hora, avança uma fatia a cada 2 min (mais devagar de propósito — ver nota abaixo)
--    2) beyond-notify-tick                   → notificações push (chamado novo, SLA,
--                                               tarefa atrasada), a cada 5 min — substitui
--                                               o cron que estava em vercel.json
--
--  Domínio já preenchido: beyond-assist-blue.vercel.app (testado — HTTP 200, sem proteção de
--  login da Vercel). Se um dia trocar de domínio, é só substituir as 3 ocorrências dele abaixo.
--
--  Pré-requisitos (rode primeiro, nesta ordem):
--    1) db/schema.sql inteiro (cria public.sync_progress) — RODE ISSO ANTES, se ainda não rodou
--    2) INGEST_SECRET e CRON_SECRET já configuradas no .env E na Vercel — já preenchidas
--       abaixo com os valores atuais do seu .env; se você trocar essas variáveis depois,
--       lembre de rodar este arquivo de novo com os novos valores
--
--  Rode isto no SQL Editor do projeto Supabase do Beyond Brain.
--
--  (Prefere não deixar os secrets em texto puro aqui? Dá pra guardar em Supabase Vault —
--  Project Settings → Vault — e trocar cada '<...>' abaixo por
--  (select decrypted_secret from vault.decrypted_secrets where name = '...').)
-- ============================================================

-- 1) Extensões necessárias (nativas do Supabase, sem custo extra)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------- SYNC automático (Trello + Beyond Brain → embeddings), 1x/hora ----------

-- 2) A cada hora, no minuto 0: reseta o progresso e começa um novo ciclo
select cron.schedule(
  'beyond-sync-start',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'https://beyond-assist-blue.vercel.app/api/cron/sync?reset=1',
    headers := jsonb_build_object('x-ingest-secret', 'xcnN8BVNdJmatVX6H1JhlUsWTLflE2pQ'),
    timeout_milliseconds := 55000
  );
  $$
);

-- 3) A cada 2 minutos: avança uma fatia do ciclo (não faz nada se nenhum ciclo estiver em
--    andamento — chamada barata, só 2 leituras na sync_progress). 2 em 2 minutos, não 1 em 1,
--    de propósito: cada fatia chama o Gemini pra gerar embeddings, e isso disputa cota com
--    o chat/voz do Assistente — de 1 em 1 minuto, o ciclo de SYNC sozinho já estourava a
--    cota gratuita boa parte do tempo. O ciclo completo demora mais pra terminar, mas
--    sobra bem mais cota pra você usar o Assistente sem esbarrar em "cota cheia".
select cron.schedule(
  'beyond-sync-tick',
  '*/2 * * * *',
  $$
  select net.http_get(
    url := 'https://beyond-assist-blue.vercel.app/api/cron/sync',
    headers := jsonb_build_object('x-ingest-secret', 'xcnN8BVNdJmatVX6H1JhlUsWTLflE2pQ'),
    timeout_milliseconds := 55000
  );
  $$
);

-- ---------- Notificações push (chamado novo/reaberto, SLA, tarefa atrasada), 1x/5min ----------
-- Substitui o cron que estava em vercel.json (removido de lá — violava o limite do Hobby).

select cron.schedule(
  'beyond-notify-tick',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://beyond-assist-blue.vercel.app/api/cron/notify',
    headers := jsonb_build_object('authorization', 'Bearer 498e55e6cfb7cb8f020b891eb090fc8ddad945c613b1c157'),
    timeout_milliseconds := 55000
  );
  $$
);

-- ---- conferir / gerenciar depois de criado ----

-- ver os jobs agendados e quando rodam:
-- select jobid, jobname, schedule, active from cron.job;

-- ver o histórico recente de execuções (sucesso/erro):
-- select jobid, status, return_message, start_time
-- from cron.job_run_details order by start_time desc limit 20;

-- ver o progresso do ciclo de SYNC atual:
-- select * from public.sync_progress;

-- pausar um job sem apagar:
-- select cron.alter_job((select jobid from cron.job where jobname = 'beyond-sync-tick'), active := false);

-- remover de vez, se precisar:
-- select cron.unschedule('beyond-sync-start');
-- select cron.unschedule('beyond-sync-tick');
-- select cron.unschedule('beyond-notify-tick');
