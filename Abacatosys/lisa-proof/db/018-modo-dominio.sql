-- Lisa_Proof — o Modo Domínio (pedido de 24/10/2026): uma torre de 10 a 100 andares para dominar
-- um repositório público (GitHub ou GitLab). As regras moram em src/dominio/modoDominio.js.
--
--   proof_dominios         uma torre: o repositório, a análise da Lisa, o nível, a branch do
--                          desafio, o andar de agora e o certificado (quando chega ao topo)
--   proof_dominio_andares  um andar: o desafio, o chefão, as entregas (commits avaliados)
--
-- E o tipo "dominio" no livro de pontos (os pontos viram moedas, ranking e ofensiva) e no
-- livro-caixa do Reino (o prêmio em tropas que não cabe no Reino vira moedas).
--
-- Só ACRESCENTA. Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/018-modo-dominio.sql

create table if not exists public.proof_dominios (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.abacato_usuarios(id) on delete cascade,
  provedor        text not null check (provedor in ('github', 'gitlab')),
  repo_caminho    text not null,                  -- "dono/repo" (no GitLab, pode ter subgrupos)
  repo_url        text not null,
  repo_branch     text,                           -- a branch lida na análise
  analise         jsonb not null,                 -- apto, motivo, complexidade, resumo, tecnologias, assuntos
  nivel           smallint not null check (nivel between 1 and 5),
  status          text not null default 'analisado' check (status in ('analisado', 'montando', 'ativo', 'concluido')),
  andares         smallint check (andares between 10 and 100),
  andar_atual     smallint not null default 1,
  chefao_final    text,
  entrega_url     text,                           -- o repositório onde a pessoa trabalha (fork ou o mesmo)
  entrega_branch  text,                           -- a branch do desafio
  commit_base     text,                           -- a ponta da branch quando ela foi configurada
  premios         jsonb not null default '[]'::jsonb, -- o que os marcos já deram (cada marco paga uma vez)
  certificado     text unique,                    -- o código do certificado (no topo)
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  concluido_em    timestamptz
);
create index if not exists proof_dominios_usuario on public.proof_dominios (usuario_id, criado_em desc);

create table if not exists public.proof_dominio_andares (
  dominio_id     uuid not null references public.proof_dominios(id) on delete cascade,
  numero         smallint not null check (numero between 1 and 100),
  titulo         text not null,
  objetivo       text not null default '',
  assunto        text not null default '',
  dificuldade    smallint not null check (dificuldade between 1 and 5),
  chefao         text not null,                   -- o id no elenco (CHEFOES)
  chefao_nome    text not null,                   -- com o epíteto do andar ("Golem do Callback")
  desafio        jsonb,                           -- gerado quando a pessoa chega no andar
  commit_inicio  text,                            -- de onde o andar começou (a entrega compara daqui)
  ultimo_commit  text,                            -- o último commit avaliado (o mesmo não vale duas vezes)
  entregas       jsonb not null default '[]'::jsonb,
  tentativas     smallint not null default 0,
  melhor_nota    smallint,
  atributos      jsonb,                           -- os atributos da melhor entrega
  vencido_em     timestamptz,
  primary key (dominio_id, numero)
);

alter table public.proof_dominios        enable row level security;
alter table public.proof_dominio_andares enable row level security;

alter table public.proof_eventos drop constraint if exists proof_eventos_tipo_check;
alter table public.proof_eventos add constraint proof_eventos_tipo_check check (tipo in (
  'item', 'card', 'meta_diaria',
  'quiz', 'exercicio', 'projeto_semanal', 'projeto_final', 'projeto_mensal',
  'conquista', 'dominio'
));

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio'));

notify pgrst, 'reload schema';
