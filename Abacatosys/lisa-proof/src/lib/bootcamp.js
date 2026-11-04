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
  NIVEIS_DO_TORNEIO, ORDEM_DOS_NIVEIS, CENARIOS, ORDEM_DOS_CENARIOS, nivelValido, cenarioValido, npcNoNivel,
  reviewAutomatica, reviewDoNpc, pontosAutomaticos, despedidaAutomatica,
  TIPOS_DE_PROVA, INSIGNIAS, ESPECIALIDADES, STATUS, planoDaTemporada, competidoresDaProva, formarEquipes, escolhaDoCapitaoNpc,
  aplicarResultadoDaProva, APRESENTADORA, provaDoTorneio, testarNaBancada,
  rotuloDaProva, desafioColaborativo, dividirPartes, modeloDasPartes, programaDoTime, programaDeTeste, codigoDoNpcNasPartes,
  acertosDoNpcNasPartes, reviewDaParteDoNpc, despedidaDoNpc,
} from "@/dominio/bootcamp.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const ehUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
const CAMPOS_T = "id, dono_id, nome, formato, tempo_min, linguagens, rodadas_total, participantes, humanos, rodada_atual, status, campeao, criado_em, atualizado_em, encerrado_em, opcoes, estado";
const nivelDo = (t) => nivelValido(t.opcoes?.nivel);
const CAMPOS_R = "id, torneio_id, numero, desafio, confrontos, status, avaliacao, aberta_em, prazo, avaliada_em, prova";

/**
 * A prova da rodada. Nas rodadas da temporada ela vem gravada ({ tipo, episodio, competidores, equipes, sai });
 * nos modos rápidos (e nas rodadas de antes da temporada existir) é uma "rodada" com todos os que estavam na disputa.
 */
const provaDe = (t, rodada) => rodada?.prova || {
  tipo: "rodada", episodio: rodada?.numero || 0,
  competidores: t.participantes.filter((p) => !p.eliminado || p.eliminadoNa === rodada?.numero).map((p) => p.id),
};
const naProva = (prova, id) => (prova?.competidores || []).includes(id);
const equipeDe = (prova, id) => (prova?.equipes || []).find((e) => e.membros.includes(id)) || null;

/** O plano da temporada para a tela: as provas, com o nome de cada uma. */
const planoParaTela = (t) => (t.formato === "temporada"
  ? planoDaTemporada(t.participantes.length, t.opcoes).map((p) => ({ numero: p.numero, tipo: p.tipo, modo: p.modo || null, episodio: p.episodio, nome: rotuloDaProva(p).nome, emoji: rotuloDaProva(p).emoji }))
  : null);

function provaParaTela(prova, nomes) {
  const tipo = rotuloDaProva(prova);
  return {
    tipo: prova.tipo, modo: prova.modo || null, nome: tipo.nome, emoji: tipo.emoji, descricao: tipo.descricao, episodio: prova.episodio, sai: prova.sai || null,
    competidores: prova.competidores || [],
    equipes: (prova.equipes || []).map((e) => ({ ...e, nomes: e.membros.map((id) => nomes.get(id) || "?"), nomeDoCapitao: e.capitao ? nomes.get(e.capitao) : null })),
  };
}
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

/** O personagem da Lisa no nível do torneio (mais ou menos habilidoso e rápido). */
const npcDoTorneio = (p, t) => {
  const npc = npcPorId(p.npcId);
  return npc ? npcNoNivel(npc, nivelDo(t)) : null;
};

/** O que o personagem da Lisa fez nesta rodada (sempre o mesmo resultado para a mesma rodada). */
function simulacaoDo(p, rodada, t) {
  const npc = npcDoTorneio(p, t);
  if (!npc) return null;
  return simularNpc({
    npc, dificuldade: rodada.desafio.dificuldade, testes: rodada.desafio.testes, tempoMin: t.tempo_min, area: rodada.desafio.area,
    s: sorteio(sementeDe(`${rodada.id}:${p.npcId}`)),
  });
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
    nivel: nivelDo(t), nivelNome: NIVEIS_DO_TORNEIO[nivelDo(t)].nome,
    cenario: cenarioValido(t.opcoes?.cenario), cenarioNome: CENARIOS[cenarioValido(t.opcoes?.cenario)].nome,
    contraCpu: t.participantes.some((p) => p.tipo === "npc"),
    opcoes: t.opcoes || {},
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
      npcs: NPCS_DO_BOOTCAMP.map((n) => ({
        id: n.id, nome: n.nome, skin: n.skin, personalidade: n.personalidade, bordao: n.bordao, status: n.status, especialidades: n.especialidades,
        disponivel: npcsDisponiveis([meuPersonagem]).includes(n),
      })),
      especialidades: ESPECIALIDADES,
      rotulosDeStatus: STATUS,
      tiposDeProva: TIPOS_DE_PROVA,
      eliminadosPorEpisodio: BOOTCAMP.eliminadosPorEpisodio,
      provasDeEquipe: BOOTCAMP.provasDeEquipe,
      jurados: JURADOS,
      niveis: ORDEM_DOS_NIVEIS.map((id) => ({ id, ...NIVEIS_DO_TORNEIO[id] })),
      cenarios: ORDEM_DOS_CENARIOS.map((id) => ({ id, ...CENARIOS[id] })),
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
  const prova = provaDe(t, rodada);
  const humanosNaProva = t.participantes.filter((p) => p.tipo === "humano" && naProva(prova, p.id));
  // contra a CPU ninguém espera o relógio dos personagens: entregou o último humano da prova, todo mundo entregou
  const todosEnviaram = Boolean(aberta) && humanosNaProva.every((h) => porUsuario.get(h.usuarioId)?.enviada_em);

  const participantes = t.participantes.map((p) => {
    const npc = p.tipo === "npc" ? npcPorId(p.npcId) : null;
    const base = {
      ...p, souEu: p.id === meuId(usuarioId), compete: Boolean(rodada) && naProva(prova, p.id),
      // salvo: está na disputa, mas a prova de agora não é dele (ficou salvo na prova anterior)
      salvo: Boolean(rodada) && !p.eliminado && !naProva(prova, p.id),
      equipe: equipeDe(prova, p.id)?.id || null,
      insignias: p.insignias || [],
      ...(npc ? { status: npc.status, especialidades: npc.especialidades } : {}),
    };
    // quem saiu antes, ou não joga esta prova, não tem etapa nela
    if (!rodada || !naProva(prova, p.id)) return { ...base, etapa: null, enviada: false, testes: null, nota: avaliacao.get(p.id)?.nota ?? null };
    if (p.tipo === "npc") {
      const sim = simulacaoDo(p, rodada, t);
      const etapa = aberta ? (todosEnviaram ? "revisao" : etapaDoNpc(sim, minutos)) : "fim";
      const enviada = !aberta || etapa === "revisao";
      return { ...base, etapa, enviada, testes: enviada ? { passados: sim.passados, total: sim.total } : null, nota: avaliacao.get(p.id)?.nota ?? null };
    }
    const e = porUsuario.get(p.usuarioId);
    const r = resumoDosTestes(e?.testes);
    return { ...base, etapa: aberta ? e?.etapa || "leitura" : "fim", enviada: Boolean(e?.enviada_em), testes: r.total ? { passados: r.passados, total: r.total } : null, nota: avaliacao.get(p.id)?.nota ?? null };
  });

  const souDono = t.dono_id === usuarioId;
  const eu = t.participantes.find((p) => p.id === meuId(usuarioId));
  const colab = rodada?.desafio?.colaborativa || null;
  const meuTime = colab ? equipeDe(prova, meuId(usuarioId)) : null;
  const nomesDaProva = new Map(t.participantes.map((p) => [p.id, p.nome]));
  const colaborativa = colab ? {
    linguagem: colab.linguagem, principal: colab.principal,
    // a divisão de cada time: quem escreve cada parte (no meu time, marcando a minha)
    times: (prova.equipes || []).map((e) => ({
      id: e.id, meu: e.id === meuTime?.id,
      divisao: colab.partes.map((parte) => {
        const dono = Object.entries(e.partes || {}).find(([, ps]) => ps.includes(parte.id))?.[0] || null;
        return { parte: parte.id, nome: parte.nome, funcao: parte.funcao, descricao: parte.descricao, responsavel: dono, nomeDoResponsavel: nomesDaProva.get(dono) || "", souEu: dono === meuId(usuarioId) };
      }),
    })),
    minhasPartes: meuTime?.partes?.[meuId(usuarioId)] || [],
    modelo: meuTime ? modeloDasPartes(colab, meuTime.partes?.[meuId(usuarioId)] || []) : "",
  } : null;
  const tempoAcabou = Boolean(aberta && prazoPassou(rodada.prazo, agora));
  const jurados = aberta ? podeChamarJurados({ souDono, todosEnviaram, tempoAcabou }) : { ok: false, motivo: "" };
  const nomes = new Map(t.participantes.map((p) => [p.id, p.nome]));
  const pendente = t.estado?.pendente || null;
  const plano = planoParaTela(t);
  const proxima = plano ? plano[t.rodada_atual] || null : null;

  return {
    torneio: {
      ...resumoDoTorneio(usuarioId)(t), linguagens: t.linguagens, linguagensDisponiveis: linguagensDoTorneio(t),
      formatoDescricao: FORMATOS[t.formato]?.descricao, campeaoId: t.campeao, plano, proxima,
    },
    participantes,
    jurados: JURADOS,
    apresentadora: APRESENTADORA,
    fluxo: ETAPAS_DO_FLUXO,
    insignias: INSIGNIAS,
    especialidades: ESPECIALIDADES,
    rotulosDeStatus: STATUS,
    // a prova em equipe no modo "capitão": o vencedor da última prova escolhe um membro antes de a prova abrir
    escolha: pendente ? {
      capitao: pendente.capitao, nomeDoCapitao: nomes.get(pendente.capitao) || "", souEu: pendente.capitao === meuId(usuarioId),
      disponiveis: (pendente.disponiveis || []).map((pid) => {
        const p = t.participantes.find((x) => x.id === pid);
        const npc = p?.tipo === "npc" ? npcPorId(p.npcId) : null;
        return { id: pid, nome: p?.nome, skin: p?.skin, tipo: p?.tipo, status: npc?.status || null, especialidades: npc?.especialidades || [] };
      }),
    } : null,
    rodada: rodada ? {
      numero: rodada.numero, status: rodada.status, abertaEm: rodada.aberta_em, prazo: rodada.prazo, avaliadaEm: rodada.avaliada_em,
      prova: provaParaTela(prova, nomes),
      desafio: desafioParaTela(rodada.desafio),
      colaborativa,
      confrontos: (rodada.confrontos || []).map((c) => ({ a: c.a, b: c.b, nomeA: nomes.get(c.a), nomeB: c.b ? nomes.get(c.b) : null })),
      // avaliada: tudo o que a avaliação ao vivo precisa (as notas, o code review de cada um e o resultado)
      avaliacao: rodada.status === "avaliada" ? {
        comentarioGeral: rodada.avaliacao?.comentarioGeral || "", eliminados: rodada.avaliacao?.eliminados || [], campeao: rodada.avaliacao?.campeao || null,
        origem: rodada.avaliacao?.origem || "automatica",
        vencedores: rodada.avaliacao?.vencedores || [], salvos: rodada.avaliacao?.salvos || [], equipes: rodada.avaliacao?.equipes || null,
        participantes: (rodada.avaliacao?.participantes || []).map((a) => ({
          id: a.id, nome: a.nome, tipo: a.tipo, nota: a.nota, notas: a.notas, resultado: a.resultado, fala: a.fala || "",
          testes: a.testes, linguagem: a.linguagem || null, review: a.review || [], insignia: a.insignia || null,
          pontosFortes: a.pontosFortes || [], pontosFracos: a.pontosFracos || [], despedida: a.despedida || [],
        })),
      } : null,
    } : null,
    // só tem entrega quem joga a prova de agora (quem ficou salvo assiste)
    minhaEntrega: eu && rodada && naProva(prova, eu.id) ? entregaParaTela(porUsuario.get(usuarioId)) || { etapa: "leitura", plano: "", modo: null, linguagem: null, repo: "", caminho: "", codigo: "", testes: [], resumo: { total: 0, passados: 0, passou: false }, passou: false, tentativas: 0, enviadaEm: null } : null,
    eu: eu ? { id: eu.id, eliminado: eu.eliminado, skin: eu.skin, salvo: Boolean(rodada) && !eu.eliminado && !naProva(prova, eu.id), insignias: eu.insignias || [] } : null,
    final: prova.tipo === "final" ? { finalistas: prova.competidores } : null,
    podeAbrirRodada: souDono && !pendente && t.status !== "encerrado" && (!rodada || rodada.status === "avaliada") && t.rodada_atual < t.rodadas_total,
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
    insignias: INSIGNIAS,
    classificacao: classificacao(t.participantes).map((p, i) => ({ posicao: i + 1, id: p.id, nome: p.nome, tipo: p.tipo, skin: p.skin, pontos: p.pontos, eliminado: p.eliminado, eliminadoNa: p.eliminadoNa, souEu: p.id === meuId(usuarioId), insignias: p.insignias || [] })),
    rodadas: (data || []).map((r) => ({
      numero: r.numero, status: r.status, abertaEm: r.aberta_em, avaliadaEm: r.avaliada_em,
      prova: provaParaTela(provaDe(t, r), new Map(t.participantes.map((p) => [p.id, p.nome]))),
      vencedores: (r.avaliacao?.vencedores || []).map((pid) => porId.get(pid)?.nome).filter(Boolean),
      equipes: r.avaliacao?.equipes || null,
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
    rodadas_total: totalDeRodadas(c.formato, participantes.length, c.rodadasPontos, c.opcoes),
    participantes, humanos: ids, opcoes: c.opcoes, estado: {},
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

async function desafioDaRodada(t, numero, prova = null) {
  const { data: anteriores } = await supabase.from("proof_bootcamp_rodadas").select("desafio").eq("torneio_id", t.id);
  const usados = (anteriores || []).map((r) => r.desafio?.titulo).filter(Boolean);
  const dificuldade = dificuldadeDaRodada(numero, t.rodadas_total, nivelDo(t));
  if (prova?.modo === "colaborativa") {
    const colaborativo = desafioColaborativo({ usados, permitidas: t.linguagens?.permitidas || [], s: sorteio(sementeDe(`colaborativa:${t.id}:${numero}`)) });
    if (colaborativo) return colaborativo;
  }
  if (temModelo()) {
    try {
      const tipoDeProva = provaDoTorneio(t.formato, numero, t.participantes.length, t.opcoes)?.tipo || "rodada";
      const daIa = await gerarDesafioDosJurados({ numero, total: t.rodadas_total, dificuldade, linguagens: t.linguagens, usados, tipoDeProva });
      return await conferirComAReferencia(daIa);
    } catch (e) {
      console.warn("[bootcamp] desafio da IA descartado:", e?.message || e);
    }
  }
  const s = sorteio(sementeDe(`reserva:${t.id}:${numero}`));
  return desafioDeReserva({ dificuldade, usados, linguagens: t.linguagens, s });
}

/**
 * A prova da rodada `numero`: quem joga e, na prova em equipe, os dois times. No modo "capitao", o vencedor da
 * última prova escolhe um membro: se ele for da CPU, escolhe o mais forte na hora; se for humano e ainda não
 * escolheu, devolve { pendente } e a prova espera a escolha.
 */
function montarProva(t, numero, escolhido = null) {
  if (t.formato !== "temporada") return { prova: null };
  const item = planoDaTemporada(t.participantes.length, t.opcoes)[numero - 1];
  if (!item) throw new ErroDeAcesso(400, "todas as provas já foram jogadas");
  const competidores = competidoresDaProva(item.tipo, t.participantes, t.estado?.salvos || []);
  const prova = { tipo: item.tipo, episodio: item.episodio, competidores, sai: item.sai || null, ...(item.tipo === "equipe" ? { modo: item.modo || "media" } : {}) };
  if (item.tipo !== "equipe") return { prova };

  const modo = t.opcoes?.provaDeEquipe === "capitao" ? "capitao" : "sorteio";
  const vencedor = t.estado?.ultimoVencedor;
  const capitao = modo === "capitao" && competidores.includes(vencedor) ? vencedor : null;
  let membro = null;
  if (capitao) {
    const disponiveis = competidores.filter((pid) => pid !== capitao);
    const cap = t.participantes.find((p) => p.id === capitao);
    if (cap?.tipo === "npc") membro = escolhaDoCapitaoNpc(disponiveis, t.participantes);
    else if (escolhido && disponiveis.includes(escolhido)) membro = escolhido;
    else return { pendente: { tipo: "escolher-membro", capitao, numero, disponiveis } };
  }
  const s = sorteio(sementeDe(`equipes:${t.id}:${numero}`));
  return { prova: { ...prova, equipes: formarEquipes(competidores, { modo: capitao ? "capitao" : "sorteio", capitao, escolhido: membro, s }) } };
}

/** Abre a próxima rodada (prova): os jurados lançam o desafio. `escolhido`: o membro que o capitão humano escolheu. */
async function abrir(t, usuarioId, { escolhido = null } = {}) {
  if (t.status === "encerrado") throw new ErroDeAcesso(400, "o torneio já terminou");
  const atual = await lerRodada(t);
  if (atual && atual.status !== "avaliada") throw new ErroDeAcesso(400, `a rodada ${atual.numero} ainda não foi avaliada pelos jurados`);
  const numero = t.rodada_atual + 1;
  if (numero > t.rodadas_total) throw new ErroDeAcesso(400, "todas as rodadas já foram jogadas");

  const montada = montarProva(t, numero, escolhido);
  if (montada.pendente) {
    // o capitão humano escolhe antes; a prova (e o desafio) só abrem depois da escolha
    const { error } = await supabase.from("proof_bootcamp_torneios").update({ estado: { ...(t.estado || {}), pendente: montada.pendente }, atualizado_em: new Date().toISOString() }).eq("id", t.id);
    falhou(error, "torneio");
    return torneioParaTela(usuarioId, t.id);
  }

  const desafio = await desafioDaRodada(t, numero, montada.prova);
  const conferido = validarDesafio(desafio, { linguagens: t.linguagens, dificuldade: desafio.dificuldade });
  if (!conferido.ok) throw new ErroDeAcesso(500, `desafio inválido: ${conferido.motivo}`);
  // a colaborativa: as partes do desafio divididas em cada time (os humanos primeiro, com as partes mais centrais);
  // sem nenhuma linguagem da colaborativa no torneio, a prova em equipe volta a ser pela média
  if (montada.prova?.modo === "colaborativa") {
    const colab = conferido.desafio.colaborativa;
    if (!colab) montada.prova.modo = "media";
    else {
      const humano = (pid) => t.participantes.find((p) => p.id === pid)?.tipo === "humano";
      montada.prova.equipes = (montada.prova.equipes || []).map((e) => ({
        ...e, partes: dividirPartes(colab.ordem, [...e.membros.filter(humano), ...e.membros.filter((pid) => !humano(pid))]),
      }));
    }
  }
  const abertaEm = new Date().toISOString();
  const { error } = await supabase.from("proof_bootcamp_rodadas").insert({
    torneio_id: t.id, numero, desafio: { ...conferido.desafio, solucao: desafio.solucao || null },
    confrontos: t.formato === "mata-mata" ? confrontosDaRodada(t.participantes) : null,
    prova: montada.prova,
    aberta_em: abertaEm, prazo: prazoDaRodada(abertaEm, t.tempo_min),
  });
  if (error?.code === "23505") throw new ErroDeAcesso(409, "essa rodada já foi aberta");
  falhou(error, "abrir rodada");
  const { pendente: _feito, ...estado } = t.estado || {};
  const { error: e2 } = await supabase.from("proof_bootcamp_torneios")
    .update({ rodada_atual: numero, status: "em-andamento", estado, atualizado_em: abertaEm })
    .eq("id", t.id).eq("rodada_atual", numero - 1);
  falhou(e2, "torneio");
  return torneioParaTela(usuarioId, t.id);
}

export async function abrirRodada(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  if (t.dono_id !== usuarioId) throw new ErroDeAcesso(403, "só quem organizou abre as rodadas");
  if (t.estado?.pendente) throw new ErroDeAcesso(400, "a prova em equipe espera o capitão escolher um membro");
  return abrir(t, usuarioId);
}

/** O capitão humano (o vencedor da última prova) escolhe um membro para o time dele; a prova em equipe abre em seguida. */
export async function escolherMembro(usuarioId, id, membro) {
  const t = await lerTorneio(usuarioId, id);
  const pendente = t.estado?.pendente;
  if (!pendente) throw new ErroDeAcesso(400, "não há escolha de equipe pendente");
  if (pendente.capitao !== meuId(usuarioId)) throw new ErroDeAcesso(403, "só o capitão (o vencedor da última prova) escolhe");
  if (!(pendente.disponiveis || []).includes(String(membro || ""))) throw new ErroDeAcesso(400, "escolha alguém que está na disputa");
  return abrir(t, usuarioId, { escolhido: String(membro) });
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
  if (!naProva(provaDe(t, rodada), eu.id)) throw new ErroDeAcesso(400, "você está salvo desta prova: agora é assistir quem disputa");
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
 *   { acao: "rascunho", codigo }                            o código do editor, salvo sozinho enquanto a pessoa digita
 */
export async function agirNaRodada(usuarioId, id, corpo) {
  const { t, rodada, entrega } = await minhaVez(usuarioId, id);
  const acao = String(corpo?.acao || "");

  // o rascunho responde leve (sem a tela inteira): ele vai a cada pausa na digitação
  if (acao === "rascunho") {
    if (entrega.modo !== "editor" || !["codigo", "testes"].includes(entrega.etapa)) return { salvo: false };
    const codigo = String(corpo?.codigo ?? "");
    if (codigo.length > BOOTCAMP.limites.codigo) throw new ErroDeAcesso(400, "o código passou de 20 mil caracteres");
    // o código mudou: os testes de antes não valem para ele (e a entrega volta para a implementação)
    if (codigo !== (entrega.codigo || "")) await gravarEntrega(entrega, { codigo, testes: [], passou: false, etapa: "codigo" });
    return { salvo: true };
  }

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
    if (rodada.desafio.colaborativa && modo === "github") throw new ErroDeAcesso(400, "na prova colaborativa, o time junta o código no editor da tela");
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
  const { t, rodada, entrega } = await minhaVez(usuarioId, id);
  // na colaborativa, as minhas funções rodam junto do gabarito das outras partes (o programa do time é na bancada)
  const colab = rodada.desafio.colaborativa || null;
  const minhas = colab ? equipeDe(provaDe(t, rodada), meuId(usuarioId))?.partes?.[meuId(usuarioId)] || [] : null;
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
    resultados = await rodarTestes(entrega.linguagem, colab ? programaDeTeste(colab, minhas, codigo) : codigo, rodada.desafio.testes);
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

// no máximo estes casos de teste rodam na bancada por avaliação (o limite de chamadas de cada requisição do Worker)
const CASOS_NA_BANCADA = 30;

/**
 * Quem não enviou, escreveu no editor e não testou o código de agora: os jurados rodam os testes na bancada e
 * gravam o resultado na entrega (e na cópia da memória, que a avaliação usa em seguida). Se o compilador não
 * responder, vale o que havia; a avaliação segue.
 */
async function testarNaBancadaQuemFaltou(lista, porUsuario, desafio) {
  let orcamento = CASOS_NA_BANCADA;
  for (const p of lista) {
    const e = p.tipo === "humano" ? porUsuario.get(p.usuarioId) : null;
    if (!testarNaBancada(e) || desafio.testes.length > orcamento) continue;
    orcamento -= desafio.testes.length;
    try {
      const resultados = await rodarTestes(e.linguagem, e.codigo, desafio.testes);
      const passou = resumoDosTestes(resultados).passou;
      Object.assign(e, { testes: resultados, passou, tentativas: (e.tentativas || 0) + 1 });
      const { error } = await supabase.from("proof_bootcamp_entregas")
        .update({ testes: resultados, passou, tentativas: e.tentativas, atualizado_em: new Date().toISOString() }).eq("id", e.id);
      if (error) console.warn("[bootcamp] não gravou os testes da bancada:", error.message);
    } catch (erro) {
      console.warn("[bootcamp] os testes da bancada não rodaram:", erro?.message || erro);
    }
  }
}

/**
 * A colaborativa na bancada: o programa de cada time é o código de cada membro (o da pessoa, como está no servidor;
 * o do personagem, o gabarito ou o bug, pelo sorteio da rodada) mais a parte principal; os testes rodam uma vez por
 * time. Devolve Map time → { passados, total, fracao, faltou (humanos sem código), npcs: Map → { codigo, acertos } }.
 */
async function integrarOsTimes({ t, rodada, prova, colab, porUsuario, desafio }) {
  const saida = new Map();
  for (const e of prova.equipes || []) {
    const blocos = [];
    const faltou = [];
    const npcs = new Map();
    for (const pid of e.membros) {
      const partes = e.partes?.[pid] || [];
      const p = t.participantes.find((x) => x.id === pid);
      if (!partes.length || !p) continue;
      if (p.tipo === "npc") {
        const npc = npcDoTorneio(p, t);
        const acertos = acertosDoNpcNasPartes({ npc, partes, area: desafio.area, dificuldade: desafio.dificuldade, s: sorteio(sementeDe(`colab:${rodada.id}:${p.npcId}`)) });
        const codigo = codigoDoNpcNasPartes(colab, partes, acertos);
        npcs.set(pid, { codigo, acertos });
        blocos.push(codigo);
      } else {
        const codigo = String(porUsuario.get(p.usuarioId)?.codigo || "");
        if (!codigo.trim()) faltou.push(pid);
        blocos.push(codigo);
      }
    }
    let resultados;
    try {
      resultados = await rodarTestes(colab.linguagem, programaDoTime(colab, blocos), desafio.testes);
    } catch (erro) {
      console.warn("[bootcamp] o programa do time não rodou:", erro?.message || erro);
      resultados = desafio.testes.map((x) => ({ oculto: x.oculto, ok: false, entrada: x.entrada, esperada: x.saida, obtida: "", erro: "o compilador on-line não respondeu" }));
    }
    const r = resumoDosTestes(resultados);
    saida.set(e.id, { passados: r.passados, total: r.total, fracao: r.fracao, faltou, npcs });
  }
  return saida;
}

export async function chamarJurados(usuarioId, id) {
  const t = await lerTorneio(usuarioId, id);
  const rodada = await lerRodada(t);
  if (!rodada) throw new ErroDeAcesso(400, "nenhuma rodada aberta");
  if (rodada.status === "avaliando") throw new ErroDeAcesso(409, "os jurados já estão avaliando a rodada");
  if (rodada.status === "avaliada") return torneioParaTela(usuarioId, id);

  const entregas = await lerEntregas(rodada.id);
  const porUsuario = new Map(entregas.map((e) => [e.usuario_id, e]));
  const prova = provaDe(t, rodada);
  const pode = podeChamarJurados({
    souDono: t.dono_id === usuarioId,
    todosEnviaram: t.participantes.filter((p) => p.tipo === "humano" && naProva(prova, p.id)).every((h) => porUsuario.get(h.usuarioId)?.enviada_em),
    tempoAcabou: prazoPassou(rodada.prazo),
  });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  // a trava: só uma avaliação por rodada, mesmo com dois cliques ao mesmo tempo
  const { data: travada, error: eTrava } = await supabase.from("proof_bootcamp_rodadas").update({ status: "avaliando" }).eq("id", rodada.id).eq("status", "aberta").select("id");
  falhou(eTrava, "rodada");
  if (!travada?.length) throw new ErroDeAcesso(409, "os jurados já estão avaliando a rodada");

  try {
    const desafio = rodada.desafio;
    // os jurados avaliam só quem jogou esta prova (quem ficou salvo assiste)
    const lista = t.participantes.filter((p) => naProva(prova, p.id));
    const colab = prova.tipo === "equipe" && desafio.colaborativa ? desafio.colaborativa : null;
    const integracao = colab ? await integrarOsTimes({ t, rodada, prova, colab, porUsuario, desafio }) : null;
    if (!colab) await testarNaBancadaQuemFaltou(lista, porUsuario, desafio);
    const doTime = (pid) => integracao?.get(equipeDe(prova, pid)?.id) || null;
    const apelidoDe = new Map(lista.map((p, i) => [p.id, `p${i + 1}`]));
    const humanos = [];
    const npcs = [];
    const sims = new Map();
    for (const p of lista) {
      if (p.tipo === "npc") {
        const simulada = simulacaoDo(p, rodada, t);
        // na colaborativa, o resultado de todos é o do programa do time
        const time = doTime(p.id);
        const sim = time ? { ...simulada, passados: time.passados, total: time.total, passou: time.total > 0 && time.passados === time.total } : simulada;
        sims.set(p.id, sim);
        npcs.push({ apelido: apelidoDe.get(p.id), nome: p.nome, personalidade: p.personalidade, passados: sim.passados, total: sim.total });
        continue;
      }
      const e = porUsuario.get(p.usuarioId);
      const time = doTime(p.id);
      const temCodigoAqui = Boolean(String(e?.codigo || "").trim());
      // na colaborativa, os testes são os do programa do time (quem não escreveu a parte fica sem nota)
      const r = time ? (temCodigoAqui ? { passados: time.passados, total: time.total, fracao: time.fracao } : { passados: 0, total: 0, fracao: 0 }) : resumoDosTestes(e?.testes);
      humanos.push({
        id: p.id, apelido: apelidoDe.get(p.id), nome: p.nome, linguagem: e?.linguagem || null, modo: e?.modo || null, plano: e?.plano || "",
        codigo: e?.codigo || "", testes: { passados: r.passados, total: r.total }, enviou: Boolean(e?.enviada_em), fracao: r.fracao, testou: r.total > 0,
        temCodigo: Boolean(String(e?.codigo || "").trim()),
        linguagemOk: !desafio.linguagem || !e?.linguagem || e.linguagem === desafio.linguagem, commitSha: e?.commit_sha || null,
      });
    }

    let ia = null;
    if (temModelo()) {
      try {
        const apelidos = new Map(humanos.map((h) => [h.apelido, { id: h.id, fracao: h.fracao, testou: h.testou, codigo: h.codigo }]));
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
      // o sorteio das falas de reserva também fica preso à rodada e ao competidor
      const s = sorteio(sementeDe(`review:${rodada.id}:${p.id}`));
      if (p.tipo === "npc") {
        const sim = sims.get(p.id);
        const npc = npcDoTorneio(p, t);
        notasDele = notasDoNpc(npc, sim);
        feedback = feedbackDoNpc(npc, sim);
        testes = { passados: sim.passados, total: sim.total };
        // na colaborativa, o review mostra a parte que ele escreveu de verdade (a boa, ou a do bug)
        const daParte = doTime(p.id)?.npcs.get(p.id);
        const review = daParte?.codigo ? reviewDaParteDoNpc({ codigo: daParte.codigo, acertou: Object.values(daParte.acertos).every(Boolean), s }) : [];
        extra = { fala: ia?.falas.get(apelidoDe.get(p.id)) || p.bordao || "", enviou: true, minutos: sim.minutos, review: review.length ? review : reviewDoNpc(p.npcId, sim, s) };
      } else {
        const h = humanos.find((x) => x.id === p.id);
        const daIa = ia?.porHumano.get(p.id);
        const auto = avaliacaoAutomatica({ enviou: h.enviou, testou: h.testou, fracao: h.fracao, plano: h.plano, linguagemOk: h.linguagemOk, temCodigo: h.temCodigo });
        notasDele = daIa?.notas || auto.notas;
        feedback = Object.fromEntries(Object.keys(auto.feedback).map((j) => [j, daIa?.feedback?.[j] || auto.feedback[j]]));
        testes = h.testes;
        // o code review: o da IA (linhas do código de verdade) ou, sem ela, um item por jurado com as falas do banco
        const temPlano = h.plano.trim().length >= BOOTCAMP.minimoDoPlano;
        const review = daIa?.review?.length ? daIa.review : reviewAutomatica({
          codigo: h.codigo, fracao: h.fracao, enviou: h.enviou, linguagemOk: h.linguagemOk, temPlano, s,
        });
        // a despedida (se sair nesta rodada): os pontos fortes e fracos e a entrevista com a apresentadora
        const auto2 = pontosAutomaticos({ notas: notasDele, testes: h.testes, enviou: h.enviou, temPlano, linguagemOk: h.linguagemOk, temCodigo: h.temCodigo });
        extra = {
          enviou: h.enviou, linguagem: h.linguagem, modo: h.modo, commitSha: h.commitSha, review,
          pontosFortes: daIa?.pontosFortes?.length ? daIa.pontosFortes : auto2.fortes,
          pontosFracos: daIa?.pontosFracos?.length ? daIa.pontosFracos : auto2.fracos,
          despedida: daIa?.despedida?.length ? daIa.despedida : despedidaAutomatica({ nome: p.nome, notas: notasDele, testes: h.testes, s }),
        };
      }
      const nota = notaDaRodada(notasDele);
      notas.set(p.id, { nota, kernel: notasDele.kernel });
      return { id: p.id, nome: p.nome, tipo: p.tipo, notas: notasDele, feedback, nota, testes, ...extra };
    });

    // o resultado: na temporada, pelo tipo da prova; nos modos rápidos, como antes (com o "melhor da rodada")
    const temporada = t.formato === "temporada";
    const res = temporada
      ? aplicarResultadoDaProva({ prova: { ...prova, competidores: lista.map((p) => p.id) }, participantes: t.participantes, notas, numero: rodada.numero })
      : aplicarResultado({ formato: t.formato, participantes: t.participantes, confrontos: rodada.confrontos || [], notas, numero: rodada.numero, total: t.rodadas_total });
    const folgas = new Set((rodada.confrontos || []).filter((c) => !c.b).map((c) => c.a));
    const resultadoDe = (pid) => {
      if (!temporada) return res.eliminados.includes(pid) ? "eliminado" : folgas.has(pid) ? "folga" : t.formato === "mata-mata" ? "avancou" : "pontuou";
      if (prova.tipo === "final") return pid === res.campeao ? "campeao" : "vice";
      if (prova.tipo === "eliminacao") return res.eliminados.includes(pid) ? "eliminado" : "sobreviveu";
      return res.salvos.includes(pid) ? "salvo" : "ameacado";
    };
    const insigniaDaProva = temporada ? (prova.tipo === "final" ? "final" : prova.tipo) : "rodada";
    const avaliacao = {
      origem: ia ? "jurados" : "automatica",
      comentarioGeral: ia?.comentarioGeral || "Os jurados conferiram os testes, o plano e as regras de cada entrega.",
      prova: { tipo: prova.tipo, episodio: prova.episodio },
      participantes: avaliados.map((a) => {
        const base = { ...a, resultado: resultadoDe(a.id), insignia: (res.vencedores || []).includes(a.id) ? insigniaDaProva : null };
        if (base.resultado !== "eliminado" || a.tipo !== "npc") return base;
        const p = t.participantes.find((x) => x.id === a.id);
        const npc = p && npcDoTorneio(p, t);
        const pontos = pontosAutomaticos({ notas: a.notas, testes: a.testes, enviou: true, temPlano: true, linguagemOk: true });
        return {
          ...base, pontosFortes: pontos.fortes, pontosFracos: pontos.fracos,
          despedida: npc ? despedidaDoNpc({ npc: { ...npc, nome: p.nome }, notas: a.notas, testes: a.testes, area: desafio.area, s: sorteio(sementeDe(`despedida:${rodada.id}:${a.id}`)) }) : [],
        };
      }),
      eliminados: res.eliminados, avancaram: res.avancaram || [], campeao: res.campeao,
      vencedores: res.vencedores || [], salvos: res.salvos || [],
      // na colaborativa, cada time leva o resultado do programa dele e quem não entregou a parte
      equipes: res.equipes ? res.equipes.map((e) => {
        const r = integracao?.get(e.id);
        return r ? { ...e, integracao: { passados: r.passados, total: r.total, faltou: r.faltou.map((pid) => t.participantes.find((x) => x.id === pid)?.nome || "?") } } : e;
      }) : null,
    };
    // o que a temporada lembra para a próxima prova: quem se salvou da eliminação e quem venceu (o capitão)
    const estado = {
      ...(t.estado || {}),
      salvos: temporada && (prova.tipo === "imunidade" || prova.tipo === "equipe") ? res.salvos : [],
      ultimoVencedor: (res.vencedores || [])[0] || null,
    };
    const agora = new Date().toISOString();
    const { error: e1 } = await supabase.from("proof_bootcamp_rodadas").update({ status: "avaliada", avaliacao, avaliada_em: agora }).eq("id", rodada.id).eq("status", "avaliando");
    falhou(e1, "rodada");
    const { error: e2 } = await supabase.from("proof_bootcamp_torneios").update({
      participantes: res.participantes, estado, atualizado_em: agora,
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
