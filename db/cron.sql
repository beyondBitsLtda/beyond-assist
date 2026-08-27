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
--    1) beyond-sync-start / beyond-sync-tick → SYNC automático (Trello+Gemini), 1x/hora
--    2) beyond-notify-tick                   → notificações push (chamado novo, SLA,
--                                               tarefa atrasada), a cada 5 min — substitui
--                                               o cron que estava em vercel.json
--
--  ⚠️ IMPORTANTE — DOMÍNIO: troque TODO OS `<SEU-DOMINIO>` abaixo pelo domínio ESTÁVEL do
--  seu deploy (Vercel → projeto → Settings → Domains — geralmente `<projeto>.vercel.app`
--  ou um domínio próprio, SEM hash aleatório no meio). NÃO use uma URL de deploy específico
--  (com hash tipo `-dtusix9tv-` no meio) — essas ficam atrás de login da Vercel (testei:
--  retornam HTTP 302 pra vercel.com/sso-api) e o Supabase nunca vai conseguir chamar.
--
--  Pré-requisitos (rode primeiro, nesta ordem):
--    1) db/schema.sql inteiro (cria public.sync_progress)
--    2) INGEST_SECRET já configurada no .env E na Vercel (mesmo segredo do botão SYNC manual)
--    3) CRON_SECRET já configurada no .env E na Vercel (mesmo segredo que o /api/cron/notify
--       já usa — se você ainda não tem, defina um valor aleatório nos dois lugares)
--
--  Os secrets (INGEST_SECRET/CRON_SECRET) já estão preenchidos abaixo com os valores do seu
--  .env. Falta só trocar `<SEU-DOMINIO>` (3x) pelo domínio real — rode isto no SQL Editor do
--  projeto Supabase do Beyond Brain DEPOIS de trocar.
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
    url := 'https://<SEU-DOMINIO>/api/cron/sync?reset=1',
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
    url := 'https://<SEU-DOMINIO>/api/cron/sync',
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
    url := 'https://<SEU-DOMINIO>/api/cron/notify',
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
