-- A conta Lisa Task (01/11/2026): o Abacato com o nome e o visual da Lisa, só com os quadros
-- de tarefas — sem a parte de documentos. Os limites moram em src/dominio/planos.js; aqui só
-- entra o tipo novo nas duas travas do banco.
--
-- Idempotente: pode rodar de novo sem estragar nada.

alter table public.abacato_usuarios
  drop constraint if exists abacato_usuarios_tipo_conhecido;
alter table public.abacato_usuarios
  add constraint abacato_usuarios_tipo_conhecido
  check (tipo in ('interno', 'cliente', 'lisatask'));

-- Antes: "cliente não fala com a assistente". Agora vale para toda conta de fora — a Lisa Task
-- também não fala com a assistente do Abacato (ela tem a Lisa dela).
alter table public.abacato_usuarios
  drop constraint if exists abacato_usuarios_cliente_sem_lisa;
alter table public.abacato_usuarios
  add constraint abacato_usuarios_cliente_sem_lisa
  check (tipo = 'interno' or lisa = false);
