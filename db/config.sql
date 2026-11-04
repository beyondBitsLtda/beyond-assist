-- ============================================================
--  CONFIGURAÇÃO DA LISA — o que se muda por um botão, não por um deploy
--
--  Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/config.sql
--  É idempotente.
--
--  Até aqui, tudo que muda o comportamento da Lisa é variável de ambiente. Isso é certo para
--  segredo e para endereço de servidor — coisas que mudam junto com um deploy. É errado para
--  uma escolha do dia a dia: trocar a fonte das tarefas entre o Trello e o Abacato por variável
--  de ambiente significaria publicar de novo para experimentar, e publicar de novo para voltar.
--
--  Uma tabela de chave e valor resolve, e resolve de um jeito que os DOIS servidores enxergam:
--  a Lisa da nuvem e a Lisa de casa falam com este mesmo Postgres, então o interruptor vale
--  para as duas no mesmo instante. Com variável de ambiente seriam duas configurações para
--  manter em sincronia na mão — e o dia em que elas discordassem seria difícil de perceber,
--  porque cada uma estaria "certa" olhando só para si.
--
--  O valor é texto puro, e não JSON: tudo que vai aqui é uma escolha curta ("trello" ou
--  "abacato"). JSON convidaria a guardar estrutura, e estrutura que vive fora do esquema é
--  como um banco vira um saco de configuração que ninguém sabe ler.
-- ============================================================
create table if not exists public.lisa_config (
  chave          text primary key,
  valor          text not null,
  -- Quem mexeu e quando. Numa configuração que muda o que a Lisa responde, "desde quando está
  -- assim?" é a primeira pergunta quando alguém estranha uma resposta.
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

alter table public.lisa_config enable row level security;
-- (só acessada pela service_role — mesmo padrão das outras tabelas)

-- A fonte dos quadros começa no Trello: é onde os dados estão hoje, e um sistema que troca de
-- fonte sozinho ao ganhar uma tabela nova seria uma surpresa desagradável.
insert into public.lisa_config (chave, valor, atualizado_por)
values ('fonte_dos_quadros', 'trello', 'padrão do sistema')
on conflict (chave) do nothing;
