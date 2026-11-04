-- 034 — Modo Bootcamp: a temporada no estilo reality (04/11/2026). Pode rodar duas vezes sem estragar nada.
--
--   proof_bootcamp_torneios.formato   ganha 'temporada': episódios com prova de imunidade (ou em equipe) e prova
--                                     de eliminação, e a grande final com os dois últimos (src/dominio/bootcamp.js)
--   proof_bootcamp_torneios.rodadas_total   até 20: uma temporada de 8 competidores, saindo 1 por episódio, tem 13
--   proof_bootcamp_torneios.estado    o que a temporada lembra entre as provas: quem ficou salvo da eliminação, o
--                                     vencedor da última prova (o capitão) e a escolha de membro pendente
--   proof_bootcamp_rodadas.prova      a prova da rodada: { tipo, episodio, competidores, equipes, sai }

alter table public.proof_bootcamp_torneios drop constraint if exists proof_bootcamp_torneios_formato_check;
alter table public.proof_bootcamp_torneios add constraint proof_bootcamp_torneios_formato_check
  check (formato in ('temporada', 'mata-mata', 'pontos-corridos'));

alter table public.proof_bootcamp_torneios drop constraint if exists proof_bootcamp_torneios_rodadas_total_check;
alter table public.proof_bootcamp_torneios add constraint proof_bootcamp_torneios_rodadas_total_check
  check (rodadas_total between 1 and 20);

alter table public.proof_bootcamp_torneios add column if not exists estado jsonb not null default '{}'::jsonb;
alter table public.proof_bootcamp_rodadas add column if not exists prova jsonb;

notify pgrst, 'reload schema';
