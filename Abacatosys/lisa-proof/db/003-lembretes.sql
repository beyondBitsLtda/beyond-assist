-- Lisa_Proof — lembretes por notificação push.
--
-- Uma linha por aparelho/navegador inscrito. O envio NÃO acontece no Worker: quem envia é
-- scripts/lembretes.mjs, rodando no relógio (crontab) do iMac, como o push da Lisa. O Worker só
-- guarda e apaga inscrições.
--
-- Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/003-lembretes.sql

create table if not exists public.proof_push (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.abacato_usuarios(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  aparelho     text,
  criado_em    timestamptz not null default now(),
  -- Para não mandar a mesma cobrança duas vezes no mesmo dia se o relógio rodar de novo.
  ultimo_envio timestamptz,
  ultimo_tipo  text
);

create index if not exists proof_push_usuario on public.proof_push (usuario_id);

alter table public.proof_push enable row level security;
