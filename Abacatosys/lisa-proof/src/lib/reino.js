// O Reino do Neuro no banco: ler o reino, gastar moedas, coletar a mina e invadir. As regras
// (custos, força, saque, limites) moram em src/dominio/reino.js; aqui é só o caminho até o banco.
//
// O cuidado com dinheiro em dobro. Não há transação entre várias linhas pelo PostgREST, então
// toda operação que mexe no saldo segue a mesma ordem:
//   1. lê o reino (com a `versao`) e calcula o saldo;
//   2. lança o movimento no livro-caixa;
//   3. grava o reino "onde versao = a que eu li" (e sobe a versao);
//   4. se o passo 3 não pegou linha nenhuma, alguém mexeu antes: apaga o movimento e devolve 409.
// Lançar ANTES de gravar faz qualquer leitura concorrente ver o saldo já descontado; o pior caso
// é ela subestimar o saldo por um instante, nunca gastar o que não existe.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas, buscarEmLotes } from "./estudo.js";
import { diaDe } from "@/dominio/datas.js";
import { nomePublico, textoPublicoValido } from "@/dominio/ranking.js";
import {
  CONSTRUCOES, ORDEM_DAS_CONSTRUCOES, NIVEIS_INICIAIS, ATAQUES_POR_DIA, ESCUDO_DE_NOVATO_HORAS,
  niveisDe, poderDo, podeMelhorar, podeSubirNeuro, producaoAcumulada, producaoPorHora, capacidadeDaMina,
  protecaoDoCofre, temEscudo, podeInvadir, batalha, somarTrofeus, saldoDe, faixaDeDefesa,
  custoDoNeuro, nivelMaximoDoNeuro, estagioDoNeuro, taxaDeProducao, HORAS_ATE_ENCHER,
  HORAS_ENTRE_ATAQUES_AO_MESMO_REINO, batalhaDeExpedicao, exercitoDaExpedicao,
} from "@/dominio/reino.js";
import {
  DIAS_DE_PAZ, FATOR_DA_MINA_NA_ALIANCA, termosDaAlianca, aliancaVigente, convitePendente, outroDa, podeConvidar, podeResponder,
  expiracaoDoConvite, periodoDaAlianca, reforcoDeDefesa, reforcoDeAtaque, juntarComReforco, perdasProprias, caidasNoAtaque,
} from "@/dominio/alianca.js";
import {
  EXPEDICOES, EXPEDICOES_POR_DIA, TIPOS_DE_LUGAR, MONSTROS, DIFICULDADES, expedicaoPorId, podeExpedicionar, contagensDeMonstros,
} from "@/dominio/monstros.js";
import {
  TROPAS, ORDEM_DAS_TROPAS, RESERVAS, contagens, espacoUsado, capacidadeDoExercito, capacidadeDaGuarnicao,
  podeTreinar, somarTropas, heroiNeuro, lotacaoDoAcampamento, totalDeTropas,
} from "@/dominio/tropas.js";
import { PERSONAGENS, ORDEM_DOS_PERSONAGENS, personagensDe, podeEscolherPersonagem } from "@/dominio/personagens.js";

const CAMPOS = "usuario_id, nome, neuro_nivel, construcoes, exercito, guarnicao, personagem, personagens, coletado_em, escudo_ate, trofeus, versao, criado_em";
const HORA = 3_600_000;

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

const conflito = () => new ErroDeAcesso(409, "o reino mudou enquanto você mexia — tente de novo");

/** A semente da batalha: um sorteio de verdade (não Math.random), que decide a luta inteira. */
function semente() {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return n || 1;
}

// ---------------------------------------------------------------- leitura

/** O reino da pessoa; na primeira visita ele nasce, com escudo de novato. */
export async function obterReino(usuarioId) {
  const { data, error } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "reino");
  if (data) return data;

  const novo = await supabase.from("proof_reinos").upsert({
    usuario_id: usuarioId,
    construcoes: NIVEIS_INICIAIS,
    escudo_ate: new Date(Date.now() + ESCUDO_DE_NOVATO_HORAS * HORA).toISOString(),
  }, { onConflict: "usuario_id", ignoreDuplicates: true });
  falhou(novo.error, "criar reino");
  const { data: criado, error: e2 } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).single();
  falhou(e2, "reino");
  return criado;
}

/** Moedas de agora: todos os pontos de estudo (1 ponto = 1 moeda) + o livro-caixa do reino. */
export async function saldoDoUsuario(usuarioId) {
  const [pontos, movimentos] = await Promise.all([
    supabase.from("proof_ranking_total").select("pontos").eq("usuario_id", usuarioId).maybeSingle(),
    buscarTodas(() => supabase.from("proof_reino_movimentos").select("valor").eq("usuario_id", usuarioId).order("criado_em")),
  ]);
  falhou(pontos.error, "pontos");
  return saldoDe({ pontosDeEstudo: pontos.data?.pontos || 0, movimentos });
}

/** Nome público de cada pessoa (apelido ou "Primeiro I."), para quem aparece para os outros. */
export async function nomesPublicos(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const [usuarios, perfis] = await Promise.all([
    buscarEmLotes("abacato_usuarios", "id, nome", "id", unicos),
    buscarEmLotes("proof_perfis", "usuario_id, apelido, no_ranking", "usuario_id", unicos),
  ]);
  const perfil = new Map(perfis.map((p) => [p.usuario_id, p]));
  return new Map(usuarios.map((u) => {
    const p = perfil.get(u.id);
    return [u.id, nomePublico({ nome: u.nome, apelido: p?.apelido, noRanking: p?.no_ranking })];
  }));
}

async function invasoesDeHoje(usuarioId) {
  const { data, error } = await supabase.from("proof_invasoes").select("defensor_id, numero")
    .eq("atacante_id", usuarioId).eq("dia", diaDe());
  falhou(error, "invasões");
  return data || [];
}

/**
 * As invasões das últimas 48 h, para a regra "o mesmo reino só a cada dois dias": as que EU fiz
 * (alvo → último ataque) e as que ME fizeram (atacante → último ataque, para a revanche).
 */
async function invasoesRecentes(usuarioId) {
  const desde = new Date(Date.now() - HORAS_ENTRE_ATAQUES_AO_MESMO_REINO * HORA).toISOString();
  const [minhas, contraMim] = await Promise.all([
    supabase.from("proof_invasoes").select("defensor_id, criado_em").eq("atacante_id", usuarioId).gte("criado_em", desde),
    supabase.from("proof_invasoes").select("atacante_id, criado_em").eq("defensor_id", usuarioId).gte("criado_em", desde),
  ]);
  falhou(minhas.error, "invasões recentes");
  falhou(contraMim.error, "invasões recentes");
  const ultimo = (lista, chave) => {
    const m = new Map();
    for (const i of lista || []) if (!m.has(i[chave]) || i.criado_em > m.get(i[chave])) m.set(i[chave], i.criado_em);
    return m;
  };
  return { ataquei: ultimo(minhas.data, "defensor_id"), meAtacaram: ultimo(contraMim.data, "atacante_id") };
}

// ---------------------------------------------------------------- alianças

const CAMPOS_DA_ALIANCA = "id, de_id, para_id, dias, status, criado_em, expira_em, respondido_em, inicio, fim";

/** As alianças vigentes de várias pessoas: `Map<usuarioId, alianca>`. */
async function aliancasVigentes(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const agora = new Date().toISOString();
  const lista = unicos.join(",");
  const { data, error } = await supabase.from("proof_aliancas").select(CAMPOS_DA_ALIANCA)
    .eq("status", "aceita").gt("fim", agora).or(`de_id.in.(${lista}),para_id.in.(${lista})`);
  falhou(error, "alianças");
  const mapa = new Map();
  for (const a of data || []) { mapa.set(a.de_id, a); mapa.set(a.para_id, a); }
  return mapa;
}
const aliancaDe = async (usuarioId) => (await aliancasVigentes([usuarioId])).get(usuarioId) || null;

/** Os convites que ainda esperam resposta, mandados ou recebidos por `usuarioId`. */
async function convitesPendentes(usuarioId) {
  const { data, error } = await supabase.from("proof_aliancas").select(CAMPOS_DA_ALIANCA)
    .eq("status", "pendente").gt("expira_em", new Date().toISOString()).or(`de_id.eq.${usuarioId},para_id.eq.${usuarioId}`);
  falhou(error, "convites");
  return data || [];
}

/** O reino do aliado como a tela mostra (é ver o reino do outro: construções, tropas, Neuro). */
async function reinoDoAliado(a, usuarioId) {
  const outroId = outroDa(a, usuarioId);
  const { data: outro, error } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", outroId).maybeSingle();
  falhou(error, "reino do aliado");
  if (!outro) return null;
  const nomes = await nomesPublicos([outroId]);
  const n = niveisDe(outro);
  return {
    id: a.id, comId: outroId, dias: a.dias, inicio: a.inicio, ate: a.fim,
    dono: nomes.get(outroId) || "Estudante anônimo", reino: outro.nome,
    vizinho: {
      nome: outro.nome, dono: nomes.get(outroId) || "Estudante anônimo", trofeus: outro.trofeus, neuro: outro.neuro_nivel,
      construcoes: Object.fromEntries(ORDEM_DAS_CONSTRUCOES.map((c) => [c, n[c] || 0])),
      lista: ORDEM_DAS_CONSTRUCOES.filter((c) => (n[c] || 0) > 0).map((c) => ({ chave: c, nome: CONSTRUCOES[c].nome, emoji: CONSTRUCOES[c].emoji, nivel: n[c] })),
      exercito: contagens(outro.exercito), guarnicao: contagens(outro.guarnicao),
    },
    // o que cada um recebe do outro numa invasão
    reforcoDeDefesa: reforcoDeDefesa(outro),
    reforcoDeAtaque: reforcoDeAtaque(outro),
  };
}

/** Os convites como a tela mostra: quem, quantos dias, até quando responder — e os termos. */
async function convitesParaTela(usuarioId) {
  const pendentes = await convitesPendentes(usuarioId);
  const outros = pendentes.map((c) => outroDa(c, usuarioId));
  const [nomes, reinosR] = await Promise.all([
    nomesPublicos(outros),
    outros.length ? supabase.from("proof_reinos").select("usuario_id, nome").in("usuario_id", outros) : { data: [] },
  ]);
  const nomeDoReino = new Map((reinosR.data || []).map((r) => [r.usuario_id, r.nome]));
  const paraTela = (c) => {
    const outro = outroDa(c, usuarioId);
    return { id: c.id, comId: outro, dono: nomes.get(outro) || "Estudante anônimo", reino: nomeDoReino.get(outro) || "Reino", dias: c.dias, expira: c.expira_em, termos: termosDaAlianca(c.dias) };
  };
  return {
    recebidos: pendentes.filter((c) => c.para_id === usuarioId).map(paraTela),
    enviados: pendentes.filter((c) => c.de_id === usuarioId).map(paraTela),
  };
}

/** Convida `paraId` para uma aliança de `dias` dias de paz. */
export async function convidarParaAlianca(usuarioId, paraId, dias) {
  if (!paraId || typeof paraId !== "string") throw new ErroDeAcesso(400, "qual reino?");
  const { data: alvo } = await supabase.from("proof_reinos").select("usuario_id").eq("usuario_id", paraId).maybeSingle();
  const agora = new Date();
  // convites vencidos entre os dois saem do caminho (senão o índice de "um pendente por par" barraria)
  await supabase.from("proof_aliancas").update({ status: "expirada" }).eq("status", "pendente").lt("expira_em", agora.toISOString())
    .or(`and(de_id.eq.${usuarioId},para_id.eq.${paraId}),and(de_id.eq.${paraId},para_id.eq.${usuarioId})`);
  const [vigentes, pendentes] = await Promise.all([aliancasVigentes([usuarioId, paraId]), convitesPendentes(usuarioId)]);
  const pode = podeConvidar({
    deId: usuarioId, paraId: alvo ? paraId : null, dias: Number(dias),
    minhaAlianca: vigentes.get(usuarioId), aliancaDele: vigentes.get(paraId),
    pendenteEntreNos: pendentes.find((c) => outroDa(c, usuarioId) === paraId), agora,
  });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const { error } = await supabase.from("proof_aliancas").insert({ de_id: usuarioId, para_id: paraId, dias: Number(dias), expira_em: expiracaoDoConvite(agora) });
  if (error?.code === "23505") throw new ErroDeAcesso(409, "já tem um convite entre vocês esperando resposta");
  falhou(error, "convite");
  return { convidou: true };
}

/** Aceita ou recusa um convite recebido. */
export async function responderConvite(usuarioId, conviteId, aceitar) {
  const { data: convite, error } = await supabase.from("proof_aliancas").select(CAMPOS_DA_ALIANCA).eq("id", String(conviteId || "")).maybeSingle();
  falhou(error, "convite");
  const agora = new Date();
  const vigentes = convite ? await aliancasVigentes([usuarioId, convite.de_id]) : new Map();
  const pode = podeResponder({ convite, usuarioId, aceitar, minhaAlianca: vigentes.get(usuarioId), aliancaDoOutro: vigentes.get(convite?.de_id), agora });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const mudancas = aceitar
    ? { status: "aceita", respondido_em: agora.toISOString(), ...periodoDaAlianca(convite.dias, agora) }
    : { status: "recusada", respondido_em: agora.toISOString() };
  // só muda se ainda estiver pendente (dois cliques não aceitam duas vezes)
  const { data, error: e2 } = await supabase.from("proof_aliancas").update(mudancas).eq("id", convite.id).eq("status", "pendente").select("id");
  falhou(e2, "convite");
  if (!(data || []).length) throw new ErroDeAcesso(409, "esse convite já foi respondido");
  if (aceitar) {
    // os outros convites pendentes dos dois saem: uma aliança por vez
    await supabase.from("proof_aliancas").update({ status: "cancelada" }).eq("status", "pendente").neq("id", convite.id)
      .or(`de_id.in.(${usuarioId},${convite.de_id}),para_id.in.(${usuarioId},${convite.de_id})`);
  }
  return { aceitou: Boolean(aceitar) };
}

/** Quem convidou desiste do convite (enquanto ninguém respondeu). */
export async function cancelarConvite(usuarioId, conviteId) {
  const { data, error } = await supabase.from("proof_aliancas").update({ status: "cancelada" })
    .eq("id", String(conviteId || "")).eq("de_id", usuarioId).eq("status", "pendente").select("id");
  falhou(error, "convite");
  if (!(data || []).length) throw new ErroDeAcesso(400, "esse convite não está mais esperando resposta");
  return { cancelou: true };
}

/** Tudo o que a tela do reino precisa. */
export async function estadoDoReino(usuarioId) {
  const reino = await obterReino(usuarioId);
  const [saldo, hoje, batalhasR, minhaAlianca, convites] = await Promise.all([
    saldoDoUsuario(usuarioId),
    invasoesDeHoje(usuarioId),
    supabase.from("proof_invasoes")
      .select("id, atacante_id, defensor_id, ataque, defesa, venceu, saque, trofeus_atacante, trofeus_defensor, estrelas, destruicao, combate, criado_em")
      .or(`atacante_id.eq.${usuarioId},defensor_id.eq.${usuarioId}`)
      .order("criado_em", { ascending: false }).limit(15),
    aliancaDe(usuarioId),
    convitesParaTela(usuarioId),
  ]);
  const alianca = minhaAlianca ? await reinoDoAliado(minhaAlianca, usuarioId) : null;
  const fatorDaMina = alianca ? FATOR_DA_MINA_NA_ALIANCA : 1;
  falhou(batalhasR.error, "batalhas");
  const batalhas = batalhasR.data || [];
  const nomes = await nomesPublicos(batalhas.flatMap((b) => [b.atacante_id, b.defensor_id]));

  const agora = new Date();
  const n = niveisDe(reino);
  return {
    nome: reino.nome,
    saldo,
    trofeus: reino.trofeus,
    escudoAte: temEscudo(reino, agora) ? reino.escudo_ate : null,
    poder: poderDo(reino),
    neuro: {
      nivel: reino.neuro_nivel,
      estagio: estagioDoNeuro(reino.neuro_nivel),
      maximo: nivelMaximoDoNeuro(n.castelo),
      custo: custoDoNeuro(reino.neuro_nivel),
      ...podeSubirNeuro(reino, saldo),
    },
    mina: {
      paraColetar: producaoAcumulada(reino, agora, fatorDaMina),
      porHora: taxaDeProducao(n) * fatorDaMina,
      capacidade: taxaDeProducao(n) * fatorDaMina * HORAS_ATE_ENCHER,
      dobrada: fatorDaMina > 1,
    },
    alianca,
    convites,
    diasDePaz: DIAS_DE_PAZ,
    cofre: { protege: protecaoDoCofre(n.cofre) },
    construcoes: ORDEM_DAS_CONSTRUCOES.map((chave) => {
      const def = CONSTRUCOES[chave];
      const nivel = n[chave] || 0;
      const pode = podeMelhorar(reino, chave, saldo);
      return {
        chave, nome: def.nome, emoji: def.emoji, nivel, max: def.max,
        efeitoAtual: nivel > 0 ? def.efeito(nivel) : "ainda não construída",
        efeitoProximo: nivel < def.max ? def.efeito(nivel + 1) : null,
        custo: pode.custo ?? null, pode: pode.ok, motivo: pode.ok ? "" : pode.motivo,
      };
    }),
    invasoes: { feitasHoje: hoje.length, porDia: ATAQUES_POR_DIA },
    lotacao: { usado: espacoUsado(reino.exercito) + espacoUsado(reino.guarnicao), capacidade: lotacaoDoAcampamento(n.acampamento) },
    exercito: reservaParaTela("exercito", reino, n, saldo),
    guarnicao: reservaParaTela("guarnicao", reino, n, saldo),
    heroi: { ataque: heroiNeuro(reino.neuro_nivel, "ataque"), defesa: heroiNeuro(reino.neuro_nivel, "defesa") },
    personagem: PERSONAGENS[reino.personagem] ? reino.personagem : "neuro",
    personagens: ORDEM_DOS_PERSONAGENS.map((id) => {
      const pode = podeEscolherPersonagem({ id, possui: reino.personagens, saldo });
      return { id, ...PERSONAGENS[id], tem: personagensDe(reino.personagens).includes(id), pode: pode.ok, motivo: pode.ok ? "" : pode.motivo };
    }),
    batalhas: batalhas.map((b) => {
      const ataquei = b.atacante_id === usuarioId;
      return {
        id: b.id, quando: b.criado_em, ataquei,
        outro: nomes.get(ataquei ? b.defensor_id : b.atacante_id) || "Estudante anônimo",
        ataque: b.ataque, defesa: b.defesa,
        // "ganhei" do ponto de vista de quem está vendo
        ganhei: ataquei ? b.venceu : !b.venceu,
        moedas: b.saque ? (ataquei ? b.saque : -b.saque) : 0,
        trofeus: ataquei ? b.trofeus_atacante : b.trofeus_defensor,
        estrelas: b.estrelas, destruicao: b.destruicao,
        // a receita da batalha (só as novas têm): a tela roda a mesma simulação e mostra a luta
        combate: b.combate || null,
        resultado: b.combate ? { estrelas: b.estrelas, destruicao: b.destruicao, venceu: b.venceu, saque: b.saque } : null,
      };
    }),
  };
}

/** Exército ou guarnição: o que tem, quanto cabe e o que dá para treinar agora. */
function reservaParaTela(destino, reino, n, saldo) {
  const tropas = contagens(reino[destino]);
  const nivel = destino === "exercito" ? n.quartel : n.castelo;
  const capacidade = destino === "exercito" ? capacidadeDoExercito(nivel) : capacidadeDaGuarnicao(nivel);
  const reservas = { exercito: reino.exercito, guarnicao: reino.guarnicao };
  return {
    tropas, capacidade, usado: espacoUsado(tropas),
    catalogo: ORDEM_DAS_TROPAS.map((chave) => {
      const def = TROPAS[chave];
      const um = podeTreinar({ tropa: chave, quantidade: 1, destino, niveis: n, reservas, saldo });
      const cinco = podeTreinar({ tropa: chave, quantidade: 5, destino, niveis: n, reservas, saldo });
      return {
        chave, nome: def.nome, emoji: def.emoji, espaco: def.espaco, custo: def.custo, vida: def.vida, dano: def.dano,
        intervalo: def.intervalo, alcance: def.alcance, voa: def.voa, acertaAr: def.acertaAr, descricao: def.descricao,
        nivelMinimo: def.nivelMinimo, liberada: nivel >= def.nivelMinimo && (destino === "guarnicao" || nivel > 0),
        tem: tropas[chave] || 0, podeUm: um.ok, podeCinco: cinco.ok, motivo: um.ok ? "" : um.motivo,
      };
    }),
  };
}

// ---------------------------------------------------------------- escrita

async function lancar(usuarioId, tipo, valor, detalhe = {}) {
  const { data, error } = await supabase.from("proof_reino_movimentos")
    .insert({ usuario_id: usuarioId, tipo, valor, detalhe }).select("id").single();
  falhou(error, "livro-caixa");
  return data.id;
}

async function desfazerLancamentos(ids) {
  const vivos = ids.filter(Boolean);
  if (vivos.length) await supabase.from("proof_reino_movimentos").delete().in("id", vivos);
}

/** Grava o reino só se ninguém mexeu desde a leitura. Devolve se gravou. */
async function gravarReino(reino, mudancas) {
  const { data, error } = await supabase.from("proof_reinos")
    .update({ ...mudancas, versao: reino.versao + 1, atualizado_em: new Date().toISOString() })
    .eq("usuario_id", reino.usuario_id).eq("versao", reino.versao)
    .select("usuario_id");
  falhou(error, "gravar reino");
  return (data || []).length === 1;
}

/** Lança, grava; se a gravação perder a corrida, desfaz o lançamento. */
async function lancarEGravar(reino, lancamentos, mudancas) {
  const ids = [];
  try {
    for (const l of lancamentos) ids.push(await lancar(reino.usuario_id, l.tipo, l.valor, l.detalhe));
    if (!(await gravarReino(reino, mudancas))) {
      await desfazerLancamentos(ids);
      throw conflito();
    }
  } catch (e) {
    if (!(e instanceof ErroDeAcesso && e.status === 409)) await desfazerLancamentos(ids);
    throw e;
  }
}

/** Construir ou melhorar uma construção. */
export async function melhorarConstrucao(usuarioId, chave) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeMelhorar(reino, chave, saldo);
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const n = niveisDe(reino);
  const lancamentos = [];
  const mudancas = { construcoes: { ...n, [chave]: (n[chave] || 0) + 1 } };
  // A mina melhorada produz mais por hora: o que ela já tinha juntado é coletado antes, para o
  // nível novo não valer para trás.
  if (chave === "mina" || chave === "biblioteca") {
    const juntado = producaoAcumulada(reino);
    if (juntado > 0) lancamentos.push({ tipo: "coleta", valor: juntado, detalhe: { automatica: true } });
    mudancas.coletado_em = new Date().toISOString();
  }
  lancamentos.push({ tipo: "construcao", valor: -pode.custo, detalhe: { chave, nivel: mudancas.construcoes[chave] } });
  await lancarEGravar(reino, lancamentos, mudancas);
  return { chave, nivel: mudancas.construcoes[chave], custo: pode.custo };
}

export async function subirNeuro(usuarioId) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeSubirNeuro(reino, saldo);
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const nivel = reino.neuro_nivel + 1;
  await lancarEGravar(reino, [{ tipo: "neuro", valor: -pode.custo, detalhe: { nivel } }], { neuro_nivel: nivel });
  return { nivel, custo: pode.custo, estagio: estagioDoNeuro(nivel) };
}

/** Treinar tropas para o exército (Quartel) ou para a guarnição (Torre do Neuro). */
export async function treinarTropas(usuarioId, { tropa, quantidade, destino }) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const n = niveisDe(reino);
  const pode = podeTreinar({ tropa, quantidade, destino, niveis: n, reservas: { exercito: reino.exercito, guarnicao: reino.guarnicao }, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const nova = somarTropas(reino[destino], { [tropa]: pode.quantidade });
  await lancarEGravar(reino, [{ tipo: "treino", valor: -pode.custo, detalhe: { tropa, quantidade: pode.quantidade, destino } }], { [destino]: nova });
  return { tropa, quantidade: pode.quantidade, destino: RESERVAS[destino], custo: pode.custo };
}

/** Vestir um personagem que já é seu, ou comprar (com moedas) e vestir. */
export async function escolherPersonagem(usuarioId, id) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeEscolherPersonagem({ id, possui: reino.personagens, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const mudancas = { personagem: id, personagens: personagensDe([...(reino.personagens || []), id]) };
  const lancamentos = pode.compra ? [{ tipo: "personagem", valor: -pode.custo, detalhe: { personagem: id } }] : [];
  await lancarEGravar(reino, lancamentos, mudancas);
  return { personagem: id, comprou: pode.compra, custo: pode.custo, nome: PERSONAGENS[id].nome };
}

/** Só ler qual personagem a pessoa usa (sem criar reino para quem ainda não abriu o Reino). */
export async function personagemDe(usuarioId) {
  const { data } = await supabase.from("proof_reinos").select("personagem").eq("usuario_id", usuarioId).maybeSingle();
  return PERSONAGENS[data?.personagem] ? data.personagem : "neuro";
}

export async function coletarMina(usuarioId) {
  const reino = await obterReino(usuarioId);
  const agora = new Date();
  const valor = producaoAcumulada(reino, agora, (await aliancaDe(usuarioId)) ? FATOR_DA_MINA_NA_ALIANCA : 1);
  if (valor <= 0) throw new ErroDeAcesso(400, "a mina ainda não juntou nenhuma moeda inteira");
  await lancarEGravar(reino, [{ tipo: "coleta", valor }], { coletado_em: agora.toISOString() });
  return { coletou: valor };
}

export async function renomearReino(usuarioId, nome) {
  const r = textoPublicoValido(nome, { min: 3, max: 30, rotulo: "o nome do reino" });
  if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
  if (!r.texto) throw new ErroDeAcesso(400, "dê um nome ao reino");
  const reino = await obterReino(usuarioId);
  if (!(await gravarReino(reino, { nome: r.texto }))) throw conflito();
  return { nome: r.texto };
}

// ---------------------------------------------------------------- invasões

/**
 * Os reinos que dá para invadir: os de troféus mais perto dos meus primeiro (a disputa justa
 * aparece no topo). A defesa aparece em faixa — o número exato só se descobre na batalha.
 */
export async function alvosDe(usuarioId) {
  const eu = await obterReino(usuarioId);
  const [todos, hoje, recentes, pendentes] = await Promise.all([
    buscarTodas(() => supabase.from("proof_reinos").select(CAMPOS).neq("usuario_id", usuarioId).order("usuario_id")),
    invasoesDeHoje(usuarioId),
    invasoesRecentes(usuarioId),
    convitesPendentes(usuarioId),
  ]);
  const jaAtaquei = new Set(hoje.map((i) => i.defensor_id));
  const perto = todos
    .sort((a, b) => Math.abs(a.trofeus - eu.trofeus) - Math.abs(b.trofeus - eu.trofeus))
    .slice(0, 30);
  const [nomes, vigentes] = await Promise.all([nomesPublicos(perto.map((r) => r.usuario_id)), aliancasVigentes([usuarioId, ...perto.map((r) => r.usuario_id)])]);
  const minha = vigentes.get(usuarioId) || null;
  const agora = new Date();
  return {
    invasoes: { feitasHoje: hoje.length, porDia: ATAQUES_POR_DIA },
    meuAtaque: poderDo(eu).ataque,
    horasEntreAtaques: HORAS_ENTRE_ATAQUES_AO_MESMO_REINO,
    alvos: perto.map((r) => {
      const pode = podeInvadir({
        atacanteId: usuarioId, atacante: eu, defensor: r, ataquesHoje: hoje.length, jaAtacouHoje: jaAtaquei.has(r.usuario_id),
        ultimoAtaqueAoAlvo: recentes.ataquei.get(r.usuario_id) || null, agora,
        aliados: Boolean(minha && outroDa(minha, usuarioId) === r.usuario_id),
      });
      const convite = podeConvidar({
        deId: usuarioId, paraId: r.usuario_id, minhaAlianca: minha, aliancaDele: vigentes.get(r.usuario_id),
        pendenteEntreNos: pendentes.find((c) => outroDa(c, usuarioId) === r.usuario_id), agora,
      });
      return {
        id: r.usuario_id,
        dono: nomes.get(r.usuario_id) || "Estudante anônimo",
        reino: r.nome,
        torre: niveisDe(r).castelo,
        neuro: r.neuro_nivel,
        trofeus: r.trofeus,
        defesa: faixaDeDefesa(poderDo(r).defesa),
        escudoAte: temEscudo(r, agora) ? r.escudo_ate : null,
        pode: pode.ok,
        motivo: pode.ok ? "" : pode.motivo,
        liberaEm: pode.liberaEm || null,
        // me atacou nas últimas 48 h: dá para revidar (a conta das 48 h é de cada lado)
        revanche: recentes.meAtacaram.has(r.usuario_id),
        aliado: Boolean(minha && outroDa(minha, usuarioId) === r.usuario_id),
        podeConvidar: convite.ok,
        motivoDoConvite: convite.ok ? "" : convite.motivo,
      };
    }),
  };
}

export async function invadir(usuarioId, defensorId) {
  if (!defensorId || typeof defensorId !== "string") throw new ErroDeAcesso(400, "qual reino?");
  const eu = await obterReino(usuarioId);
  const { data: alvo, error } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", defensorId).maybeSingle();
  falhou(error, "reino do alvo");
  const [hoje, saldoDoAlvo, recentes, vigentes] = await Promise.all([
    invasoesDeHoje(usuarioId), alvo ? saldoDoUsuario(defensorId) : 0, invasoesRecentes(usuarioId), aliancasVigentes([usuarioId, defensorId]),
  ]);
  const minha = vigentes.get(usuarioId) || null;
  const dele = vigentes.get(defensorId) || null;

  const pode = podeInvadir({
    atacanteId: usuarioId, atacante: eu, defensor: alvo, ataquesHoje: hoje.length,
    jaAtacouHoje: hoje.some((i) => i.defensor_id === defensorId),
    ultimoAtaqueAoAlvo: recentes.ataquei.get(defensorId) || null,
    aliados: Boolean(minha && outroDa(minha, usuarioId) === defensorId),
  });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  // a ajuda dos aliados: o meu manda reforço de ataque; o do defensor, reforço de defesa
  const lerReino = async (id) => (id ? (await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", id).maybeSingle()).data : null);
  const [meuAliado, aliadoDele] = await Promise.all([lerReino(minha && outroDa(minha, usuarioId)), lerReino(dele && outroDa(dele, defensorId))]);
  const reforcoAtaque = meuAliado ? reforcoDeAtaque(meuAliado) : {};
  const reforcoDefesa = aliadoDele ? reforcoDeDefesa(aliadoDele) : {};

  const exercitoUsado = contagens(eu.exercito);
  const exercitoNaBatalha = juntarComReforco(exercitoUsado, reforcoAtaque);
  const guarnicaoNaBatalha = juntarComReforco(alvo.guarnicao, reforcoDefesa);
  const r = batalha({ atacante: { exercito: exercitoNaBatalha, neuro_nivel: eu.neuro_nivel }, defensor: { ...alvo, guarnicao: guarnicaoNaBatalha }, saldoDoDefensor: saldoDoAlvo, semente: semente() });
  r.entrada.reforcos = { ataque: reforcoAtaque, defesa: reforcoDefesa }; // só para a tela: o motor não lê
  const forca = { ataque: poderDo({ ...eu, exercito: exercitoNaBatalha }).ataque, defesa: poderDo({ ...alvo, guarnicao: guarnicaoNaBatalha }).defesa };
  // só quem cai se perde — e das tropas que caíram, só a parte de cada um (o reforço não custa nada)
  const minhasPerdas = perdasProprias(exercitoUsado, reforcoAtaque, caidasNoAtaque(exercitoNaBatalha, r.sobreviventes));
  const perdasDaGuarnicao = perdasProprias(alvo.guarnicao, reforcoDefesa, r.perdasDaGuarnicao);

  // 1. a invasão em si — os índices únicos barram a 4ª do dia e a 2ª no mesmo alvo
  const ins = await supabase.from("proof_invasoes").insert({
    atacante_id: usuarioId, defensor_id: defensorId, dia: diaDe(), numero: hoje.length + 1,
    ataque: forca.ataque, defesa: forca.defesa, venceu: r.venceu, saque: r.saque,
    trofeus_atacante: r.trofeusAtacante, trofeus_defensor: r.trofeusDefensor,
    estrelas: r.estrelas, destruicao: r.destruicao, combate: r.entrada,
  }).select("id").single();
  if (ins.error?.code === "23505") throw new ErroDeAcesso(409, "essa invasão já foi feita — atualize a tela");
  falhou(ins.error, "invasão");
  const invasaoId = ins.data.id;

  // 2. o saque, dos dois lados, e o reino do defensor (troféus e escudo) com a trava de versão
  const ids = [];
  try {
    if (r.saque > 0) {
      ids.push(await lancar(defensorId, "saque_perdido", -r.saque, { invasao: invasaoId }));
      ids.push(await lancar(usuarioId, "saque_ganho", r.saque, { invasao: invasaoId }));
    }
    // a guarnição que caiu precisa ser treinada de novo
    const mudancasDoAlvo = { trofeus: somarTrofeus(alvo.trofeus, r.trofeusDefensor), guarnicao: somarTropas(alvo.guarnicao, perdasDaGuarnicao, -1) };
    if (r.escudoDoDefensorHoras) mudancasDoAlvo.escudo_ate = new Date(Date.now() + r.escudoDoDefensorHoras * HORA).toISOString();
    if (!(await gravarReino(alvo, mudancasDoAlvo))) throw conflito();
  } catch (e) {
    await desfazerLancamentos(ids);
    await supabase.from("proof_invasoes").delete().eq("id", invasaoId);
    throw e;
  }

  // 3. o meu reino: troféus, o fim do meu escudo (quem ataca perde a proteção) e o exército: só as
  // tropas que caíram saem (as que sobreviveram voltam para casa). Sem dinheiro em jogo: em vez de
  // desfazer, tenta de novo com o reino relido.
  let atual = eu;
  for (let i = 0; i < 4; i++) {
    const mudancas = { trofeus: somarTrofeus(atual.trofeus, r.trofeusAtacante), escudo_ate: null, exercito: somarTropas(atual.exercito, minhasPerdas, -1) };
    if (await gravarReino(atual, mudancas)) break;
    atual = await obterReino(usuarioId);
  }

  const nomes = await nomesPublicos([defensorId]);
  return {
    venceu: r.venceu, estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque,
    trofeus: r.trofeusAtacante, protegido: r.protegido, destruidos: r.destruidos,
    combate: r.entrada, perdas: minhasPerdas, voltaram: somarTropas(exercitoUsado, minhasPerdas, -1),
    reforcos: { ataque: reforcoAtaque, defesa: reforcoDefesa },
    alvo: { dono: nomes.get(defensorId) || "Estudante anônimo", reino: alvo.nome },
  };
}

// ---------------------------------------------------------------- expedições (contra a CPU)

async function expedicoesDeHoje(usuarioId) {
  const { data, error } = await supabase.from("proof_expedicoes").select("expedicao, numero").eq("usuario_id", usuarioId).eq("dia", diaDe());
  falhou(error, "expedições");
  return data || [];
}

/** O mapa das expedições: o que está liberado, quantas vezes cada lugar foi feito hoje e as melhores estrelas. */
export async function expedicoesDe(usuarioId) {
  const eu = await obterReino(usuarioId);
  const [hoje, historico] = await Promise.all([
    expedicoesDeHoje(usuarioId),
    supabase.from("proof_expedicoes").select("id, expedicao, estrelas, destruicao, saque, combate, criado_em")
      .eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(300),
  ]);
  falhou(historico.error, "expedições");
  const todas = historico.data || [];
  const melhor = new Map();
  for (const x of todas) melhor.set(x.expedicao, Math.max(melhor.get(x.expedicao) || 0, x.estrelas));
  const vezesHoje = new Map();
  for (const x of hoje) vezesHoje.set(x.expedicao, (vezesHoje.get(x.expedicao) || 0) + 1);
  const torre = niveisDe(eu).castelo;
  const tropa = exercitoDaExpedicao(eu.exercito, torre);
  return {
    expedicoes: { feitasHoje: hoje.length, porDia: EXPEDICOES_POR_DIA },
    // com que exército a pessoa parte: o dela, ou a Tropa da Expedição (emprestada, de graça)
    tropa: { emprestada: tropa.emprestado, tropas: tropa.exercito },
    lugares: EXPEDICOES.map((x) => {
      const pode = podeExpedicionar({ expedicao: x, nivelDaTorre: torre, feitasHoje: hoje.length });
      return {
        id: x.id, nome: x.nome, tipo: x.tipo, lugar: TIPOS_DE_LUGAR[x.tipo].nome, emoji: TIPOS_DE_LUGAR[x.tipo].emoji,
        descricao: x.descricao, torreMinima: x.torreMinima, recompensa: x.recompensa, chefe: x.chefe,
        dificuldade: x.dificuldade, nomeDaDificuldade: DIFICULDADES[x.dificuldade]?.nome || "",
        monstros: Object.entries(contagensDeMonstros(x.monstros)).map(([tipo, quantidade]) => ({ tipo, nome: MONSTROS[tipo].nome, quantidade })),
        melhorEstrelas: melhor.get(x.id) || 0,
        vezesHoje: vezesHoje.get(x.id) || 0,
        liberada: torre >= x.torreMinima,
        pode: pode.ok,
        motivo: pode.ok ? "" : pode.motivo,
      };
    }),
    recentes: todas.slice(0, 6).map((x) => ({
      id: x.id, expedicao: x.expedicao, nome: expedicaoPorId(x.expedicao)?.nome || x.expedicao, quando: x.criado_em,
      estrelas: x.estrelas, destruicao: x.destruicao, saque: x.saque, combate: x.combate || null,
      resultado: { estrelas: x.estrelas, destruicao: x.destruicao, saque: x.saque, venceu: x.estrelas > 0 },
    })),
  };
}

/**
 * Parte numa expedição. Como na invasão, o resultado é decidido aqui (com um sorteio de verdade)
 * e a tela roda a mesma simulação para mostrar a luta. Ordem: registra a expedição (o índice único
 * barra a 4ª do dia) e lança o saque. O exército não muda: expedição não gasta tropa nem moeda.
 */
export async function atacarExpedicao(usuarioId, expedicaoId) {
  const expedicao = expedicaoPorId(String(expedicaoId || ""));
  if (!expedicao) throw new ErroDeAcesso(400, "essa expedição não existe");
  const eu = await obterReino(usuarioId);
  const hoje = await expedicoesDeHoje(usuarioId);
  const torre = niveisDe(eu).castelo;
  const pode = podeExpedicionar({ expedicao, nivelDaTorre: torre, feitasHoje: hoje.length });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const tropa = exercitoDaExpedicao(eu.exercito, torre);
  const r = batalhaDeExpedicao({ atacante: { exercito: tropa.exercito, neuro_nivel: eu.neuro_nivel }, expedicao, semente: semente() });

  const ins = await supabase.from("proof_expedicoes").insert({
    usuario_id: usuarioId, expedicao: expedicao.id, dia: diaDe(), numero: hoje.length + 1,
    estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque, perdas: r.caidas, combate: r.entrada,
  }).select("id").single();
  if (ins.error?.code === "23505") throw new ErroDeAcesso(409, "essa expedição já foi feita — atualize a tela");
  falhou(ins.error, "expedição");

  try {
    if (r.saque > 0) await lancar(usuarioId, "expedicao", r.saque, { expedicao: expedicao.id, registro: ins.data.id });
  } catch (e) {
    await supabase.from("proof_expedicoes").delete().eq("id", ins.data.id);
    throw e;
  }

  return {
    venceu: r.venceu, estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque,
    caidas: r.caidas, combate: r.entrada, emprestado: tropa.emprestado,
    expedicao: { id: expedicao.id, nome: expedicao.nome, tipo: expedicao.tipo, chefe: expedicao.chefe, dificuldade: expedicao.dificuldade },
  };
}
