-- 024 — Diário de estudo e torre de um livro (31/10/2026). Pode rodar duas vezes sem estragar nada.
--
-- O resto da proposta dos cursos que não são de programação:
--
--   proof_diario     uma entrada por trilha e por dia: o que aprendi e onde travei (src/dominio/diario.js).
--                    Sem nota; escrever conta para a ofensiva e dá uns poucos pontos uma vez por dia.
--   proof_dominios   a torre de tema pode nascer de um livro da Biblioteca (livro_id): cada andar cobre
--                    um trecho do livro, na ordem do sumário.
--
-- E o tipo "diario" no livro de pontos. Os motores novos (leitura na pauta, passo a passo, gráfico,
-- conversa), a entrega em PDF e a frase-senha moram no `conteudo` jsonb de proof_desafios — sem coluna nova.
--
-- Aplicar (depois da 023):  npm run migrar -- db/024-diario-e-torre-do-livro.sql

create table if not exists public.proof_diario (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.abacato_usuarios(id) on delete cascade,
  trilha_id      uuid not null references public.proof_trilhas(id) on delete cascade,
  dia            date not null,
  aprendi        text not null check (char_length(aprendi) between 1 and 1500),
  travei         text not null default '' check (char_length(travei) <= 1500),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (usuario_id, trilha_id, dia)
);
create index if not exists proof_diario_trilha on public.proof_diario (trilha_id, dia desc);
alter table public.proof_diario enable row level security;

alter table public.proof_dominios add column if not exists livro_id uuid references public.proof_livros(id) on delete set null;

alter table public.proof_eventos drop constraint if exists proof_eventos_tipo_check;
alter table public.proof_eventos add constraint proof_eventos_tipo_check check (tipo in (
  'item', 'card', 'meta_diaria',
  'quiz', 'exercicio', 'projeto_semanal', 'projeto_final', 'projeto_mensal',
  'conquista', 'dominio', 'cartoes', 'revisao', 'diario'
));

notify pgrst, 'reload schema';
