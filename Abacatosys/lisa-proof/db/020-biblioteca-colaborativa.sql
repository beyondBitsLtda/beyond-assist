-- 020 — A Biblioteca Colaborativa (26/10/2026). Pode rodar duas vezes sem estragar nada.
--
-- O acervo de todos: livros e artigos em PDF, artigos por link, videoaulas e vídeos teóricos. Cada
-- envio passa pelo bibliotecário (o líder do ranking da semana e o administrador); aprovado, quem
-- enviou ganha moedas do Reino (livro-caixa, tipo 'acervo') e o bibliotecário ganha pela revisão
-- ('acervo_revisao'). Quem gostou agradece com uma gorjeta ('gorjeta_dada' / 'gorjeta_recebida').
-- As regras moram em src/dominio/acervo.js; o caminho até o banco, em src/lib/acervo.js.
--
-- O acervo é do mundo de verdade (não tem gêmea de teste): as moedas que ele paga são de verdade.

create table if not exists public.proof_acervo (
  id            uuid primary key default gen_random_uuid(),
  autor_id      uuid not null,                       -- quem trouxe (abacato_usuarios.id)
  tipo          text not null check (tipo in ('livro', 'artigo', 'videoaula', 'video')),
  titulo        text not null,
  autores       text not null default '',            -- de quem é a obra (autor, revista, canal)
  categoria     text not null,
  assunto       text not null,
  descricao     text not null default '',
  arquivo       text,                                -- o PDF no bucket proof-acervo: <autor>/<id>.pdf
  tamanho       bigint not null default 0,
  paginas       int not null default 0,
  sumario       jsonb not null default '[]'::jsonb,
  hash          text,                                -- SHA-256 do PDF (acusa o mesmo arquivo de novo)
  capa          text,                                -- data URL de uma imagem pequena
  link          text,                                -- o vídeo ou o artigo por link
  chave         text not null,                       -- acusa duplicado (mesmo vídeo; mesmo título no tipo)
  status        text not null default 'enviando'
                check (status in ('enviando', 'pendente', 'aprovado', 'recusado', 'retirado')),
  motivo        text,                                -- por que foi recusado ou retirado
  revisor_id    uuid,
  revisado_em   timestamptz,
  recompensa    int not null default 0,              -- as moedas pagas na aprovação
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists proof_acervo_status_tipo on public.proof_acervo (status, tipo, revisado_em desc);
create index if not exists proof_acervo_autor on public.proof_acervo (autor_id, criado_em desc);
-- o mesmo material não entra duas vezes (o que está na fila e o que está no acervo)
create unique index if not exists proof_acervo_sem_duplicata on public.proof_acervo (chave) where status in ('pendente', 'aprovado');
create unique index if not exists proof_acervo_mesmo_pdf on public.proof_acervo (hash) where status in ('pendente', 'aprovado') and hash is not null;

create table if not exists public.proof_acervo_gorjetas (
  material_id uuid not null references public.proof_acervo (id) on delete cascade,
  de_id       uuid not null,
  para_id     uuid not null,
  moedas      int not null check (moedas > 0),
  criado_em   timestamptz not null default now(),
  primary key (material_id, de_id)
);
create index if not exists proof_acervo_gorjetas_para on public.proof_acervo_gorjetas (para_id);

alter table public.proof_acervo          enable row level security;
alter table public.proof_acervo_gorjetas enable row level security;

-- O livro do acervo na biblioteca de cada um: a linha é da pessoa (marcações, onde parou, texto
-- para a busca), o PDF é o do acervo (não é copiado nem conta no espaço dela).
alter table public.proof_livros add column if not exists acervo_id uuid;
create unique index if not exists proof_livros_do_acervo on public.proof_livros (usuario_id, acervo_id) where acervo_id is not null;

-- o livro-caixa do Reino ganha os lançamentos do acervo (os tipos de antes continuam todos)
alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida'));

-- ============================================================ o bucket do acervo

-- PRIVADO, como o da biblioteca: cada leitura passa pelo servidor, que assina um endereço de vida
-- curta; o envio também (o PDF vai direto do navegador para o Storage, sem atravessar o Worker).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof-acervo', 'proof-acervo', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
