-- Lisa_Proof — Apostilas (pedido de 06/11/2026): "deixe um modo onde o usuário pode pedir para ela
-- mostrar uma aula completa contendo todos os pontos desse checklist, criando apostilas… esses cadernos
-- com a aula vão ser uma categoria chamada apostila, com uma capa diferente e uma categoria separada lá
-- na aba de cadernos".
--
-- A apostila é um caderno (proof_cadernos) com categoria 'apostila': as páginas são as seções da aula,
-- e o vínculo do caderno inteiro com o assunto (proof_vinculos, alvo_tipo 'assunto') diz de qual assunto
-- ela é. As regras moram em src/dominio/apostila.js.
--
-- Só ACRESCENTA. Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/038-apostilas.sql

alter table public.proof_cadernos add column if not exists categoria text not null default 'caderno';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'proof_cadernos_categoria_valida') then
    alter table public.proof_cadernos
      add constraint proof_cadernos_categoria_valida check (categoria in ('caderno', 'apostila'));
  end if;
end $$;

create index if not exists proof_cadernos_categoria on public.proof_cadernos (usuario_id, categoria, atualizado_em desc);
