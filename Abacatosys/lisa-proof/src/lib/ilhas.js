// A Temporada das Ilhas no banco (03/11/2026, BEYOND-0020). As regras moram em src/dominio/ilhas.js; as tabelas
// são as da db/030 (proof_ilhas, proof_tripulacoes, proof_conchas, proof_ilha_batalhas, proof_pactos).
//
// As ilhas são do mundo de verdade (o Reino de Teste não tem arquipélago). As moedas do reino entram e saem pelo
// livro-caixa de sempre (creditarMoedas e gastarMoedas, tipo 'ilhas'); as conchas têm o livro-caixa delas.
// A ilha grava com `versao` (duas conquistas ao mesmo tempo: só a primeira vale); a tripulação também.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { noMundo } from "./mundo.js";
import { buscarTodas } from "./estudo.js";
import { obterReino, creditarMoedas, gastarMoedas, saldoDoUsuario, nomesPublicos } from "./reino.js";
import { diaDe } from "@/dominio/datas.js";
import { TROPAS, ORDEM_DA_TRIPULACAO, contagens, espacoUsado, somarTropas } from "@/dominio/tropas.js";
import { veiculosDe, VEICULOS } from "@/dominio/veiculos.js";
import {
  TEMPORADA, CONCHAS_POR_MOEDA, PACOTES_DE_CONCHAS, ARQUIPELAGO, ilhaPorId, NOMES_DOS_NIVEIS, CONSTRUCOES_DA_ILHA, ORDEM_DA_ILHA,
  ATAQUES_DE_ILHA_POR_DIA, HORAS_DE_ESCUDO_DA_CONQUISTA, DIAS_DO_PACTO, VEICULO_DAS_ILHAS, ILHAS_POR_JOGADOR,
  producaoDaIlha, juntadoNaIlha, podeConstruirNaIlha, capacidadeDaTripulacao, nivelDoPorto, podeTreinarTripulacao,
  podeAtacarIlha, pactoVigente, pactoPendente, guardasDaConquista, batalhaNaIlha, desfechoNaIlha, protecaoDoBau,
  saqueDeConchas, construcoesAposConquista, temporadaAberta, defensorDaIlha,
} from "@/dominio/ilhas.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const CAMPOS = "id, dono_id, construcoes, guardas, coletado_em, conquistada_em, escudo_ate, versao";
const conflito = () => new ErroDeAcesso(409, "a ilha mudou enquanto você mexia — veja de novo e tente outra vez");
const semente = () => { const [n] = crypto.getRandomValues(new Uint32Array(1)); return n || 1; };

function exigirTemporada() {
  if (!temporadaAberta(diaDe())) throw new ErroDeAcesso(400, `a ${TEMPORADA.nome} não está aberta agora`);
}

// ---------------------------------------------------------------- leitura

/** As 12 ilhas, criando as que ainda não existem (todas começam com os nativos). */
async function ilhasDoArquipelago() {
  const { data, error } = await supabase.from("proof_ilhas").select(CAMPOS).eq("temporada", TEMPORADA.id);
  falhou(error, "ilhas");
  const existentes = new Map((data || []).map((i) => [i.id, i]));
  const faltando = ARQUIPELAGO.filter((d) => !existentes.has(d.id));
  if (faltando.length) {
    const { error: e2 } = await supabase.from("proof_ilhas")
      .upsert(faltando.map((d) => ({ id: d.id, temporada: TEMPORADA.id, construcoes: d.construcoes, guardas: {} })), { onConflict: "id", ignoreDuplicates: true });
    falhou(e2, "ilhas");
    const { data: todas, error: e3 } = await supabase.from("proof_ilhas").select(CAMPOS).eq("temporada", TEMPORADA.id);
    falhou(e3, "ilhas");
    return ARQUIPELAGO.map((d) => (todas || []).find((i) => i.id === d.id)).filter(Boolean);
  }
  return ARQUIPELAGO.map((d) => existentes.get(d.id));
}

async function saldoDeConchas(usuarioId) {
  const movimentos = await buscarTodas(() => supabase.from("proof_conchas").select("valor").eq("usuario_id", usuarioId).eq("temporada", TEMPORADA.id).order("criado_em"));
  return Math.round(movimentos.reduce((s, m) => s + (Number(m.valor) || 0), 0) * 100) / 100;
}

async function lancarConchas(usuarioId, tipo, valor, detalhe = {}) {
  const { data, error } = await supabase.from("proof_conchas").insert({ usuario_id: usuarioId, temporada: TEMPORADA.id, tipo, valor, detalhe }).select("id").single();
  falhou(error, "conchas");
  return data.id;
}

/** Gasta conchas: lança e confere o saldo depois; se outra aba gastou junto e ficou negativo, desfaz. */
async function gastarConchas(usuarioId, tipo, valor, detalhe = {}) {
  const id = await lancarConchas(usuarioId, tipo, -valor, detalhe);
  if ((await saldoDeConchas(usuarioId)) < 0) {
    await supabase.from("proof_conchas").delete().eq("id", id);
    throw new ErroDeAcesso(409, "as conchas não deram: outra compra usou antes");
  }
  return id;
}

async function tripulacaoDe(usuarioId) {
  const { data, error } = await supabase.from("proof_tripulacoes").select("tripulacao, versao").eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "tripulação");
  if (data) return data;
  const { error: e2 } = await supabase.from("proof_tripulacoes").upsert({ usuario_id: usuarioId, temporada: TEMPORADA.id, tripulacao: {} }, { onConflict: "usuario_id", ignoreDuplicates: true });
  falhou(e2, "tripulação");
  return { tripulacao: {}, versao: 0 };
}

async function gravarTripulacao(usuarioId, versao, tripulacao) {
  const { data, error } = await supabase.from("proof_tripulacoes")
    .update({ tripulacao: contagens(tripulacao), versao: versao + 1, atualizado_em: new Date().toISOString() })
    .eq("usuario_id", usuarioId).eq("versao", versao).select("usuario_id");
  falhou(error, "tripulação");
  if (!data?.length) throw new ErroDeAcesso(409, "a tripulação mudou enquanto você mexia — tente de novo");
}

async function gravarIlha(ilha, mudancas) {
  const { data, error } = await supabase.from("proof_ilhas")
    .update({ ...mudancas, versao: ilha.versao + 1, atualizado_em: new Date().toISOString() })
    .eq("id", ilha.id).eq("versao", ilha.versao).select(CAMPOS);
  falhou(error, "ilha");
  if (!data?.length) throw conflito();
  return data[0];
}

async function pactosDe(usuarioId) {
  const { data, error } = await supabase.from("proof_pactos").select("id, de_id, para_id, criado_em, aceito_em, ate")
    .eq("temporada", TEMPORADA.id).or(`de_id.eq.${usuarioId},para_id.eq.${usuarioId}`).order("criado_em", { ascending: false }).limit(50);
  falhou(error, "pactos");
  return data || [];
}

async function ataquesDeHoje(usuarioId) {
  const { count, error } = await supabase.from("proof_ilha_batalhas").select("id", { count: "exact", head: true }).eq("atacante_id", usuarioId).eq("dia", diaDe());
  falhou(error, "batalhas");
  return count || 0;
}

const temNavio = (reino) => veiculosDe(reino?.veiculos).includes(VEICULO_DAS_ILHAS);

/** Tudo o que a tela do arquipélago precisa. */
export async function estadoDasIlhas(usuarioId) {
  const agora = new Date();
  const reino = await noMundo("real", () => obterReino(usuarioId));
  const [ilhas, conchas, trip, pactos, ataquesHoje, moedas, recentesR] = await Promise.all([
    ilhasDoArquipelago(), saldoDeConchas(usuarioId), tripulacaoDe(usuarioId), pactosDe(usuarioId), ataquesDeHoje(usuarioId),
    noMundo("real", () => saldoDoUsuario(usuarioId)),
    supabase.from("proof_ilha_batalhas").select("id, ilha_id, atacante_id, defensor_id, estrelas, destruicao, desfecho, conchas, moedas, combate, criado_em")
      .eq("temporada", TEMPORADA.id).or(`atacante_id.eq.${usuarioId},defensor_id.eq.${usuarioId}`).order("criado_em", { ascending: false }).limit(10),
  ]);
  falhou(recentesR.error, "batalhas");
  const recentes = recentesR.data || [];
  const nomes = await nomesPublicos([...ilhas.map((i) => i.dono_id), ...pactos.flatMap((p) => [p.de_id, p.para_id]), ...recentes.flatMap((b) => [b.atacante_id, b.defensor_id])]);
  const minhas = ilhas.filter((i) => i.dono_id === usuarioId);
  const navio = temNavio(reino);
  const tripulacao = contagens(trip.tripulacao);
  const nomeDe = (id) => (id === usuarioId ? "você" : nomes.get(id) || "Jogador");

  return {
    temporada: { ...TEMPORADA, aberta: temporadaAberta(diaDe()) },
    regras: { conchasPorMoeda: CONCHAS_POR_MOEDA, pacotes: PACOTES_DE_CONCHAS, ataquesPorDia: ATAQUES_DE_ILHA_POR_DIA, ilhasPorJogador: ILHAS_POR_JOGADOR, diasDoPacto: DIAS_DO_PACTO },
    conchas, moedas, ataquesHoje, temNavio: navio, navio: VEICULOS[VEICULO_DAS_ILHAS],
    ilhas: ilhas.map((i) => {
      const def = ilhaPorId(i.id);
      const minha = i.dono_id === usuarioId;
      const pode = podeAtacarIlha({ usuarioId, ilha: i, temNavio: navio, tripulacao, ataquesHoje, ilhasMinhas: minhas, pactos, agora });
      const juntado = minha ? juntadoNaIlha(i.construcoes, i.coletado_em, agora) : null;
      const defensor = defensorDaIlha(i);
      return {
        id: i.id, nome: def.nome, emoji: def.emoji, x: def.x, y: def.y, nivel: def.nivel, nomeDoNivel: NOMES_DOS_NIVEIS[def.nivel],
        dono: i.dono_id ? { id: i.dono_id, nome: nomeDe(i.dono_id), souEu: minha } : null,
        escudoAte: i.escudo_ate && new Date(i.escudo_ate) > agora ? i.escudo_ate : null,
        defensores: defensor.monstros,
        producao: producaoDaIlha(i.construcoes), juntado,
        construcoes: ORDEM_DA_ILHA.map((chave) => {
          const nivel = i.construcoes?.[chave] || 0;
          const p = minha ? podeConstruirNaIlha({ souDono: true, construcoes: i.construcoes, chave, conchas }) : null;
          return { chave, ...CONSTRUCOES_DA_ILHA[chave], nivel, custo: p?.custo ?? null, pode: Boolean(p?.ok), motivo: p && !p.ok ? p.motivo : "" };
        }),
        // para mostrar a ilha no 3D (o mesmo motor da batalha)
        construcoesDoMotor: defensor.construcoes,
        podeAtacar: pode.ok, motivoDoAtaque: pode.ok ? "" : pode.motivo, semTripulacao: Boolean(pode.semTripulacao),
        pacto: i.dono_id && !minha ? Boolean(pactoVigente(pactos, usuarioId, i.dono_id, agora)) : false,
      };
    }),
    tripulacao: {
      tropas: tripulacao, usado: espacoUsado(tripulacao), capacidade: capacidadeDaTripulacao(minhas), porto: nivelDoPorto(minhas),
      catalogo: ORDEM_DA_TRIPULACAO.map((t) => {
        const um = podeTreinarTripulacao({ tropa: t, quantidade: 1, tripulacao, ilhasMinhas: minhas, conchas });
        const cinco = podeTreinarTripulacao({ tropa: t, quantidade: 5, tripulacao, ilhasMinhas: minhas, conchas });
        return { id: t, ...TROPAS[t], tem: tripulacao[t] || 0, pode1: um.ok, pode5: cinco.ok, motivo: um.ok ? "" : um.motivo };
      }),
    },
    pactos: pactos.map((p) => ({
      id: p.id, comId: p.de_id === usuarioId ? p.para_id : p.de_id, com: nomeDe(p.de_id === usuarioId ? p.para_id : p.de_id),
      euPropus: p.de_id === usuarioId, ate: p.ate, vigente: Boolean(p.aceito_em && new Date(p.ate) > agora), pendente: pactoPendente(p, agora),
    })).filter((p) => p.vigente || p.pendente),
    recentes: recentes.map((b) => ({
      id: b.id, ilha: ilhaPorId(b.ilha_id)?.nome || b.ilha_id, quando: b.criado_em, ataquei: b.atacante_id === usuarioId,
      outro: b.atacante_id === usuarioId ? (b.defensor_id ? nomeDe(b.defensor_id) : "os nativos") : nomeDe(b.atacante_id),
      estrelas: b.estrelas, destruicao: b.destruicao, desfecho: b.desfecho, conchas: b.conchas, moedas: b.moedas, combate: b.combate || null,
    })),
  };
}

// ---------------------------------------------------------------- ações

/** Troca moedas do reino por conchas (10 por moeda), num dos pacotes. */
export async function comprarConchas(usuarioId, moedas) {
  exigirTemporada();
  const valor = Number(moedas);
  if (!PACOTES_DE_CONCHAS.includes(valor)) throw new ErroDeAcesso(400, `escolha um pacote: ${PACOTES_DE_CONCHAS.join(", ")} moedas`);
  await gastarMoedas(usuarioId, "ilhas", valor, { conchas: valor * CONCHAS_POR_MOEDA, compra: true });
  try {
    await lancarConchas(usuarioId, "compra", valor * CONCHAS_POR_MOEDA, { moedas: valor });
  } catch (e) {
    await creditarMoedas(usuarioId, "ilhas", valor, { estorno: true }).catch(() => {});
    throw e;
  }
  return { conchas: valor * CONCHAS_POR_MOEDA, moedas: valor };
}

/** Coleta a produção de todas as suas ilhas: conchas para as ilhas e moedas das pérolas para o reino. */
export async function coletarIlhas(usuarioId) {
  exigirTemporada();
  const agora = new Date();
  const minhas = (await ilhasDoArquipelago()).filter((i) => i.dono_id === usuarioId);
  if (!minhas.length) throw new ErroDeAcesso(400, "você ainda não tem ilha");
  let conchas = 0, moedas = 0;
  for (const ilha of minhas) {
    const j = juntadoNaIlha(ilha.construcoes, ilha.coletado_em, agora);
    if (!j.conchas && !j.moedas) continue;
    try {
      await gravarIlha(ilha, { coletado_em: agora.toISOString() });
    } catch { continue; } // outra aba coletou esta ilha
    if (j.conchas) await lancarConchas(usuarioId, "producao", j.conchas, { ilha: ilha.id });
    if (j.moedas) await creditarMoedas(usuarioId, "ilhas", j.moedas, { ilha: ilha.id, perolas: true });
    conchas += j.conchas;
    moedas += j.moedas;
  }
  if (!conchas && !moedas) throw new ErroDeAcesso(400, "as ilhas ainda não juntaram nada");
  return { conchas, moedas };
}

/** Melhora uma construção da sua ilha, pagando em conchas. */
export async function construirNaIlha(usuarioId, ilhaId, chave) {
  exigirTemporada();
  const ilha = (await ilhasDoArquipelago()).find((i) => i.id === ilhaId);
  if (!ilha) throw new ErroDeAcesso(404, "essa ilha não existe");
  const conchas = await saldoDeConchas(usuarioId);
  const pode = podeConstruirNaIlha({ souDono: ilha.dono_id === usuarioId, construcoes: ilha.construcoes, chave, conchas });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const nivel = (ilha.construcoes?.[chave] || 0) + 1;
  // a produção junta até agora no nível antigo: coleta antes de subir (o nível novo não vale para trás)
  const mexeNaProducao = chave === "mina" || chave === "biblioteca";
  const j = mexeNaProducao ? juntadoNaIlha(ilha.construcoes, ilha.coletado_em) : null;
  const id = await gastarConchas(usuarioId, "construcao", pode.custo, { ilha: ilha.id, chave, nivel });
  try {
    await gravarIlha(ilha, { construcoes: { ...ilha.construcoes, [chave]: nivel }, ...(mexeNaProducao ? { coletado_em: new Date().toISOString() } : {}) });
  } catch (e) {
    await supabase.from("proof_conchas").delete().eq("id", id);
    throw e;
  }
  if (j?.conchas) await lancarConchas(usuarioId, "producao", j.conchas, { ilha: ilha.id, automatica: true });
  if (j?.moedas) await creditarMoedas(usuarioId, "ilhas", j.moedas, { ilha: ilha.id, perolas: true, automatica: true });
  return { ilha: ilha.id, chave, nivel, custo: pode.custo };
}

/** Treina a tripulação (só as tropas das ilhas), pagando em conchas. */
export async function treinarTripulacao(usuarioId, tropa, quantidade) {
  exigirTemporada();
  const [ilhas, conchas, trip] = await Promise.all([ilhasDoArquipelago(), saldoDeConchas(usuarioId), tripulacaoDe(usuarioId)]);
  const minhas = ilhas.filter((i) => i.dono_id === usuarioId);
  const pode = podeTreinarTripulacao({ tropa, quantidade, tripulacao: trip.tripulacao, ilhasMinhas: minhas, conchas });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const id = await gastarConchas(usuarioId, "treino", pode.custo, { tropa, quantidade: pode.quantidade });
  try {
    await gravarTripulacao(usuarioId, trip.versao, somarTropas(trip.tripulacao, { [tropa]: pode.quantidade }));
  } catch (e) {
    await supabase.from("proof_conchas").delete().eq("id", id);
    throw e;
  }
  return { tropa, quantidade: pode.quantidade, custo: pode.custo };
}

/**
 * Ataca uma ilha (dos nativos ou de outro jogador). A batalha é decidida aqui; a tela roda a mesma entrada.
 * Ordem: a conquista grava a ilha primeiro (com a versão: se outra pessoa chegou antes, nada acontece); depois
 * a tripulação perde quem caiu, a batalha fica registrada e os prêmios entram.
 */
export async function atacarIlha(usuarioId, ilhaId) {
  exigirTemporada();
  const agora = new Date();
  const reino = await noMundo("real", () => obterReino(usuarioId));
  const [ilhas, trip, pactos, ataquesHoje] = await Promise.all([ilhasDoArquipelago(), tripulacaoDe(usuarioId), pactosDe(usuarioId), ataquesDeHoje(usuarioId)]);
  const ilha = ilhas.find((i) => i.id === ilhaId);
  const minhas = ilhas.filter((i) => i.dono_id === usuarioId);
  const pode = podeAtacarIlha({ usuarioId, ilha, temNavio: temNavio(reino), tripulacao: trip.tripulacao, ataquesHoje, ilhasMinhas: minhas, pactos, agora });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const r = batalhaNaIlha({ tripulacao: trip.tripulacao, ilha, semente: semente() });
  const desfecho = desfechoNaIlha({ estrelas: r.estrelas, ilha });
  const defensorId = ilha.dono_id || null;

  if (desfecho.tipo === "conquista") {
    await gravarIlha(ilha, {
      dono_id: usuarioId,
      construcoes: defensorId ? construcoesAposConquista(ilha.construcoes) : ilha.construcoes,
      guardas: guardasDaConquista(ilha.id),
      coletado_em: agora.toISOString(), conquistada_em: agora.toISOString(),
      escudo_ate: new Date(agora.getTime() + HORAS_DE_ESCUDO_DA_CONQUISTA * 3_600_000).toISOString(),
    });
  }
  // quem caiu sai da tripulação (quem volta, volta para o navio)
  await gravarTripulacao(usuarioId, trip.versao, somarTropas(trip.tripulacao, r.caidas, -1)).catch(() => {});

  let conchas = desfecho.conchas || 0;
  if (desfecho.tipo === "saque" && defensorId) {
    const doDono = ilhas.filter((i) => i.dono_id === defensorId);
    conchas = saqueDeConchas(await saldoDeConchas(defensorId), protecaoDoBau(doDono));
    if (conchas > 0) await lancarConchas(defensorId, "saque_perdido", -conchas, { ilha: ilha.id, de: usuarioId });
  }
  if (conchas > 0) await lancarConchas(usuarioId, desfecho.tipo === "saque" && defensorId ? "saque_ganho" : "conquista", conchas, { ilha: ilha.id });
  if (desfecho.moedas > 0) await creditarMoedas(usuarioId, "ilhas", desfecho.moedas, { ilha: ilha.id, conquista: true });

  const { data: registro, error } = await supabase.from("proof_ilha_batalhas").insert({
    temporada: TEMPORADA.id, ilha_id: ilha.id, atacante_id: usuarioId, defensor_id: defensorId, dia: diaDe(),
    estrelas: r.estrelas, destruicao: r.destruicao, desfecho: desfecho.tipo, conchas, moedas: desfecho.moedas || 0, combate: r.entrada,
  }).select("id").single();
  falhou(error, "batalha");
  return {
    id: registro.id, ilha: { id: ilha.id, nome: ilhaPorId(ilha.id).nome },
    estrelas: r.estrelas, destruicao: r.destruicao, desfecho: desfecho.tipo, conchas, moedas: desfecho.moedas || 0,
    caidas: r.caidas, combate: r.entrada, contraNativos: !defensorId,
  };
}

/** Propõe um pacto a outro jogador (a única paz das ilhas). */
export async function proporPacto(usuarioId, outroId) {
  exigirTemporada();
  if (!outroId || outroId === usuarioId) throw new ErroDeAcesso(400, "escolha outro jogador");
  const pactos = await pactosDe(usuarioId);
  const agora = new Date();
  if (pactoVigente(pactos, usuarioId, outroId, agora)) throw new ErroDeAcesso(400, "vocês já têm um pacto");
  if (pactos.some((p) => pactoPendente(p, agora) && ((p.de_id === usuarioId && p.para_id === outroId) || (p.de_id === outroId && p.para_id === usuarioId)))) {
    throw new ErroDeAcesso(400, "já existe um pedido de pacto esperando resposta");
  }
  const { data, error } = await supabase.from("proof_pactos").insert({ temporada: TEMPORADA.id, de_id: usuarioId, para_id: outroId }).select("id").single();
  falhou(error, "pacto");
  return { id: data.id };
}

/** Aceita um pacto proposto a você: vale por DIAS_DO_PACTO dias a partir de agora. */
export async function aceitarPacto(usuarioId, pactoId) {
  exigirTemporada();
  const agora = new Date();
  const { data: p, error } = await supabase.from("proof_pactos").select("id, de_id, para_id, criado_em, aceito_em").eq("id", pactoId).maybeSingle();
  falhou(error, "pacto");
  if (!p || p.para_id !== usuarioId) throw new ErroDeAcesso(404, "pedido de pacto não encontrado");
  if (!pactoPendente(p, agora)) throw new ErroDeAcesso(400, "esse pedido já foi respondido ou venceu");
  const ate = new Date(agora.getTime() + DIAS_DO_PACTO * 86_400_000).toISOString();
  const { data, error: e2 } = await supabase.from("proof_pactos").update({ aceito_em: agora.toISOString(), ate }).eq("id", p.id).is("aceito_em", null).select("id");
  falhou(e2, "pacto");
  if (!data?.length) throw new ErroDeAcesso(409, "esse pedido já foi respondido");
  return { ate };
}
