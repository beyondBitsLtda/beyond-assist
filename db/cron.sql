-- ============================================================
--  SYNC automático de hora em hora — Supabase aciona a Vercel
--
--  Pré-requisitos (rode primeiro, nesta ordem):
--    1) db/schema.sql inteiro (já inclui a tabela public.sync_progress)
--    2) A env var INGEST_SECRET já configurada no .env E na Vercel
--       (Settings → Environment Variables) — é o mesmo segredo que o botão
--       SYNC manual usa. Se você ainda não tem um, defina um valor qualquer
--       (uma string aleatória longa) nos dois lugares antes de continuar.
--
--  Rode isto UMA vez no SQL Editor do projeto Supabase do Beyond Brain.
--
--  ⚠️ ATENÇÃO ao domínio já preenchido abaixo (beyond-assist-dtusix9tv-...vercel.app):
--  esse formato com hash aleatório (dtusix9tv) é a URL de UM deploy específico — a
--  Vercel gera uma nova hash dessas a cada novo deploy, então essa URL pode parar de
--  responder no próximo `git push`. Antes de rodar isto, confirme em Vercel → projeto →
--  Settings → Domains qual é o domínio ESTÁVEL (geralmente `<projeto>.vercel.app` ou
--  `<projeto>-<time>.vercel.app`, SEM hash no meio) e troque abaixo se for diferente —
--  senão o SYNC automático pode ficar "funcionando" hoje e silenciosamente parar depois
--  do próximo deploy.
--
--  (Prefere não deixar o secret em texto puro aqui? Dá pra guardar em Supabase
--  Vault — Project Settings → Vault — e trocar 'xcnN8BVNdJmatVX6H1JhlUsWTLflE2pQ'
--  abaixo por (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret').)
-- ============================================================

-- 1) Extensões necessárias (nativas do Supabase, sem custo extra)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2) A cada hora, no minuto 0: reseta o progresso e começa um novo ciclo
select cron.schedule(
  'beyond-sync-start',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'https://beyond-assist-dtusix9tv-beyondbitsltda-7591s-projects.vercel.app/api/cron/sync?reset=1',
    headers := jsonb_build_object('x-ingest-secret', 'xcnN8BVNdJmatVX6H1JhlUsWTLflE2pQ'),
    timeout_milliseconds := 55000
  );
  $$
);

-- 3) A cada minuto: avança uma fatia do ciclo (não faz nada se nenhum ciclo
--    estiver em andamento — chamada barata, só 2 leituras na sync_progress)
select cron.schedule(
  'beyond-sync-tick',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://beyond-assist-dtusix9tv-beyondbitsltda-7591s-projects.vercel.app/api/cron/sync',
    headers := jsonb_build_object('x-ingest-secret', 'xcnN8BVNdJmatVX6H1JhlUsWTLflE2pQ'),
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

-- ver o progresso do ciclo atual:
-- select * from public.sync_progress;

-- pausar sem apagar:
-- select cron.alter_job((select jobid from cron.job where jobname = 'beyond-sync-tick'), active := false);

-- remover de vez, se precisar:
-- select cron.unschedule('beyond-sync-start');
-- select cron.unschedule('beyond-sync-tick');
