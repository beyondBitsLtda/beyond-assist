-- 033 — Modo Bootcamp: o nível do torneio contra a CPU e o cenário do escritório (04/11/2026). Pode rodar duas
-- vezes sem estragar nada.
--
--   proof_bootcamp_torneios.opcoes   { nivel: "facil"|"medio"|"dificil"|"lendario", cenario: "neon"|"datacenter"|
--                                    "orbital"|"loft"|"cyber" } (src/dominio/bootcamp.js). Os torneios de antes
--                                    ficam com {} e valem como médio e neon.

alter table public.proof_bootcamp_torneios add column if not exists opcoes jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
