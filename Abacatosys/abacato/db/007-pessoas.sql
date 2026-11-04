-- Abacato System — quem administra, e quem entra.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/007-pessoas.sql
-- É idempotente.
--
-- Até aqui, criar usuário era rodar um script no terminal. Funciona para uma pessoa e não
-- funciona para uma equipe: quem precisa dar acesso a alguém não é quem tem o terminal aberto.
--
-- `admin` é um sinalizador, e não um papel com poderes finos. A diferença importa: papéis
-- finos existem DENTRO de um quadro ou de um projeto, onde a pergunta é "o que esta pessoa
-- pode fazer aqui". Administrar é outra coisa — é poder criar e desligar contas —, e misturar
-- as duas faria "dono de um quadro" virar caminho para criar usuário.
alter table public.abacato_usuarios add column if not exists admin boolean not null default false;

-- Quem já existe vira administrador. É a única forma de o sistema não nascer trancado: sem
-- isto, ninguém poderia criar o primeiro administrador sem voltar ao terminal.
update public.abacato_usuarios set admin = true where admin = false;

-- Quem criou a conta, e quando ela foi usada pela última vez. Numa equipe pequena isso é o que
-- responde "esta conta ainda serve para alguém?" antes de desligá-la.
alter table public.abacato_usuarios add column if not exists criado_por uuid references public.abacato_usuarios (id) on delete set null;

-- A busca de pessoas para convidar é por nome ou e-mail, e ela acontece a cada tecla.
create index if not exists abacato_usuarios_nome_idx on public.abacato_usuarios (lower(nome));
