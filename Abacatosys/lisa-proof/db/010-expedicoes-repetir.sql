-- Lisa_Proof — expedições sem custo e repetíveis (ajuste de 22/10/2026).
--
-- Pode rodar duas vezes sem estragar nada. Só TIRA uma trava: o mesmo lugar agora pode ser feito
-- mais de uma vez no dia (o limite continua: 3 expedições por dia, pelo índice do número).
-- Nenhum dado muda.
-- Aplicar:  npm run migrar -- db/010-expedicoes-repetir.sql
drop index if exists public.proof_expedicoes_um_por_lugar;
create index if not exists proof_expedicoes_lugar on public.proof_expedicoes (usuario_id, expedicao, dia);
