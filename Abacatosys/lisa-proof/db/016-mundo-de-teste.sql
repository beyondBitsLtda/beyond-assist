-- Lisa_Proof — o REINO DE TESTE, um mundo à parte (pedido de 23/10/2026: "o modo teste é
-- simplesmente teste — faça em um modo de reino à parte, com um reino teste onde tudo é liberado,
-- onde pode atacar outros reinos teste").
--
-- Cada tabela do jogo ganha uma GÊMEA proof_teste_*, com as mesmas colunas, padrões, checagens e
-- índices únicos (as regras do jogo valem igual lá) — mas SEM as chaves estrangeiras: os reinos-robô
-- do mundo de teste não são pessoas. O código escolhe a tabela pelo mundo do pedido
-- (src/lib/mundo.js); nada do mundo de teste toca as tabelas de verdade.
--
-- Só ACRESCENTA tabelas vazias; nenhum dado existente muda. Pode rodar duas vezes sem estragar nada.
-- REGRA daqui para a frente: coluna nova numa tabela do jogo entra também na gêmea de teste.
-- Aplicar:  npm run migrar -- db/016-mundo-de-teste.sql
create table if not exists public.proof_teste_reinos             (like public.proof_reinos             including all);
create table if not exists public.proof_teste_reino_movimentos   (like public.proof_reino_movimentos   including all);
create table if not exists public.proof_teste_invasoes           (like public.proof_invasoes           including all);
create table if not exists public.proof_teste_expedicoes         (like public.proof_expedicoes         including all);
create table if not exists public.proof_teste_pazes              (like public.proof_pazes              including all);
create table if not exists public.proof_teste_paz_votos          (like public.proof_paz_votos          including all);
create table if not exists public.proof_teste_operarios_ofertas  (like public.proof_operarios_ofertas  including all);
create table if not exists public.proof_teste_alugueis           (like public.proof_alugueis           including all);
create table if not exists public.proof_teste_bolsa_posicoes     (like public.proof_bolsa_posicoes     including all);
create table if not exists public.proof_teste_bolsa_ordens       (like public.proof_bolsa_ordens       including all);

alter table public.proof_teste_reinos            enable row level security;
alter table public.proof_teste_reino_movimentos  enable row level security;
alter table public.proof_teste_invasoes          enable row level security;
alter table public.proof_teste_expedicoes        enable row level security;
alter table public.proof_teste_pazes             enable row level security;
alter table public.proof_teste_paz_votos         enable row level security;
alter table public.proof_teste_operarios_ofertas enable row level security;
alter table public.proof_teste_alugueis          enable row level security;
alter table public.proof_teste_bolsa_posicoes    enable row level security;
alter table public.proof_teste_bolsa_ordens      enable row level security;

-- a API enxerga as tabelas novas na hora
notify pgrst, 'reload schema';
