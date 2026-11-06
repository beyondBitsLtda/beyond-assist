-- Lisa_Proof — Repositórios no Acervo (pedido de 06/11/2026): "no acervo ponha a funcionalidade de poder
-- pôr links de repositórios também".
--
-- O tipo novo 'repositorio' (GitHub, GitLab, Bitbucket ou Codeberg) entra na regra do tipo de
-- proof_acervo. O link guardado é sempre a raiz do repositório, e a chave de duplicado é
-- repo:<plataforma>:<dono/nome> (src/dominio/acervo.js: repositorioDoLink, chaveDoMaterial).
--
-- Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/039-acervo-repositorios.sql

alter table public.proof_acervo drop constraint if exists proof_acervo_tipo_check;
alter table public.proof_acervo
  add constraint proof_acervo_tipo_check check (tipo in ('livro', 'artigo', 'videoaula', 'video', 'repositorio'));
