-- Comentários nos cards, com imagens anexas (BEYOND-0004).
--
-- Um comentário é de UMA pessoa sobre UM card: texto, quando, quem. As imagens ficam numa
-- tabela à parte porque um comentário pode ter várias, e o arquivo de verdade mora no Storage
-- (bucket `abacato-comentarios`) — o banco guarda só o caminho e o tamanho.
--
-- Pode rodar duas vezes.

create table if not exists public.abacato_comentarios (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.abacato_cards (id) on delete cascade,
  -- `set null`, e não cascade: desligar a conta de alguém não pode apagar o que essa pessoa
  -- disse nos cards — o histórico da conversa é do quadro, não do autor.
  autor_id   uuid references public.abacato_usuarios (id) on delete set null,
  texto      text not null default '',
  criado_em  timestamptz not null default now(),
  editado_em timestamptz
);
create index if not exists abacato_comentarios_card_idx on public.abacato_comentarios (card_id, criado_em desc);

create table if not exists public.abacato_comentario_anexos (
  id            uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references public.abacato_comentarios (id) on delete cascade,
  -- O quadro vai junto, repetido de propósito: é por ele que o espaço usado é cobrado de quem
  -- é dono do quadro (ver bytesUsados em src/lib/limites.js), sem subir quatro tabelas a cada
  -- conta do plano.
  quadro_id     uuid not null references public.abacato_quadros (id) on delete cascade,
  caminho       text not null,
  nome          text not null default '',
  tipo          text not null,
  tamanho       bigint not null default 0,
  posicao       integer not null default 0,
  criado_em     timestamptz not null default now()
);
create index if not exists abacato_comentario_anexos_comentario_idx on public.abacato_comentario_anexos (comentario_id, posicao);
create index if not exists abacato_comentario_anexos_quadro_idx on public.abacato_comentario_anexos (quadro_id);

-- PRIVADO, como o dos documentos: um print colado num comentário pode ter tela de cliente,
-- planilha, contrato. Cada imagem sai por um endereço assinado de vida curta, gerado pelo
-- servidor depois de conferir que quem pede enxerga o quadro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'abacato-comentarios', 'abacato-comentarios', false,
  10485760,   -- 10 MB por imagem (a tela já reduz prints grandes antes de enviar)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Mesma rede de segurança das outras tabelas: RLS ligado e nenhuma política. Só a chave de
-- serviço (o servidor do Abacato) alcança as tabelas e o bucket.
alter table public.abacato_comentarios enable row level security;
alter table public.abacato_comentario_anexos enable row level security;
