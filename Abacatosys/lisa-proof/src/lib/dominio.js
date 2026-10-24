// O Modo Domínio no banco (24/10/2026): analisar o repositório, montar a torre, preparar a branch,
// abrir o desafio de cada andar, avaliar cada entrega (um commit) e pagar os prêmios. As regras
// moram em src/dominio/modoDominio.js; a IA em src/lib/iaDominio.js; o GitHub e o GitLab em
// src/lib/repositorios.js.
//
// A torre é sempre do mundo de verdade: os pontos dos andares entram no livro de pontos (viram
// moedas, ranking e ofensiva) e os prêmios dos marcos vão para o Reino de verdade.
//
// Cada passo que gasta IA tem trava contra o clique duplo: a gravação só vale "onde ainda está
// como eu li" (o status da torre, o número de tentativas do andar, o andar de agora). Quem perde
// a corrida recebe 409 e não paga prêmio duas vezes.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { registrarEvento, registrarOuMelhorar, estudouHoje, depoisDePontuar, resultadoDaPontuacao } from "./estudo.js";
import { lerRepositorio, pontaDaBranch, mudancasEntre, enderecoOuErro, ErroDoRepositorio } from "./repositorios.js";
import { analisarRepositorio, montarTorre as montarComIA, detalharDesafio, avaliarEntrega } from "./iaDominio.js";
import { temModelo } from "./ia.js";
import { premiarDoDominio } from "./reino.js";
import { linkDoCommit } from "@/dominio/enderecoDoRepo.js";
import { nomePublico } from "@/dominio/ranking.js";
import {
  NIVEIS, andaresPermitidos, andaresEscolhidos, chefoesDaTorre, nomeDoChefao, sementeDe, pontosDoAndar, pontosDoTopo,
  atributosDoNeuro, roteiroDaLuta, premiosDaTorre, premiosDoAndar, branchSugerida, branchValida, codigoDoCertificado,
  codigoValido, mediaDasNotas, chefaoPorId,
} from "@/dominio/modoDominio.js";

const CAMPOS = "id, usuario_id, provedor, repo_caminho, repo_url, repo_branch, analise, nivel, status, andares, andar_atual, chefao_final, entrega_url, entrega_branch, commit_base, premios, certificado, criado_em, atualizado_em, concluido_em";
const CAMPOS_DO_ANDAR = "numero, titulo, objetivo, assunto, dificuldade, chefao, chefao_nome, desafio, commit_inicio, ultimo_commit, entregas, tentativas, melhor_nota, atributos, vencido_em";

/** Quantas torres por dia a pessoa pode pedir para analisar (cada análise lê o repositório e gasta IA). */
const ANALISES_POR_DIA = 6;
/** Quantas entregas de um mesmo andar a Lisa avalia por dia. */
const ENTREGAS_POR_DIA = 8;
/** Uma torre presa em "montando" (a montagem caiu no meio) pode ser montada de novo depois disto. */
const MONTAGEM_PRESA_MS = 4 * 60_000;
const DIA_MS = 24 * 3_600_000;

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/** O erro do GitHub/GitLab vira 400 (a pessoa conserta o link ou a branch); o da IA, 502. */
function traduzir(e) {
  if (e instanceof ErroDeAcesso) return e;
  if (e instanceof ErroDoRepositorio) return new ErroDeAcesso(400, e.message);
  return new ErroDeAcesso(502, `a Lisa não conseguiu agora (${e?.message || "erro"}) — tente de novo`);
}

async function comTraducao(fn) {
  try {
    return await fn();
  } catch (e) {
    throw traduzir(e);
  }
}

function exigirIA() {
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");
}

const ehId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));

// ---------------------------------------------------------------- leitura

async function torreDoUsuario(id, usuarioId) {
  if (!ehId(id)) throw new ErroDeAcesso(404, "torre não encontrada");
  const { data, error } = await supabase.from("proof_dominios").select(CAMPOS).eq("id", id).maybeSingle();
  falhou(error, "torre");
  if (!data || data.usuario_id !== usuarioId) throw new ErroDeAcesso(404, "torre não encontrada");
  return data;
}

async function andaresDa(dominioId) {
  const { data, error } = await supabase.from("proof_dominio_andares").select(CAMPOS_DO_ANDAR)
    .eq("dominio_id", dominioId).order("numero");
  falhou(error, "andares");
  return data || [];
}

async function andarDa(dominioId, numero) {
  const { data, error } = await supabase.from("proof_dominio_andares").select(CAMPOS_DO_ANDAR)
    .eq("dominio_id", dominioId).eq("numero", numero).maybeSingle();
  falhou(error, "andar");
  if (!data) throw new ErroDeAcesso(404, "andar não encontrado");
  return data;
}

function exigirStatus(torre, ...status) {
  if (status.includes(torre.status)) return;
  const motivo = {
    analisado: "a torre ainda não foi montada",
    montando: "a Lisa ainda está montando a torre",
    ativo: "a torre já foi montada",
    concluido: "esta torre já foi conquistada",
  }[torre.status];
  throw new ErroDeAcesso(409, motivo || "a torre não está pronta para isso");
}

/** O cartão de uma torre na lista. */
function resumoDa(t) {
  return {
    id: t.id,
    repo: t.repo_caminho,
    provedor: t.provedor,
    url: t.repo_url,
    nivel: t.nivel,
    nomeDoNivel: NIVEIS[t.nivel]?.nome || "",
    status: t.status,
    andares: t.andares,
    andarAtual: t.andar_atual,
    vencidos: t.status === "concluido" ? t.andares : Math.max(0, (t.andar_atual || 1) - 1),
    chefaoFinal: t.chefao_final,
    tecnologias: t.analise?.tecnologias || [],
    certificado: t.certificado,
    criadoEm: t.criado_em,
    concluidoEm: t.concluido_em,
  };
}

export async function listarDominios(usuarioId) {
  const { data, error } = await supabase.from("proof_dominios").select(CAMPOS)
    .eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(40);
  falhou(error, "torres");
  return (data || []).map(resumoDa);
}

/** Uma entrega como a tela mostra (o link do commit avaliado). */
const entregaParaTela = (torre, e) => ({ ...e, link: linkDoCommit(torre.entrega_url || torre.repo_url, e.sha) });

/** A torre inteira para a tela: andares, o andar de agora, o Neuro, os prêmios e o certificado. */
export async function torreParaTela(usuarioId, id, usuario = null) {
  const torre = await torreDoUsuario(id, usuarioId);
  const andares = torre.status === "analisado" || torre.status === "montando" ? [] : await andaresDa(id);
  const vencidos = andares.filter((a) => a.vencido_em);
  const neuro = atributosDoNeuro(vencidos.map((a) => ({ atributos: a.atributos, dificuldade: a.dificuldade })));
  const recebidos = new Set((torre.premios || []).map((p) => p.andar));
  const atual = andares.find((a) => a.numero === torre.andar_atual) || null;
  const lista = andares.map((a) => ({
    numero: a.numero, titulo: a.titulo, objetivo: a.objetivo, assunto: a.assunto, dificuldade: a.dificuldade,
    chefao: a.chefao, chefaoNome: a.chefao_nome, vencido: Boolean(a.vencido_em), melhorNota: a.melhor_nota,
    tentativas: a.tentativas,
  }));
  const concluida = torre.status === "concluido";
  return {
    ...resumoDa(torre),
    analise: torre.analise,
    permitido: andaresPermitidos(torre.nivel),
    branchSugerida: branchSugerida(torre.repo_caminho),
    entrega: torre.entrega_url ? { url: torre.entrega_url, branch: torre.entrega_branch, base: torre.commit_base } : null,
    andaresDaTorre: lista,
    atual: atual && !concluida ? {
      numero: atual.numero, titulo: atual.titulo, objetivo: atual.objetivo, assunto: atual.assunto,
      dificuldade: atual.dificuldade, chefao: atual.chefao, chefaoNome: atual.chefao_nome,
      desafio: atual.desafio, commitInicio: atual.commit_inicio,
      linkDoInicio: atual.commit_inicio ? linkDoCommit(torre.entrega_url || torre.repo_url, atual.commit_inicio) : null,
      entregas: (atual.entregas || []).map((e) => entregaParaTela(torre, e)).reverse(),
      tentativas: atual.tentativas, melhorNota: atual.melhor_nota,
      pontosEmJogo: pontosDoAndar(100, atual.dificuldade, torre.nivel),
    } : null,
    neuro,
    premios: torre.andares
      ? premiosDaTorre(torre.andares, torre.nivel, torre.chefao_final).map((m) => ({ ...m, recebido: recebidos.has(m.andar) }))
      : [],
    premiosRecebidos: torre.premios || [],
    pontosDoTopo: torre.andares ? pontosDoTopo(torre.nivel, torre.andares) : 0,
    certificado: concluida ? {
      codigo: torre.certificado,
      nome: usuario?.nome || "",
      media: mediaDasNotas(lista),
      concluidoEm: torre.concluido_em,
      assuntos: torre.analise?.assuntos || [],
    } : null,
  };
}

// ---------------------------------------------------------------- analisar e montar

/** Lê o repositório e pergunta à Lisa se ele dá uma torre. Apto, a torre nasce "analisada". */
export async function analisarDominio(usuarioId, link) {
  exigirIA();
  const endereco = comTraducaoSincrona(() => enderecoOuErro(link));

  // o mesmo repositório com uma torre em andamento: volta para ela, em vez de abrir outra
  const { data: mesmas, error: e1 } = await supabase.from("proof_dominios").select("id, status")
    .eq("usuario_id", usuarioId).eq("provedor", endereco.provedor).eq("repo_caminho", endereco.caminho).neq("status", "concluido");
  falhou(e1, "torres");
  if (mesmas?.length) return { jaExistia: true, id: mesmas[0].id };

  const { count, error: e2 } = await supabase.from("proof_dominios").select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId).gte("criado_em", new Date(Date.now() - DIA_MS).toISOString());
  falhou(e2, "torres");
  if ((count || 0) >= ANALISES_POR_DIA) throw new ErroDeAcesso(429, `são até ${ANALISES_POR_DIA} torres novas por dia — amanhã tem mais`);

  const repo = await comTraducao(() => lerRepositorio(link));
  const analise = await comTraducao(() => analisarRepositorio(repo));
  if (!analise.apto) return { apto: false, analise, repo: { caminho: repo.caminho, url: repo.url } };

  const { data, error } = await supabase.from("proof_dominios").insert({
    usuario_id: usuarioId, provedor: repo.provedor, repo_caminho: repo.caminho, repo_url: repo.url,
    repo_branch: repo.branch, analise, nivel: analise.complexidade, status: "analisado",
  }).select("id").single();
  falhou(error, "torre");
  return { apto: true, id: data.id, analise };
}

function comTraducaoSincrona(fn) {
  try {
    return fn();
  } catch (e) {
    throw traduzir(e);
  }
}

/** A Lisa monta os `pedido` andares (dentro do que o nível permite) e a escalada começa. */
export async function montarDominio(usuarioId, id, pedido) {
  exigirIA();
  const torre = await torreDoUsuario(id, usuarioId);
  const presa = torre.status === "montando" && Date.now() - new Date(torre.atualizado_em).getTime() > MONTAGEM_PRESA_MS;
  if (!presa) exigirStatus(torre, "analisado");
  const n = andaresEscolhidos(pedido, torre.nivel);
  if (!n) throw new ErroDeAcesso(400, "quantos andares?");

  // a trava: só uma montagem por vez (o segundo clique encontra "montando")
  const { data: trava, error: e1 } = await supabase.from("proof_dominios")
    .update({ status: "montando", atualizado_em: new Date().toISOString() })
    .eq("id", id).eq("status", torre.status).eq("atualizado_em", torre.atualizado_em).select("id");
  falhou(e1, "torre");
  if (!trava?.length) throw new ErroDeAcesso(409, "a Lisa já está montando esta torre");

  try {
    const chefoes = chefoesDaTorre(n, sementeDe(id));
    const roteiro = await comTraducao(() => montarComIA({ repo: { url: torre.repo_url }, analise: torre.analise, n, chefoes }));
    await supabase.from("proof_dominio_andares").delete().eq("dominio_id", id); // sobra de uma montagem que caiu
    const { error: e2 } = await supabase.from("proof_dominio_andares").insert(roteiro.map((a, i) => ({
      dominio_id: id, numero: a.numero, titulo: a.titulo, objetivo: a.objetivo, assunto: a.assunto,
      dificuldade: a.dificuldade, chefao: chefoes[i], chefao_nome: nomeDoChefao(chefoes[i], a.epiteto),
      // com a branch já preparada, o primeiro andar começa da ponta dela
      commit_inicio: i === 0 ? torre.commit_base : null,
    })));
    falhou(e2, "andares");
    const { error: e3 } = await supabase.from("proof_dominios").update({
      status: "ativo", andares: n, andar_atual: 1, chefao_final: chefoes[n - 1], atualizado_em: new Date().toISOString(),
    }).eq("id", id);
    falhou(e3, "torre");
  } catch (e) {
    await supabase.from("proof_dominios").update({ status: "analisado", atualizado_em: new Date().toISOString() }).eq("id", id);
    throw e;
  }
  return torreParaTela(usuarioId, id);
}

/** Apagar uma torre que ainda não foi conquistada (os pontos já ganhos ficam). */
export async function apagarDominio(usuarioId, id) {
  const torre = await torreDoUsuario(id, usuarioId);
  if (torre.status === "concluido") throw new ErroDeAcesso(409, "torre conquistada não se apaga: ela guarda o seu certificado");
  const { error } = await supabase.from("proof_dominios").delete().eq("id", id).eq("usuario_id", usuarioId);
  falhou(error, "apagar torre");
}

// ---------------------------------------------------------------- a branch do desafio

/**
 * Onde a pessoa trabalha: o repositório (o mesmo ou um fork, público) e a branch do desafio. A
 * Lisa confere que a branch existe e marca a ponta dela: o andar de agora passa a comparar dali.
 */
export async function configurarEntrega(usuarioId, id, { repo, branch }) {
  const torre = await torreDoUsuario(id, usuarioId);
  exigirStatus(torre, "analisado", "ativo");
  const nome = String(branch || "").trim();
  if (!branchValida(nome)) throw new ErroDeAcesso(400, "nome de branch inválido");
  const endereco = comTraducaoSincrona(() => enderecoOuErro(repo || torre.repo_url));
  const ponta = await comTraducao(() => pontaDaBranch(endereco.url, nome));

  const { error } = await supabase.from("proof_dominios").update({
    entrega_url: endereco.url, entrega_branch: nome, commit_base: ponta.sha, atualizado_em: new Date().toISOString(),
  }).eq("id", id);
  falhou(error, "torre");
  if (torre.status === "ativo") {
    const { error: e2 } = await supabase.from("proof_dominio_andares")
      .update({ commit_inicio: ponta.sha, ultimo_commit: null })
      .eq("dominio_id", id).eq("numero", torre.andar_atual).is("vencido_em", null);
    falhou(e2, "andar");
  }
  return torreParaTela(usuarioId, id);
}

// ---------------------------------------------------------------- o desafio do andar

/** O desafio do andar de agora; a Lisa escreve na primeira vez, lendo o código onde o andar começa. */
export async function abrirDesafio(usuarioId, id) {
  const torre = await torreDoUsuario(id, usuarioId);
  exigirStatus(torre, "ativo");
  const andar = await andarDa(id, torre.andar_atual);
  if (andar.desafio) return torreParaTela(usuarioId, id);
  exigirIA();

  const ondeLer = andar.commit_inicio && torre.entrega_url
    ? { link: torre.entrega_url, ref: andar.commit_inicio }
    : { link: torre.repo_url, ref: torre.repo_branch };
  const repo = await comTraducao(() => lerRepositorio(ondeLer.link, { ref: ondeLer.ref }));
  const anteriores = torre.andar_atual > 1
    ? (await supabase.from("proof_dominio_andares").select("numero, titulo").eq("dominio_id", id)
        .lt("numero", torre.andar_atual).order("numero")).data?.map((a) => `${a.numero}. ${a.titulo}`) || []
    : [];
  const desafio = await comTraducao(() => detalharDesafio({ repo, analise: torre.analise, andar, n: torre.andares, anteriores }));

  // dois cliques ao mesmo tempo: vale o primeiro desafio gravado
  const { error } = await supabase.from("proof_dominio_andares").update({ desafio })
    .eq("dominio_id", id).eq("numero", andar.numero).is("desafio", null);
  falhou(error, "desafio");
  return torreParaTela(usuarioId, id);
}

// ---------------------------------------------------------------- a entrega e a luta

function novoCodigo() {
  return codigoDoCertificado(crypto.getRandomValues(new Uint8Array(12)));
}

/**
 * A entrega do andar: a Lisa lê o que mudou na branch desde o começo do andar, dá a nota e mede
 * cada habilidade; o Neuro luta com o chefão (60+ vence). Vencendo, a torre sobe, o marco paga o
 * prêmio e, no topo, sai o certificado. A melhor nota de cada andar vale pontos (moedas, ranking e
 * ofensiva) — como no exercício, refazer só sobe.
 */
export async function entregarAndar(usuarioId, id) {
  exigirIA();
  const torre = await torreDoUsuario(id, usuarioId);
  exigirStatus(torre, "ativo");
  if (!torre.entrega_url || !torre.entrega_branch) throw new ErroDeAcesso(400, "prepare a branch do desafio primeiro");
  const andar = await andarDa(id, torre.andar_atual);
  if (!andar.desafio) throw new ErroDeAcesso(400, "abra o desafio do andar primeiro");
  if (andar.vencido_em) throw new ErroDeAcesso(409, "este andar já foi vencido — atualize a página");
  if (!andar.commit_inicio) throw new ErroDeAcesso(400, "prepare a branch do desafio de novo: falta o ponto de partida do andar");

  const hoje = Date.now() - DIA_MS;
  const doDia = (andar.entregas || []).filter((e) => new Date(e.quando).getTime() > hoje).length;
  if (doDia >= ENTREGAS_POR_DIA) throw new ErroDeAcesso(429, `são até ${ENTREGAS_POR_DIA} entregas por andar a cada 24 horas — descanse e volte depois`);

  const ponta = await comTraducao(() => pontaDaBranch(torre.entrega_url, torre.entrega_branch));
  const curto = ponta.sha.slice(0, 7);
  if (ponta.sha === andar.commit_inicio) {
    throw new ErroDeAcesso(400, `nenhum commit novo na branch ${torre.entrega_branch} desde o começo do andar — faça o commit e o git push`);
  }
  if (ponta.sha === andar.ultimo_commit) {
    throw new ErroDeAcesso(400, `o commit ${curto} já foi avaliado — melhore, faça um commit novo e envie de novo`);
  }
  const mudancas = await comTraducao(() => mudancasEntre(torre.entrega_url, andar.commit_inicio, ponta.sha));
  if (!mudancas.arquivos.length) throw new ErroDeAcesso(400, `o commit ${curto} não mudou nenhum arquivo em relação ao começo do andar`);

  const estudavaAntes = await estudouHoje(usuarioId);
  const avaliacao = await comTraducao(() => avaliarEntrega({ repo: torre.entrega_url, andar, desafio: andar.desafio, mudancas }));
  const tentativa = (andar.tentativas || 0) + 1;
  const luta = roteiroDaLuta({
    nota: avaliacao.nota, atributos: avaliacao.atributos, dificuldade: andar.dificuldade,
    semente: sementeDe(`${id}:${andar.numero}:${tentativa}`),
  });
  const agora = new Date().toISOString();
  const entrega = {
    sha: ponta.sha, quando: agora, nota: avaliacao.nota, venceu: avaliacao.venceu, atributos: avaliacao.atributos,
    comentario: avaliacao.comentario, pontosFortes: avaliacao.pontosFortes, melhorar: avaliacao.melhorar,
    arquivos: mudancas.arquivos.length, commits: mudancas.commits.length, golpes: luta.golpes,
  };
  const melhorou = avaliacao.nota > (andar.melhor_nota ?? -1);

  // a trava: o número de tentativas que eu li (duas entregas ao mesmo tempo, só uma grava)
  const { data: gravou, error: e1 } = await supabase.from("proof_dominio_andares").update({
    entregas: [...(andar.entregas || []), entrega].slice(-10),
    tentativas: tentativa,
    ultimo_commit: ponta.sha,
    melhor_nota: melhorou ? avaliacao.nota : andar.melhor_nota,
    atributos: melhorou ? avaliacao.atributos : andar.atributos,
    vencido_em: avaliacao.venceu ? agora : null,
  }).eq("dominio_id", id).eq("numero", andar.numero).eq("tentativas", andar.tentativas || 0).select("numero");
  falhou(e1, "entrega");
  if (!gravou?.length) throw new ErroDeAcesso(409, "outra entrega deste andar acabou de ser avaliada — atualize a página");

  const repoNome = torre.repo_caminho;
  let ganhou = 0;
  const pontos = pontosDoAndar(avaliacao.nota, andar.dificuldade, torre.nivel);
  if (pontos > 0) {
    ganhou += await registrarOuMelhorar({
      usuarioId, trilhaId: null, tipo: "dominio", chave: `dominio:${id}:${andar.numero}`, pontos,
      detalhe: { titulo: `${repoNome} · andar ${andar.numero}: ${andar.titulo}`, nota: avaliacao.nota, dominio: id },
    });
  }

  const resultado = { venceu: avaliacao.venceu, andar: andar.numero, concluiu: false, premios: [], certificado: null, pontosDoMarco: 0 };
  if (avaliacao.venceu) {
    const final = andar.numero >= torre.andares;
    const codigo = final ? novoCodigo() : null;
    // a trava dos prêmios: só quem move a torre do andar que leu paga o marco
    const { data: subiu, error: e2 } = await supabase.from("proof_dominios").update({
      andar_atual: final ? torre.andares : andar.numero + 1,
      status: final ? "concluido" : "ativo",
      ...(final ? { concluido_em: agora, certificado: codigo } : {}),
      atualizado_em: agora,
    }).eq("id", id).eq("andar_atual", andar.numero).eq("status", "ativo").select("id");
    falhou(e2, "torre");
    if (subiu?.length) {
      resultado.concluiu = final;
      resultado.certificado = codigo;
      if (!final) {
        // o próximo andar começa do commit que venceu este
        await supabase.from("proof_dominio_andares").update({ commit_inicio: ponta.sha })
          .eq("dominio_id", id).eq("numero", andar.numero + 1);
      }
      const marco = await pagarMarco({ usuarioId, torre, numero: andar.numero, final });
      ganhou += marco.pontos;
      resultado.premios = marco.entregues;
      resultado.pontosDoMarco = marco.pontos;
    }
  }

  const extra = await depoisDePontuar({ usuarioId, trilhaId: null, estudavaAntes, ganhou });
  return {
    ...resultado,
    entrega: entregaParaTela(torre, entrega),
    chefao: { id: andar.chefao, nome: andar.chefao_nome, emoji: chefaoPorId(andar.chefao)?.emoji || "👾" },
    ...resultadoDaPontuacao(ganhou, extra),
  };
}

/** O prêmio do marco (se o andar é um) e, no topo, o bônus do topo. Grava o que foi pago na torre. */
async function pagarMarco({ usuarioId, torre, numero, final }) {
  const premios = premiosDoAndar(numero, torre.andares, torre.nivel, torre.chefao_final);
  let pontos = 0;
  const entregues = [];
  for (const p of premios.filter((x) => x.tipo === "pontos")) {
    const ganho = await registrarEvento({
      usuarioId, trilhaId: null, tipo: "dominio", chave: `dominio:${torre.id}:marco:${numero}`, pontos: p.pontos,
      detalhe: { titulo: `${torre.repo_caminho} · marco do andar ${numero}`, dominio: torre.id },
    });
    pontos += ganho;
    entregues.push({ tipo: "pontos", pontos: ganho });
  }
  if (final) {
    const ganho = await registrarEvento({
      usuarioId, trilhaId: null, tipo: "dominio", chave: `dominio:${torre.id}:topo`, pontos: pontosDoTopo(torre.nivel, torre.andares),
      detalhe: { titulo: `${torre.repo_caminho} · topo da torre`, dominio: torre.id },
    });
    pontos += ganho;
    entregues.push({ tipo: "topo", pontos: ganho });
  }
  try {
    entregues.push(...await premiarDoDominio(usuarioId, premios, { dominio: torre.id, andar: numero }));
  } catch {
    // o Reino não aceitou agora: fica anotado como pendente (a tela avisa), os pontos já entraram
    entregues.push({ tipo: "pendente", premios: premios.filter((p) => !["pontos", "certificado"].includes(p.tipo)) });
  }
  if (premios.some((p) => p.tipo === "certificado")) entregues.push({ tipo: "certificado" });
  if (premios.length || final) {
    await supabase.from("proof_dominios").update({
      premios: [...(torre.premios || []), { andar: numero, quando: new Date().toISOString(), entregues }],
    }).eq("id", torre.id);
  }
  return { pontos, entregues };
}

// ---------------------------------------------------------------- o certificado público

/**
 * A conferência de um certificado pelo código (sem login): quem recebe o PDF confere que ele
 * existe. Só o nome público (apelido ou "Primeiro I."), nunca o nome completo nem o e-mail.
 */
export async function certificadoPublico(codigo) {
  const c = String(codigo || "").toUpperCase();
  if (!codigoValido(c)) throw new ErroDeAcesso(404, "certificado não encontrado");
  const { data: torre, error } = await supabase.from("proof_dominios").select(CAMPOS)
    .eq("certificado", c).eq("status", "concluido").maybeSingle();
  falhou(error, "certificado");
  if (!torre) throw new ErroDeAcesso(404, "certificado não encontrado");
  const [andares, usuario, perfil] = await Promise.all([
    andaresDa(torre.id),
    supabase.from("abacato_usuarios").select("nome").eq("id", torre.usuario_id).maybeSingle(),
    supabase.from("proof_perfis").select("apelido").eq("usuario_id", torre.usuario_id).maybeSingle(),
  ]);
  const lista = andares.map((a) => ({ vencido: Boolean(a.vencido_em), melhorNota: a.melhor_nota }));
  return {
    codigo: c,
    nome: nomePublico({ nome: usuario.data?.nome, apelido: perfil.data?.apelido }),
    repo: torre.repo_caminho,
    url: torre.repo_url,
    provedor: torre.provedor,
    nivel: torre.nivel,
    nomeDoNivel: NIVEIS[torre.nivel]?.nome || "",
    andares: torre.andares,
    media: mediaDasNotas(lista),
    tecnologias: torre.analise?.tecnologias || [],
    assuntos: torre.analise?.assuntos || [],
    chefaoFinal: torre.chefao_final,
    concluidoEm: torre.concluido_em,
  };
}
