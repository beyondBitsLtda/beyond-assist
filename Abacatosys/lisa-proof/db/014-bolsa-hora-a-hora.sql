-- Lisa_Proof — a Bolsa do Reino hora a hora (pedido de 23/10/2026: "deixe as ações variarem de
-- hora em hora para ver o movimento nos gráficos").
--
-- O pregão passa a guardar a ABERTURA de cada ação no dia (o fechamento de ontem); o preço de cada
-- hora sai do caminho entre a abertura e o fechamento (src/dominio/bolsa.js) e tem centavos — por
-- isso o preço das ordens vira numérico. Pode rodar duas vezes sem estragar nada; os dias que já
-- existem ganham a abertura pela própria variação guardada.
-- Aplicar:  npm run migrar -- db/014-bolsa-hora-a-hora.sql
alter table public.proof_bolsa_precos add column if not exists abertura integer;
update public.proof_bolsa_precos
   set abertura = greatest(1, round(preco / (1 + variacao / 100.0)))
 where abertura is null;

alter table public.proof_bolsa_ordens alter column preco type numeric(10, 2) using preco::numeric(10, 2);
