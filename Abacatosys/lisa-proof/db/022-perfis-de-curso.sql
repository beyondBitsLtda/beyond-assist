-- 022 — Perfis de curso (30/10/2026). Pode rodar duas vezes sem estragar nada.
--
-- Pedido: cursos que não são de programação (música, idiomas, matemática e qualquer tema) com
-- prática apropriada. A trilha ganha o PERFIL, que escolhe o motor do exercício do dia, a evidência
-- do projeto no lugar do GitHub e o jeito de a Lisa falar (src/dominio/perfis.js). O motor e a
-- evidência de cada desafio moram no `conteudo` jsonb de proof_desafios — sem coluna nova lá.
--
-- Toda trilha que já existe fica 'programacao': o caminho de antes continua igual.
--
-- As fotos e os áudios da entrega NÃO são guardados: vão do formulário para a IA e somem. Fica só
-- a avaliação e, das fotos, uma miniatura pequena dentro da resposta do desafio.
--
-- Aplicar:  npm run migrar -- db/022-perfis-de-curso.sql

alter table public.proof_trilhas add column if not exists perfil text not null default 'programacao';
alter table public.proof_trilhas drop constraint if exists proof_trilhas_perfil_check;
alter table public.proof_trilhas add constraint proof_trilhas_perfil_check
  check (perfil in ('programacao', 'musica', 'idiomas', 'matematica', 'livre'));

notify pgrst, 'reload schema';
