// O diário de estudo no banco (31/10/2026): uma entrada por trilha e por dia — o que aprendi e onde
// travei. As regras moram em src/dominio/diario.js; a migração é db/024-diario-e-torre-do-livro.sql.
// Escrever pontua uma vez por dia (somando todas as trilhas): conta para a ofensiva, sem nota.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { registrarEvento, estudouHoje, depoisDePontuar, resultadoDaPontuacao, trilhaDoUsuario } from "./estudo.js";
import { diaDe } from "@/dominio/datas.js";
import { validarEntradaDoDiario, chaveDoDiario, PONTOS_DO_DIARIO, LIMITES_DO_DIARIO } from "@/dominio/diario.js";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}
const ehId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
const paraTela = (e) => ({ dia: e.dia, aprendi: e.aprendi, travei: e.travei, atualizadoEm: e.atualizado_em });

/** As últimas entradas do diário de uma trilha (a de hoje, se houver, vem primeiro). */
export async function diarioDaTrilha(usuarioId, trilhaId) {
  if (!ehId(trilhaId)) throw new ErroDeAcesso(404, "trilha não encontrada");
  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  const { data, error } = await supabase.from("proof_diario").select("dia, aprendi, travei, atualizado_em")
    .eq("usuario_id", usuarioId).eq("trilha_id", trilha.id).order("dia", { ascending: false }).limit(LIMITES_DO_DIARIO.ultimas);
  falhou(error, "diário");
  const hoje = diaDe();
  const entradas = (data || []).map(paraTela);
  return { hoje, deHoje: entradas.find((e) => e.dia === hoje) || null, entradas, pontos: PONTOS_DO_DIARIO };
}

/** Escrever (ou reescrever) a entrada de hoje. A primeira do dia pontua. */
export async function escreverNoDiario(usuarioId, trilhaId, bruto) {
  if (!ehId(trilhaId)) throw new ErroDeAcesso(404, "trilha não encontrada");
  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  let entrada;
  try { entrada = validarEntradaDoDiario(bruto); } catch (e) { throw new ErroDeAcesso(400, e.message); }
  const hoje = diaDe();
  const { data, error } = await supabase.from("proof_diario").upsert(
    { usuario_id: usuarioId, trilha_id: trilha.id, dia: hoje, ...entrada, atualizado_em: new Date().toISOString() },
    { onConflict: "usuario_id,trilha_id,dia" },
  ).select("dia, aprendi, travei, atualizado_em").single();
  falhou(error, "diário");
  const estudavaAntes = await estudouHoje(usuarioId);
  const ganhou = await registrarEvento({
    usuarioId, trilhaId: trilha.id, tipo: "diario", chave: chaveDoDiario(hoje), pontos: PONTOS_DO_DIARIO,
    detalhe: { titulo: `Diário: ${trilha.tema}`.slice(0, 200) },
  });
  const extra = ganhou > 0 ? resultadoDaPontuacao(ganhou, await depoisDePontuar({ usuarioId, trilhaId: trilha.id, estudavaAntes, ganhou })) : { pontos: 0 };
  return { entrada: paraTela(data), ...extra };
}
