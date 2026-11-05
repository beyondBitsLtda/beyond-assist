-- 036: o uso do Proof (1.8.0, 04/11/2026). O painel do administrador (/uso) mostra quando cada pessoa entrou, quanto
-- tempo ficou, em que áreas e o que fez. Um ACESSO é um período contínuo de uso: o login abre um, e a batida de
-- presença da tela (uma por minuto, com a aba visível) soma o tempo e a área; uma pausa de mais de 5 minutos fecha o
-- acesso e a próxima batida abre outro (src/dominio/uso.js). Guarda só quando, quanto tempo, onde e o tipo de
-- aparelho: nada do que a pessoa escreve.

create table if not exists public.proof_acessos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.abacato_usuarios(id) on delete cascade,
  inicio     timestamptz not null default now(),
  ultimo     timestamptz not null default now(),
  segundos   integer not null default 0 check (segundos >= 0),
  -- minutos (batidas) em cada área: { "reino": 12, "pratica": 5 }
  paginas    jsonb not null default '{}'::jsonb,
  aparelho   text not null default 'computador' check (aparelho in ('computador', 'celular', 'tablet')),
  -- o acesso começou por um login (e não por uma sessão que já estava aberta)
  entrou     boolean not null default false
);
create index if not exists proof_acessos_usuario on public.proof_acessos (usuario_id, ultimo desc);
create index if not exists proof_acessos_ultimo on public.proof_acessos (ultimo desc);
alter table public.proof_acessos enable row level security;

notify pgrst, 'reload schema';
