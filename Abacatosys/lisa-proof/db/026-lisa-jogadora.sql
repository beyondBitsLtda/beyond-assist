-- 026 — A Lisa jogadora (03/11/2026, BEYOND-0014). Pode rodar duas vezes sem estragar nada.
--
--   proof_perfis.robo   a conta é de uma jogadora-robô (a Lisa): a tela mostra "🤖" e ninguém confunde
--                       com uma pessoa. Só a conta dela tem isso ligado.
--   proof_lisa_diario   o que ela fez, uma linha por ação (curso, teoria, quiz, exercício, projeto, Reino,
--                       Bolsa, caderno, Acervo): é a linha do tempo da página pública /lisa e é por ela que
--                       a rotina (scripts/lisa-joga.mjs) sabe o que já fez hoje.

alter table public.proof_perfis add column if not exists robo boolean not null default false;

create table if not exists public.proof_lisa_diario (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  dia         date not null,
  acao        text not null,
  resumo      text not null,
  detalhe     jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);
create index if not exists proof_lisa_diario_quando_idx on public.proof_lisa_diario (usuario_id, criado_em desc);
create index if not exists proof_lisa_diario_dia_idx on public.proof_lisa_diario (usuario_id, dia);
alter table public.proof_lisa_diario enable row level security;

notify pgrst, 'reload schema';
