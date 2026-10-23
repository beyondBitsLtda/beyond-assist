-- Lisa_Proof — as moedas do Reino com CENTAVOS (pedido de 23/10/2026: "ponha centavos também no
-- dinheiro, pois na bolsa tem, e quando o usuário vende ação esses centavos não contam").
--
-- O livro-caixa, o total e a corretagem das ordens da bolsa e o custo das posições passam a
-- aceitar duas casas decimais. Os valores que já existem viram o mesmo número com ",00" — nenhum
-- saldo muda. Pode rodar duas vezes sem estragar nada.
-- Aplicar:  npm run migrar -- db/015-moedas-com-centavos.sql
alter table public.proof_reino_movimentos alter column valor type numeric(14, 2) using valor::numeric(14, 2);
alter table public.proof_bolsa_ordens     alter column taxa  type numeric(12, 2) using taxa::numeric(12, 2);
alter table public.proof_bolsa_ordens     alter column total type numeric(14, 2) using total::numeric(14, 2);
alter table public.proof_bolsa_posicoes   alter column custo type numeric(14, 2) using custo::numeric(14, 2);
