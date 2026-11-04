-- Abacato System — segunda leva do esquema.
--
-- Duas coisas que a importação do Trello obrigou a existir. Arquivo separado do schema.sql
-- porque o banco já está em uso: o schema.sql descreve como o banco NASCE, e este descreve
-- como ele mudou. Misturar os dois faz perder a ordem em que as coisas aconteceram.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/002-origem-e-concluido.sql
-- É idempotente: rodar duas vezes não quebra nada.

-- ============================================================ 1. de onde veio

-- `abacato_cards` já nasceu com `origem`/`origem_id`. Estas colunas levam a mesma ideia ao
-- resto: sem elas, reimportar o mesmo quadro do Trello criaria um segundo quadro, com segundas
-- colunas, segundas etiquetas e segundas checklists — e os cards, esses sim protegidos pelo
-- índice único, simplesmente falhariam ao entrar.
--
-- Reimportar tem de ser seguro. Uma importação que falha no meio, ou um Trello que ganhou mais
-- três cards depois da primeira leva, são os dois casos normais — e os dois pedem rodar de novo.

alter table public.abacato_quadros          add column if not exists origem text;
alter table public.abacato_quadros          add column if not exists origem_id text;
alter table public.abacato_colunas          add column if not exists origem text;
alter table public.abacato_colunas          add column if not exists origem_id text;
alter table public.abacato_etiquetas        add column if not exists origem text;
alter table public.abacato_etiquetas        add column if not exists origem_id text;
alter table public.abacato_checklists       add column if not exists origem text;
alter table public.abacato_checklists       add column if not exists origem_id text;
alter table public.abacato_checklist_itens  add column if not exists origem text;
alter table public.abacato_checklist_itens  add column if not exists origem_id text;

-- Os índices são únicos e SEM cláusula `where`, de propósito.
--
-- A versão com `where origem_id is not null` parecia mais correta e inviabilizava a
-- importação: o Postgres não consegue inferir um índice PARCIAL num `on conflict (origem,
-- origem_id)` — seria preciso repetir a condição do índice na própria instrução, e o PostgREST
-- não tem como fazer isso. Sem inferência, "não duplicar ao reimportar" deixa de funcionar.
--
-- E não é preciso: no Postgres, duas linhas com NULL não colidem num índice único. Tudo que
-- nasce aqui dentro tem `origem_id` nulo e fica livre da regra — duas colunas chamadas
-- "A fazer" em dois quadros diferentes continuam perfeitamente normais.
drop index if exists abacato_quadros_origem_idx;
drop index if exists abacato_colunas_origem_idx;
drop index if exists abacato_etiquetas_origem_idx;
drop index if exists abacato_checklists_origem_idx;
drop index if exists abacato_checklist_itens_origem_idx;
drop index if exists abacato_cards_origem_idx;

create unique index abacato_quadros_origem_idx          on public.abacato_quadros (origem, origem_id);
create unique index abacato_colunas_origem_idx          on public.abacato_colunas (origem, origem_id);
create unique index abacato_etiquetas_origem_idx        on public.abacato_etiquetas (origem, origem_id);
create unique index abacato_checklists_origem_idx       on public.abacato_checklists (origem, origem_id);
create unique index abacato_checklist_itens_origem_idx  on public.abacato_checklist_itens (origem, origem_id);
create unique index abacato_cards_origem_idx            on public.abacato_cards (origem, origem_id);

-- O mesmo link duas vezes no mesmo card é ruído, venha de onde vier. Este índice resolve a
-- reimportação (os links do Trello não têm id próprio na exportação) e também o dedo pesado de
-- quem cola o endereço duas vezes.
create unique index if not exists abacato_links_card_url_idx on public.abacato_links (card_id, url);

-- ============================================================ 2. card concluído

-- Até aqui, um card só podia estar "concluído" por ter todas as checklists completas — e a
-- maioria dos cards não tem checklist nenhuma.
--
-- O Trello guarda isso separado, no `dueComplete`: a data foi cumprida. Importar sem esta
-- coluna faria todo card já resolvido no Trello chegar aqui marcado de vermelho como atrasado,
-- que é a pior primeira impressão possível de uma migração.
--
-- Serve fora da importação também: marcar um card como feito sem precisar inventar uma
-- checklist de um item só.
alter table public.abacato_cards add column if not exists concluido boolean not null default false;

-- O índice de prazo deixa de fora o que já está concluído: quem pergunta "o que está atrasado"
-- nunca quer o que já foi feito, e essa é a consulta que a Lisa vai fazer todo dia.
drop index if exists abacato_cards_prazo_idx;
create index if not exists abacato_cards_prazo_idx
  on public.abacato_cards (fim_em)
  where fim_em is not null and not arquivado and not concluido;
