-- 028 — Presentes (03/11/2026). Pode rodar duas vezes sem estragar nada.
--
--   proof_presentes   um presente para um jogador (hoje, um personagem — o primeiro foi o Neuro Raposão do
--                     Viana). Fica esperando na área Presentes até a pessoa abrir; abrir põe o personagem na
--                     coleção dela sem cobrar (src/lib/presentes.js). Um mesmo item vai uma vez para cada um.

create table if not exists public.proof_presentes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.abacato_usuarios(id) on delete cascade,
  tipo        text not null check (tipo in ('personagem')),
  item        text not null,
  titulo      text not null,
  mensagem    text not null default '',
  de          text not null default 'Proof',
  criado_em   timestamptz not null default now(),
  aberto_em   timestamptz
);
create index if not exists proof_presentes_usuario_idx on public.proof_presentes (usuario_id, criado_em desc);
create unique index if not exists proof_presentes_um_por_item on public.proof_presentes (usuario_id, tipo, item);
alter table public.proof_presentes enable row level security;

notify pgrst, 'reload schema';
