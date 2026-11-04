-- Quem pode conversar com a Lisa.
--
-- A assistente lê quadros e documentos e MEXE neles — cria tarefa, muda prazo, abre projeto.
-- Ela já respeita a permissão de cada pessoa (nada que você não alcança), mas quem decide se
-- ela existe para alguém é quem administra.
--
-- O PADRÃO É NÃO. Uma conta nova não fala com a Lisa até alguém ligar.
--
-- Parece antipático e é o contrário: cada conversa custa cota do modelo, e uma assistente que
-- nasce ligada para todo mundo é uma conta que ninguém decidiu abrir. Ligar é um clique;
-- descobrir que a cota acabou porque quinze pessoas estavam conversando, não.
alter table public.abacato_usuarios
  add column if not exists lisa boolean not null default false;

-- Quem administra o Abacato já tem a Lisa ligada: é quem vai testá-la e liberar os outros.
-- Sem isto, aplicar esta migração deixaria a assistente desligada para TODO MUNDO, inclusive
-- para quem deveria ligá-la — e o único caminho de volta seria o terminal do banco.
update public.abacato_usuarios set lisa = true where admin = true;

comment on column public.abacato_usuarios.lisa is
  'Se esta pessoa pode usar a assistente. Conferido no banco a cada pedido, nunca pelo cookie.';
