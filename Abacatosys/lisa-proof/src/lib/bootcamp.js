// O Modo Bootcamp no banco (04/11/2026). As regras moram em src/dominio/bootcamp.js; as tabelas são
// proof_bootcamp_torneios, proof_bootcamp_rodadas e proof_bootcamp_entregas (db/032); a IA dos jurados, em
// src/lib/iaBootcamp.js.
//
// O ciclo de uma rodada: o organizador abre (os jurados lançam o desafio, e a solução de referência roda contra
// os testes antes de a rodada abrir) → cada humano anda pelo fluxo do exercício (leitura → análise → ambiente →
// código → testes → revisão) e os testes rodam no Wandbox, um compilador on-line (o código de ninguém roda no
// nosso servidor) → os jurados avaliam (uma vez só: a rodada passa por 'avaliando', que é a trava) → mata-mata
// elimina quem perdeu o confronto; pontos corridos soma a nota. Os personagens da Lisa jogam pela simulação, com
// o sorteio preso à rodada: a mesma rodada sempre dá o mesmo resultado para o mesmo personagem.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { destinatarios } from "./correio.js";
import { nomesPublicos } from "./reino.js";
import { lerArquivoDoRepo, lerEnderecoDoRepo, ErroDoGitHub } from "./github.js";
import { temModelo } from "./ia.js";
import { gerarDesafioDosJurados, avaliarComOsJurados } from "./iaBootcamp.js";
import { prepararParaCompilador, resultadoDoServidor } from "@/dominio/execucao.js";
import { sorteio } from "@/dominio/bolsa.js";
import { sementeDe } from "@/dominio/modoDominio.js";
import {
  BOOTCAMP, FORMATOS, JURADOS, LINGUAGENS_DO_BOOTCAMP, ORDEM_DAS_LINGUAGENS, NPCS_DO_BOOTCAMP, ETAPAS_DO_FLUXO, MODELOS_DE_CODIGO,
  npcPorId, chaveDaLinguagem, caminhoPadrao, avancarNoFluxo, validarConfiguracao, totalDeRodadas, dificuldadeDaRodada,
  montarParticipantes, npcsDisponiveis, confrontosDaRodada, prazoDaRodada, prazoPassou, normalizarSaida, conferirCaso,
  resumoDosTestes, validarDesafio, desafioParaTela, testesParaTela, desafioDeReserva, simularNpc, etapaDoNpc,
  notasDoNpc, notaDaRodada, avaliacaoAutomatica, aplicarResultado, classificacao, podeChamarJurados,
} from "@/dominio/bootcamp.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const ehUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
const CAMPOS_T = "id, dono_id, nome, formato, tempo_min, linguagens, rodadas_total, participantes, humanos, rodada_atual, status, campeao, criado_em, atualizado_em, encerrado_em";
const CAMPOS_R = "id, torneio_id, numero, desafio, confrontos, status, avaliacao, aberta_em, prazo, avaliada_em";
const CAMPOS_E = "id, rodada_id, torneio_id, usuario_id, etapa, plano, modo, linguagem, repo, caminho, codigo, commit_sha, testes, passou, tentativas, enviada_em, atualizado_em";
const ABERTOS_POR_ORGANIZADOR = 5;

// ------------------------------------------------------------------ os testes no compilador on-line

const WANDBOX = "https://wandbox.org/api/compile.json";

// Freio de boa-fé por pessoa, na memória de cada instância do Worker (como o do Rodar): conta cada caso de teste,
// para não martelar o serviço gratuito dos outros. 60 casos a cada 10 minutos ≈ 10 rodadas de testes.
const usos = new Map();
function frear(usuarioId, casos) {
  const agora = Date.now();
  const recentes = (usos.get(usuarioId) || []).filter((t) => agora - t < 10 * 60_000);
  if (recentes.length + casos > 60) throw new ErroDeAcesso(429, "muitos testes seguidos — espere alguns minutos e rode de novo");
  for (let i = 0; i < casos; i++) recentes.push(agora);
  usos.set(usuarioId, recentes);
}

async function rodarUmCaso(chave, codigo, entrada) {
  const ling = LINGUAGENS_DO_BOOTCAMP[chave];
  if (!ling) throw new ErroDeAcesso(400, "esta linguagem não roda no Bootcamp");
  let resposta;
  try {
    resposta = await fetch(WANDBOX, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compiler: ling.compilador, code: prepararParaCompilador(chave, codigo), stdin: entrada }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ErroDeAcesso(504, "o compilador on-line demorou demais para responder — o código tem um laço que não termina? Tente de novo");
  }
  if (!resposta.ok) throw new ErroDeAcesso(502, `o compilador on-line respondeu ${resposta.status} — tente de novo daqui a pouco`);
  const j = await resposta.json().catch(() => null);
  if (!j) throw new ErroDeAcesso(502, "o compilador on-line devolveu uma resposta que não deu para ler");
  return resultadoDoServidor(j);
}

const paraResultado = (t, r) => ({
  oculto: t.oculto,
  ok: !r.falhouNaCompilacao && conferirCaso(t.saida, r.saida),
  entrada: t.entrada,
  esperada: t.saida,
  obtida: normalizarSaida(r.saida).slice(0, BOOTCAMP.limites.saida),
  erro: String(r.compilacao || r.erro || (r.sinal ? `o programa foi interrompido (${r.sinal})` : "")).slice(0, 1500),
});

/** Roda o código em todos os testes. O primeiro vai sozinho: se não compila, os outros nem saem. */
async function rodarTestes(chave, codigo, testes) {
  const primeiro = await rodarUmCaso(chave, codigo, testes[0].entrada);
  const resultados = [paraResultado(testes[0], primeiro)];
  if (primeiro.falhouNaCompilacao) {
    return testes.map((t, i) => (i === 0 ? resultados[0] : { oculto: t.oculto, ok: false, entrada: t.entrada, esperada: t.saida, obtida: "", erro: "não compilou" }));
  }
  const resto = await Promise.all(testes.slice(1).map((t) => rodarUmCaso(chave, codigo, t.entrada)));
  return [...resultados, ...resto.map((r, i) => paraResultado(testes[i + 1], r))];
}

// ------------------------------------------------------------------ leituras

async function lerTorneio(usuarioId, id) {
  if (!ehUuid(id)) throw new ErroDeAcesso(404, "torneio não encontrado");
  const { data, error } = await supabase.from("proof_bootcamp_torneios").select(CAMPOS_T).eq("id", id).maybeSingle();
  falhou(error, "torneio");
  if (!data || !(data.humanos || []).includes(usuarioId)) throw new ErroDeAcesso(404, "torneio não encontrado");
  return data;
}

async function lerRodada(torneio, numero = torneio.rodada_atual) {
  if (!numero) return null;
  const { data, error } = await supabase.from("proof_bootcamp_rodadas").select(CAMPOS_R).eq("torneio_id", torneio.id).eq("numero", numero).maybeSingle();
  falhou(error, "rodada");
  return data;
}

async function lerEntregas(rodadaId) {
  const { data, error } = await supabase.from("proof_bootcamp_entregas").select(CAMPOS_E).eq("rodada_id", rodadaId);
  falhou(error, "entregas");
  return data || [];
}

const meuId = (usuarioId) => `h:${usuarioId}`;
const ativos = (t) => t.participantes.filter((p) => !p.eliminado);
const humanosAtivos = (t) => ativos(t).filter((p) => p.tipo === "humano");

/** O que o personagem da Lisa fez nesta rodada (sempre o mesmo resultado para a mesma rodada). */
function simulacaoDo(p, rodada, tempoMin) {
  const npc = npcPorId(p.npcId);
  if (!npc) return null;
  return simularNpc({ npc, dificuldade: rodada.desafio.dificuldade, testes: rodada.desafio.testes, tempoMin, s: sorteio(sementeDe(`${rodada.id}:${p.npcId}`)) });
}

function linguagensDoTorneio(t) {
  const permitidas = t.linguagens?.permitidas?.length ? t.linguagens.permitidas : ORDEM_DAS_LINGUAGENS;
  return permitidas.map((chave) => ({ chave, rotulo: LINGUAGENS_DO_BOOTCAMP[chave]?.rotulo || chave, modelo: MODELOS_DE_CODIGO[chave] || "" }));
}

function urlDoCommit(repo, sha) {
  const alvo = repo && sha ? lerEnderecoDoRepo(repo) : null;
  return alvo ? `https://github.com/${alvo.dono}/${alvo.repo}/commit/${sha}` : null;
}

function entregaParaTela(e) {
  if (!e) return null;
  const resumo = resumoDosTestes(e.testes);
  return {
    etapa: e.etapa, plano: e.plano || "", modo: e.modo, linguagem: e.linguagem, repo: e.repo || "", caminho: e.caminho || "",
    codigo: e.codigo || "", commitSha: e.commit_sha || null, urlDoCommit: urlDoCommit(e.repo, e.commit_sha),
    testes: testesParaTela(e.testes), resumo: { total: resumo.total, passados: resumo.passados, passou: resumo.passou },
    passou: e.passou, tentativas: e.tentativas, enviadaEm: e.enviada_em,
  };
}

const resumoDoTorneio = (usuarioId) => (t) => {
  const campeao = t.participantes.find((p) => p.id === t.campeao);
  return {
    id: t.id, nome: t.nome, formato: t.formato, formatoNome: FORMATOS[t.formato]?.nome, status: t.status, tempoMin: t.tempo_min,
    rodadaAtual: t.rodada_atual, rodadasTotal: t.rodadas_total, participantes: t.participantes.length,
    humanos: t.participantes.filter((p) => p.tipo === "humano").length, souDono: t.dono_id === usuarioId,
    campeao: campeao ? { id: campeao.id, nome: campeao.nome, skin: campeao.skin, souEu: campeao.id === meuId(usuarioId) } : null,
    eu: t.participantes.find((p) => p.id === meuId(usuarioId)) || null, criadoEm: t.criado_em,
  };
};

async function personagensDos(ids) {
  const { data, error } = await supabase.from("proof_reinos").select("usuario_id, personagem").in("usuario_id", ids);
  falhou(error, "personagens");
  return new Map((data || []).map((r) => [r.usuario_id, r.personagem]));
}

async function convidaveis(usuarioId) {
  return (await destinatarios(usuarioId)).filter((d) => !d.robo);
}

/** A lista de torneios da pessoa e tudo o que a tela de criação precisa. */
export async function bootcampDe(usuarioId) {
  const [{ data, error }, jogadores, personagens] = await Promise.all([
    supabase.from("proof_bootcamp_torneios").select(CAMPOS_T).contains("humanos", [usuarioId]).order("criado_em", { ascending: false }).limit(30),
    convidaveis(usuarioId),
    personagensDos([usuarioId]),
  ]);
  falhou(error, "torneios");
  const meuPersonagem = personagens.get(usuarioId) || "neuro";
  return {
    torneios: (data || []).map(resumoDoTorneio(usuarioId)),
    opcoes: {
      limites: { min: BOOTCAMP.minParticipantes, max: BOOTCAMP.maxParticipantes },
      formatos: BOOTCAMP.formatos.map((id) => ({ id, ...FORMATOS[id] })),
      tempos: BOOTCAMP.tempos.filter(Boolean),
      rodadasDosPontosCorridos: BOOTCAMP.rodadasDosPontosCorridos,
      linguagens: ORDEM_DAS_LINGUAGENS.map((chave) => ({ chave, rotulo: LINGUAGENS_DO_BOOTCAMP[chave].rotulo })),
      npcs: NPCS_DO_BOOTCAMP.map((n) => ({ id: n.id, nome: n.nome, skin: n.skin, personalidade: n.personalidade, bordao: n.bordao, disponivel: npcsDisponiveis([meuPersonagem]).includes(n) })),
      jurados: JURADOS,
      jogadores,
      meuPersonagem,
    },
  };
}

/** O torneio inteiro para a arena: participantes com a etapa de cada um, a rodada, a minha entrega e o que dá para fazer. */
export async function torneioParaTela(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  const rodada = await lerRodada(t);
  const entregas = rodada ? await lerEntregas(rodada.id) : [];
  const porUsuario = new Map(entregas.map((e) => [e.usuario_id, e]));
  const agora = Date.now();
  const minutos = rodada ? (agora - new Date(rodada.aberta_em).getTime()) / 60_000 : 0;
  const aberta = rodada?.status === "aberta";
  const avaliacao = new Map((rodada?.avaliacao?.participantes || []).map((a) => [a.id, a]));

  const participantes = t.participantes.map((p) => {
    const base = { ...p, souEu: p.id === meuId(usuarioId), compete: Boolean(rodada) && !p.eliminado };
    // quem saiu numa rodada anterior não tem etapa nesta
    if (!rodada || (p.eliminado && p.eliminadoNa !== rodada.numero)) return { ...base, etapa: null, enviada: false, testes: null };
    if (p.tipo === "npc") {
      const sim = simulacaoDo(p, rodada, t.tempo_min);
      const etapa = aberta ? etapaDoNpc(sim, minutos) : "fim";
      const enviada = !aberta || etapa === "revisao";
      return { ...base, etapa, enviada, testes: enviada ? { passados: sim.passados, total: sim.total } : null, nota: avaliacao.get(p.id)?.nota ?? null };
    }
    const e = porUsuario.get(p.usuarioId);
    const r = resumoDosTestes(e?.testes);
    return { ...base, etapa: aberta ? e?.etapa || "leitura" : "fim", enviada: Boolean(e?.enviada_em), testes: r.total ? { passados: r.passados, total: r.total } : null, nota: avaliacao.get(p.id)?.nota ?? null };
  });

  const souDono = t.dono_id === usuarioId;
  const eu = t.participantes.find((p) => p.id === meuId(usuarioId));
  const tempoAcabou = Boolean(aberta && prazoPassou(rodada.prazo, agora));
  const todosEnviaram = Boolean(aberta) && humanosAtivos(t).every((h) => porUsuario.get(h.usuarioId)?.enviada_em);
  const jurados = aberta ? podeChamarJurados({ souDono, todosEnviaram, tempoAcabou }) : { ok: false, motivo: "" };
  const nomes = new Map(t.participantes.map((p) => [p.id, p.nome]));

  return {
    torneio: {
      ...resumoDoTorneio(usuarioId)(t), linguagens: t.linguagens, linguagensDisponiveis: linguagensDoTorneio(t),
      formatoDescricao: FORMATOS[t.formato]?.descricao, campeaoId: t.campeao,
    },
    participantes,
    jurados: JURADOS,
    fluxo: ETAPAS_DO_FLUXO,
    rodada: rodada ? {
      numero: rodada.numero, status: rodada.status, abertaEm: rodada.aberta_em, prazo: rodada.prazo, avaliadaEm: rodada.avaliada_em,
      desafio: desafioParaTela(rodada.desafio),
      confrontos: (rodada.confrontos || []).map((c) => ({ a: c.a, b: c.b, nomeA: nomes.get(c.a), nomeB: c.b ? nomes.get(c.b) : null })),
      avaliacao: rodada.status === "avaliada" ? { comentarioGeral: rodada.avaliacao?.comentarioGeral || "", eliminados: rodada.avaliacao?.eliminados || [], campeao: rodada.avaliacao?.campeao || null } : null,
    } : null,
    minhaEntrega: eu && rodada ? entregaParaTela(porUsuario.get(usuarioId)) || { etapa: "leitura", plano: "", modo: null, linguagem: null, repo: "", caminho: "", codigo: "", testes: [], resumo: { total: 0, passados: 0, passou: false }, passou: false, tentativas: 0, enviadaEm: null } : null,
    eu: eu ? { id: eu.id, eliminado: eu.eliminado, skin: eu.skin } : null,
    podeAbrirRodada: souDono && t.status !== "encerrado" && (!rodada || rodada.status === "avaliada") && t.rodada_atual < t.rodadas_total,
    podeChamarJurados: jurados.ok,
    motivoDosJurados: jurados.motivo || "",
    tempoAcabou,
    todosEnviaram,
    avaliando: rodada?.status === "avaliando",
  };
}

/** Os jurados: cada rodada avaliada, com as notas e os feedbacks de todos, e a classificação. */
export async function juradosParaTela(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  const { data, error } = await supabase.from("proof_bootcamp_rodadas").select(CAMPOS_R).eq("torneio_id", t.id).order("numero", { ascending: false });
  falhou(error, "rodadas");
  const porId = new Map(t.participantes.map((p) => [p.id, p]));
  return {
    torneio: resumoDoTorneio(usuarioId)(t),
    jurados: JURADOS,
    classificacao: classificacao(t.participantes).map((p, i) => ({ posicao: i + 1, id: p.id, nome: p.nome, tipo: p.tipo, skin: p.skin, pontos: p.pontos, eliminado: p.eliminado, eliminadoNa: p.eliminadoNa, souEu: p.id === meuId(usuarioId) })),
    rodadas: (data || []).map((r) => ({
      numero: r.numero, status: r.status, abertaEm: r.aberta_em, avaliadaEm: r.avaliada_em,
      desafio: desafioParaTela(r.desafio),
      confrontos: (r.confrontos || []).map((c) => ({ ...c, nomeA: porId.get(c.a)?.nome, nomeB: c.b ? porId.get(c.b)?.nome : null })),
      avaliacao: r.avaliacao ? {
        origem: r.avaliacao.origem, comentarioGeral: r.avaliacao.comentarioGeral, eliminados: r.avaliacao.eliminados || [], campeao: r.avaliacao.campeao,
        participantes: (r.avaliacao.participantes || []).map((a) => ({ ...a, skin: porId.get(a.id)?.skin, souEu: a.id === meuId(usuarioId) })).sort((a, b) => b.nota - a.nota),
      } : null,
    })),
  };
}

// ------------------------------------------------------------------ criar e apagar

export async function criarTorneio(usuarioId, corpo) {
  const v = validarConfiguracao(corpo);
  if (!v.ok) throw new ErroDeAcesso(400, v.motivo);
  const c = v.config;

  const { count, error: e1 } = await supabase.from("proof_bootcamp_torneios").select("id", { count: "exact", head: true }).eq("dono_id", usuarioId).neq("status", "encerrado");
  falhou(e1, "torneios");
  if ((count || 0) >= ABERTOS_POR_ORGANIZADOR) throw new ErroDeAcesso(400, `você já organiza ${ABERTOS_POR_ORGANIZADOR} torneios em andamento: termine ou exclua um antes`);

  if (c.convidados.length) {
    const podem = new Set((await convidaveis(usuarioId)).map((d) => d.id));
    if (c.convidados.some((id) => !podem.has(id))) throw new ErroDeAcesso(400, "só dá para convidar quem aparece no ranking do Proof");
  }
  const ids = [usuarioId, ...c.convidados];
  const [nomes, personagens] = await Promise.all([nomesPublicos(ids), personagensDos(ids)]);
  const s = sorteio(sementeDe(`bootcamp:${usuarioId}:${Date.now()}:${Math.random()}`));
  const participantes = montarParticipantes({
    humanos: ids.map((uid) => ({ usuarioId: uid, nome: nomes.get(uid) || "Estudante", personagem: personagens.get(uid) || "neuro" })),
    npcs: c.npcs,
    total: c.total,
    s,
  });
  if (participantes.length < BOOTCAMP.minParticipantes) throw new ErroDeAcesso(400, "faltam participantes para o torneio");

  const { data, error } = await supabase.from("proof_bootcamp_torneios").insert({
    dono_id: usuarioId, nome: c.nome, formato: c.formato, tempo_min: c.tempoMin, linguagens: c.linguagens,
    rodadas_total: totalDeRodadas(c.formato, participantes.length, c.rodadasPontos),
    participantes, humanos: ids,
  }).select("id").single();
  falhou(error, "criar torneio");
  return { id: data.id };
}

export async function apagarTorneio(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  if (t.dono_id !== usuarioId) throw new ErroDeAcesso(403, "só quem organizou pode excluir o torneio");
  const { error } = await supabase.from("proof_bootcamp_torneios").delete().eq("id", t.id).eq("dono_id", usuarioId);
  falhou(error, "excluir torneio");
}

// ------------------------------------------------------------------ abrir a rodada (os jurados lançam o desafio)

/**
 * A solução de referência roda contra os testes: a resposta que vale é a que ela imprime de verdade (a IA às
 * vezes erra a conta à mão). Se a referência não roda em algum teste, o desafio não serve.
 */
async function conferirComAReferencia(desafio) {
  if (!desafio.solucao?.codigo?.trim()) throw new Error("o desafio veio sem a solução de referência");
  const resultados = await rodarTestes(desafio.solucao.linguagem || "python", desafio.solucao.codigo, desafio.testes);
  if (resultados.some((r) => r.erro && !r.obtida)) throw new Error("a solução de referência não rodou em todos os testes");
  const testes = desafio.testes.map((t, i) => ({ ...t, saida: normalizarSaida(resultados[i].obtida) || t.saida }));
  if (testes.some((t) => !t.saida)) throw new Error("a solução de referência não imprimiu nada em algum teste");
  return { ...desafio, testes };
}

async function desafioDaRodada(t, numero) {
  const { data: anteriores } = await supabase.from("proof_bootcamp_rodadas").select("desafio").eq("torneio_id", t.id);
  const usados = (anteriores || []).map((r) => r.desafio?.titulo).filter(Boolean);
  const dificuldade = dificuldadeDaRodada(numero, t.rodadas_total);
  if (temModelo()) {
    try {
      const daIa = await gerarDesafioDosJurados({ numero, total: t.rodadas_total, dificuldade, linguagens: t.linguagens, usados });
      return await conferirComAReferencia(daIa);
    } catch (e) {
      console.warn("[bootcamp] desafio da IA descartado:", e?.message || e);
    }
  }
  const s = sorteio(sementeDe(`reserva:${t.id}:${numero}`));
  return desafioDeReserva({ dificuldade, usados, linguagens: t.linguagens, s });
}

export async function abrirRodada(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  if (t.dono_id !== usuarioId) throw new ErroDeAcesso(403, "só quem organizou abre as rodadas");
  if (t.status === "encerrado") throw new ErroDeAcesso(400, "o torneio já terminou");
  const atual = await lerRodada(t);
  if (atual && atual.status !== "avaliada") throw new ErroDeAcesso(400, `a rodada ${atual.numero} ainda não foi avaliada pelos jurados`);
  const numero = t.rodada_atual + 1;
  if (numero > t.rodadas_total) throw new ErroDeAcesso(400, "todas as rodadas já foram jogadas");

  const desafio = await desafioDaRodada(t, numero);
  const conferido = validarDesafio(desafio, { linguagens: t.linguagens, dificuldade: desafio.dificuldade });
  if (!conferido.ok) throw new ErroDeAcesso(500, `desafio inválido: ${conferido.motivo}`);
  const abertaEm = new Date().toISOString();
  const { error } = await supabase.from("proof_bootcamp_rodadas").insert({
    torneio_id: t.id, numero, desafio: { ...conferido.desafio, solucao: desafio.solucao || null },
    confrontos: t.formato === "mata-mata" ? confrontosDaRodada(t.participantes) : null,
    aberta_em: abertaEm, prazo: prazoDaRodada(abertaEm, t.tempo_min),
  });
  if (error?.code === "23505") throw new ErroDeAcesso(409, "essa rodada já foi aberta");
  falhou(error, "abrir rodada");
  const { error: e2 } = await supabase.from("proof_bootcamp_torneios")
    .update({ rodada_atual: numero, status: "em-andamento", atualizado_em: abertaEm })
    .eq("id", t.id).eq("rodada_atual", numero - 1);
  falhou(e2, "torneio");
  return torneioParaTela(usuarioId, id);
}

// ------------------------------------------------------------------ o fluxo do exercício

/** A rodada aberta e a minha entrega (criada na primeira ação), conferindo que eu jogo e que o tempo não acabou. */
async function minhaVez(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  const eu = t.participantes.find((p) => p.id === meuId(usuarioId));
  if (!eu) throw new ErroDeAcesso(403, "você não joga neste torneio");
  if (eu.eliminado) throw new ErroDeAcesso(400, "você foi eliminado: agora é torcer pelos outros");
  const rodada = await lerRodada(t);
  if (!rodada || rodada.status !== "aberta") throw new ErroDeAcesso(400, rodada?.status === "avaliando" ? "os jurados estão avaliando a rodada" : "nenhuma rodada aberta agora");
  if (prazoPassou(rodada.prazo)) throw new ErroDeAcesso(400, "o tempo da rodada acabou: agora é com os jurados");

  const { error: e1 } = await supabase.from("proof_bootcamp_entregas")
    .upsert({ rodada_id: rodada.id, torneio_id: t.id, usuario_id: usuarioId }, { onConflict: "rodada_id,usuario_id", ignoreDuplicates: true });
  falhou(e1, "entrega");
  const { data: entrega, error } = await supabase.from("proof_bootcamp_entregas").select(CAMPOS_E).eq("rodada_id", rodada.id).eq("usuario_id", usuarioId).single();
  falhou(error, "entrega");
  return { t, rodada, entrega };
}

async function gravarEntrega(entrega, mudancas) {
  const { data, error } = await supabase.from("proof_bootcamp_entregas")
    .update({ ...mudancas, atualizado_em: new Date().toISOString() })
    .eq("id", entrega.id).is("enviada_em", null).select("id");
  falhou(error, "entrega");
  if (!data?.length) throw new ErroDeAcesso(409, "a entrega já foi para os jurados");
}

/**
 * Os passos do fluxo antes do código:
 *   { acao: "ler" }                                         Início: li o enunciado
 *   { acao: "planejar", plano }                             Análise de requisitos e planejamento
 *   { acao: "ambiente", modo, linguagem, repo?, caminho? }  Configuração do ambiente (editor ou GitHub)
 */
export async function agirNaRodada(usuarioId, id, corpo) {
  const { t, rodada, entrega } = await minhaVez(usuarioId, id);
  const acao = String(corpo?.acao || "");

  if (acao === "ler") {
    const r = avancarNoFluxo(entrega.etapa, "ler");
    if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
    if (r.etapa !== entrega.etapa) await gravarEntrega(entrega, { etapa: r.etapa });
  } else if (acao === "planejar") {
    const plano = String(corpo?.plano || "").trim().slice(0, BOOTCAMP.limites.plano);
    const r = avancarNoFluxo(entrega.etapa, "planejar", { plano });
    if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
    await gravarEntrega(entrega, { plano, etapa: r.etapa });
  } else if (acao === "ambiente") {
    const modo = corpo?.modo === "github" ? "github" : corpo?.modo === "editor" ? "editor" : null;
    const linguagem = chaveDaLinguagem(corpo?.linguagem);
    const exigida = rodada.desafio.linguagem;
    if (exigida && linguagem !== exigida) throw new ErroDeAcesso(400, `nesta rodada os jurados estipularam ${LINGUAGENS_DO_BOOTCAMP[exigida]?.rotulo || exigida}`);
    const permitidas = t.linguagens?.permitidas?.length ? t.linguagens.permitidas : ORDEM_DAS_LINGUAGENS;
    if (linguagem && !permitidas.includes(linguagem)) throw new ErroDeAcesso(400, "essa linguagem não está entre as do torneio");
    const repo = modo === "github" ? String(corpo?.repo || "").trim().slice(0, 300) : null;
    const caminho = modo === "github" ? String(corpo?.caminho || "").trim().replace(/^\/+/, "").slice(0, BOOTCAMP.limites.caminho) || caminhoPadrao(rodada.numero, linguagem) : null;
    const endereco = repo ? lerEnderecoDoRepo(repo) : null;
    const r = avancarNoFluxo(entrega.etapa, "ambiente", { modo, linguagem, repoValido: Boolean(endereco) });
    if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
    const mudou = modo !== entrega.modo || linguagem !== entrega.linguagem || repo !== entrega.repo || caminho !== entrega.caminho;
    await gravarEntrega(entrega, { modo, linguagem, repo, caminho, etapa: r.etapa, ...(mudou ? { passou: false } : {}) });
  } else {
    throw new ErroDeAcesso(400, "ação desconhecida");
  }
  return torneioParaTela(usuarioId, id);
}

/**
 * POST /api/bootcamp/challenge/submit — a execução dos testes e o envio para a revisão.
 *   editor: o código vem no corpo; GitHub: o arquivo é lido no último commit da branch do repositório da entrega.
 * Com `enviar`, depois de passar nos testes a entrega vai para os jurados (se o mesmo código já passou, não roda
 * de novo). A decisão "Passou nos testes?" do fluxo: não → volta para o código; sim → pode ir para a revisão.
 */
export async function testarEntrega(usuarioId, id, corpo) {
  const { rodada, entrega } = await minhaVez(usuarioId, id);
  if (!entrega.modo || !entrega.linguagem) throw new ErroDeAcesso(400, "configure o ambiente (modo e linguagem) antes de testar");
  const enviar = Boolean(corpo?.enviar);

  let codigo;
  let sha = null;
  if (entrega.modo === "github") {
    try {
      const arquivo = await lerArquivoDoRepo(entrega.repo, entrega.caminho, { maximo: BOOTCAMP.limites.codigo });
      codigo = arquivo.conteudo;
      sha = arquivo.sha;
    } catch (e) {
      if (e instanceof ErroDoGitHub) throw new ErroDeAcesso(400, e.message);
      throw e;
    }
  } else {
    codigo = String(corpo?.codigo ?? "");
    if (codigo.length > BOOTCAMP.limites.codigo) throw new ErroDeAcesso(400, "o código passou de 20 mil caracteres");
  }
  if (!codigo.trim()) throw new ErroDeAcesso(400, entrega.modo === "github" ? "o arquivo da solução está vazio" : "escreva o código antes de rodar os testes");

  const jaTestado = entrega.passou && entrega.etapa === "testes" && entrega.codigo === codigo && (entrega.modo !== "github" || entrega.commit_sha === sha);
  let resultados = entrega.testes;
  let etapa = entrega.etapa;
  let passou = entrega.passou;
  if (!(enviar && jaTestado)) {
    const r0 = avancarNoFluxo(entrega.etapa, "testar", { passou: false });
    if (!r0.ok) throw new ErroDeAcesso(400, r0.motivo);
    frear(usuarioId, rodada.desafio.testes.length);
    resultados = await rodarTestes(entrega.linguagem, codigo, rodada.desafio.testes);
    passou = resumoDosTestes(resultados).passou;
    etapa = avancarNoFluxo(entrega.etapa, "testar", { passou }).etapa;
  }
  let enviadaEm = null;
  if (enviar && passou) {
    const r = avancarNoFluxo(etapa, "enviar", { passou });
    if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
    etapa = r.etapa;
    enviadaEm = new Date().toISOString();
  }
  await gravarEntrega(entrega, {
    codigo, commit_sha: sha, testes: resultados, passou, etapa,
    tentativas: entrega.tentativas + (enviar && jaTestado ? 0 : 1),
    ...(enviadaEm ? { enviada_em: enviadaEm } : {}),
  });
  const resumo = resumoDosTestes(resultados);
  return {
    resultado: { testes: testesParaTela(resultados), resumo: { total: resumo.total, passados: resumo.passados, passou: resumo.passou }, enviada: Boolean(enviadaEm), commitSha: sha },
    ...(await torneioParaTela(usuarioId, id)),
  };
}

// ------------------------------------------------------------------ os jurados avaliam

function feedbackDoNpc(npc, sim) {
  return {
    kernel: `Passou em ${sim.passados} de ${sim.total} testes${sim.estourou ? " e estourou o tempo" : ""}.`,
    vetor: npc.habilidade >= 0.75 ? "Código bem dividido e fácil de ler." : "Funciona, mas as funções podiam ser mais bem organizadas.",
    sintaxe: sim.passou ? "Seguiu o formato da saída à risca." : "Escorregou em algum detalhe do enunciado ou do formato da saída.",
  };
}

export async function chamarJurados(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  const rodada = await lerRodada(t);
  if (!rodada) throw new ErroDeAcesso(400, "nenhuma rodada aberta");
  if (rodada.status === "avaliando") throw new ErroDeAcesso(409, "os jurados já estão avaliando a rodada");
  if (rodada.status === "avaliada") return torneioParaTela(usuarioId, id);

  const entregas = await lerEntregas(rodada.id);
  const porUsuario = new Map(entregas.map((e) => [e.usuario_id, e]));
  const pode = podeChamarJurados({
    souDono: t.dono_id === usuarioId,
    todosEnviaram: humanosAtivos(t).every((h) => porUsuario.get(h.usuarioId)?.enviada_em),
    tempoAcabou: prazoPassou(rodada.prazo),
  });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  // a trava: só uma avaliação por rodada, mesmo com dois cliques ao mesmo tempo
  const { data: travada, error: eTrava } = await supabase.from("proof_bootcamp_rodadas").update({ status: "avaliando" }).eq("id", rodada.id).eq("status", "aberta").select("id");
  falhou(eTrava, "rodada");
  if (!travada?.length) throw new ErroDeAcesso(409, "os jurados já estão avaliando a rodada");

  try {
    const desafio = rodada.desafio;
    const lista = ativos(t);
    const apelidoDe = new Map(lista.map((p, i) => [p.id, `p${i + 1}`]));
    const humanos = [];
    const npcs = [];
    const sims = new Map();
    for (const p of lista) {
      if (p.tipo === "npc") {
        const sim = simulacaoDo(p, rodada, t.tempo_min);
        sims.set(p.id, sim);
        npcs.push({ apelido: apelidoDe.get(p.id), nome: p.nome, personalidade: p.personalidade, passados: sim.passados, total: sim.total });
        continue;
      }
      const e = porUsuario.get(p.usuarioId);
      const r = resumoDosTestes(e?.testes);
      humanos.push({
        id: p.id, apelido: apelidoDe.get(p.id), nome: p.nome, linguagem: e?.linguagem || null, modo: e?.modo || null, plano: e?.plano || "",
        codigo: e?.codigo || "", testes: { passados: r.passados, total: r.total }, enviou: Boolean(e?.enviada_em), fracao: r.fracao, testou: r.total > 0,
        linguagemOk: !desafio.linguagem || !e?.linguagem || e.linguagem === desafio.linguagem, commitSha: e?.commit_sha || null,
      });
    }

    let ia = null;
    if (temModelo()) {
      try {
        const apelidos = new Map(humanos.map((h) => [h.apelido, { id: h.id, fracao: h.fracao, testou: h.testou }]));
        ia = await avaliarComOsJurados({ desafio, humanos, npcs, apelidos });
      } catch (e) {
        console.warn("[bootcamp] avaliação da IA falhou, vale a automática:", e?.message || e);
      }
    }

    const notas = new Map();
    const avaliados = lista.map((p) => {
      let notasDele;
      let feedback;
      let testes;
      let extra = {};
      if (p.tipo === "npc") {
        const sim = sims.get(p.id);
        const npc = npcPorId(p.npcId);
        notasDele = notasDoNpc(npc, sim);
        feedback = feedbackDoNpc(npc, sim);
        testes = { passados: sim.passados, total: sim.total };
        extra = { fala: ia?.falas.get(apelidoDe.get(p.id)) || p.bordao || "", enviou: true, minutos: sim.minutos };
      } else {
        const h = humanos.find((x) => x.id === p.id);
        const daIa = ia?.porHumano.get(p.id);
        const auto = avaliacaoAutomatica({ enviou: h.enviou, testou: h.testou, fracao: h.fracao, plano: h.plano, linguagemOk: h.linguagemOk });
        notasDele = daIa?.notas || auto.notas;
        feedback = Object.fromEntries(Object.keys(auto.feedback).map((j) => [j, daIa?.feedback?.[j] || auto.feedback[j]]));
        testes = h.testes;
        extra = { enviou: h.enviou, linguagem: h.linguagem, modo: h.modo, commitSha: h.commitSha };
      }
      const nota = notaDaRodada(notasDele);
      notas.set(p.id, { nota, kernel: notasDele.kernel });
      return { id: p.id, nome: p.nome, tipo: p.tipo, notas: notasDele, feedback, nota, testes, ...extra };
    });

    const res = aplicarResultado({ formato: t.formato, participantes: t.participantes, confrontos: rodada.confrontos || [], notas, numero: rodada.numero, total: t.rodadas_total });
    const folgas = new Set((rodada.confrontos || []).filter((c) => !c.b).map((c) => c.a));
    const avaliacao = {
      origem: ia ? "jurados" : "automatica",
      comentarioGeral: ia?.comentarioGeral || "Os jurados conferiram os testes, o plano e as regras de cada entrega.",
      participantes: avaliados.map((a) => ({
        ...a,
        resultado: res.eliminados.includes(a.id) ? "eliminado" : folgas.has(a.id) ? "folga" : t.formato === "mata-mata" ? "avancou" : "pontuou",
      })),
      eliminados: res.eliminados, avancaram: res.avancaram, campeao: res.campeao,
    };
    const agora = new Date().toISOString();
    const { error: e1 } = await supabase.from("proof_bootcamp_rodadas").update({ status: "avaliada", avaliacao, avaliada_em: agora }).eq("id", rodada.id).eq("status", "avaliando");
    falhou(e1, "rodada");
    const { error: e2 } = await supabase.from("proof_bootcamp_torneios").update({
      participantes: res.participantes, atualizado_em: agora,
      ...(res.encerrado ? { status: "encerrado", campeao: res.campeao, encerrado_em: agora } : {}),
    }).eq("id", t.id);
    falhou(e2, "torneio");
    await supabase.from("proof_bootcamp_entregas").update({ etapa: "fim", atualizado_em: agora }).eq("rodada_id", rodada.id);
  } catch (e) {
    // deu errado no meio: a rodada volta a ficar aberta para chamar os jurados de novo
    await supabase.from("proof_bootcamp_rodadas").update({ status: "aberta" }).eq("id", rodada.id).eq("status", "avaliando");
    throw e;
  }
  return torneioParaTela(usuarioId, id);
}
