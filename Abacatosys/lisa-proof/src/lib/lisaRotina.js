// A Lisa joga o Proof (03/11/2026, BEYOND-0014), pela conta própria dela (CONTA_DA_LISA), chamando as mesmas
// funções que as telas chamam — sem atalho: ela ganha e perde pontos e moedas como qualquer jogador. A cada
// rodada, faz o que está na vez da agenda (src/dominio/lisaJogadora.js: algumas coisas mais de uma vez por dia)
// e anota no diário dela, que é a página pública /lisa.
//
// QUEM CHAMA: o relógio da nuvem — o gatilho de horário do Worker do Proof (worker-proof.js, a cada 30 minutos)
// chama POST /api/lisa/rodada, que roda rodadaDaLisa(). Antes era o crontab do iMac (que nunca chegou a ficar
// ligado; por isso ela parecia parada). O script scripts/lisa-joga.mjs continua servindo para rodar na mão.

import { supabase } from "@/lib/supabase.js";
import { idDaLisa, registrarNoDiario, jogadasDeHoje } from "@/lib/lisaJogadora.js";
import { arenaDe, jogadaDoRobo } from "@/lib/arena.js";
import { FASES_DA_ARENA, JOGOS_DA_ARENA } from "@/dominio/arena.js";
import { proporCurso } from "@/lib/iaCurso.js";
import { criarCurso } from "@/lib/cursos.js";
import { detalheDaTrilha } from "@/lib/trilhas.js";
import { marcarItem } from "@/lib/estudo.js";
import { obterOuCriarDesafio, desafioDoUsuario, responderQuiz, entregarEvidencia, entregarDiagrama, enviarExercicio, entregarProjetoEmArquivos } from "@/lib/pratica.js";
import { estadoDoReino, coletarMina, melhorarConstrucao, treinarTropas, alvosDe, invadir, saldoDoUsuario, renomearReino, comprarVeiculo } from "@/lib/reino.js";
import { estadoDasIlhas, comprarConchas, coletarIlhas, construirNaIlha, treinarTripulacao, atacarIlha, aceitarPacto } from "@/lib/ilhas.js";
import { estadoDaBolsa, comprarAcao } from "@/lib/bolsa.js";
import { criarMaterial } from "@/lib/acervo.js";
import { valesPendentes, resgatarVale } from "@/lib/vales.js";
import { criarCaderno, criarPagina } from "@/lib/cadernos.js";
import { conversar, textoDe } from "@/lib/gemini.js";
import { destinatarios, mandarPerguntaDoQuiz, mandarRecado, avaliarRecado } from "@/lib/correio.js";
import { assuntosParaODuracao } from "@/dominio/curso.js";
import { diaDe, somarDias } from "@/dominio/datas.js";
import { motorDo } from "@/dominio/motores.js";
import {
  CONTA_DA_LISA, temaDoMes, sorteio, sementeDe, chanceDeAcerto, respostasDoQuiz, oQueFazerAgora, proximasJogadas,
  itensDaTeoriaHoje, melhoriaDaVez, compraNaBolsa, alvoDaInvasao, documentoDoDiagrama, TIPOS_DO_DIAGRAMA,
} from "@/dominio/lisaJogadora.js";

let hoje = diaDe(); // o dia da rodada: renovado a cada rodadaDaLisa()
const carimbo = () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const log = (...p) => console.log(`[${carimbo()}] lisa-joga:`, ...p);
const sortearPara = (oQue) => sorteio(sementeDe(`${hoje}:${oQue}`));
const DIAS_DE_ESTUDO = [1, 2, 3, 4, 5, 6]; // segunda a sábado; domingo é do Acervo e do caderno
// o que ela prefere melhorar no Reino (a mina primeiro: é dela que vem a renda)
const PRIORIDADE = { mina: 6, cofre: 5, castelo: 4, quartel: 4, acampamento: 3, muralha: 3, torre: 3 };

/** Uma resposta curta do Gemini, em texto. */
async function escrever(pedido, { sistema, maxTokens = 2048 } = {}) {
  const parte = await conversar({ contents: [{ role: "user", parts: [{ text: pedido }] }], sistema, maxTokens, temperatura: 0.6 });
  const texto = textoDe(parte);
  if (!texto) throw new Error("o Gemini não devolveu texto");
  return texto;
}
const ESTUDANTE = "Você é a Lisa, uma estudante dedicada fazendo um curso no Proof. Escreva em português do Brasil, em primeira pessoa, como uma aluna (não como professora). Não invente links.";

// ---------------------------------------------------------------- a conta

const hexAleatorio = (n) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function criarConta() {
  const ja = await idDaLisa();
  if (ja) return log("a conta dela já existe:", ja.slice(0, 8));
  // senha que ninguém sabe: a conta não entra pela tela, só joga pelo relógio
  const { data, error } = await supabase.from("abacato_usuarios").insert({
    email: CONTA_DA_LISA.email, nome: CONTA_DA_LISA.nome,
    senha_hash: hexAleatorio(32), senha_sal: hexAleatorio(16),
    ativo: true, aprovado: true, tipo: "interno",
  }).select("id").single();
  if (error) throw new Error(`não consegui criar a conta: ${error.message}`);
  const { error: e2 } = await supabase.from("proof_perfis").upsert({
    usuario_id: data.id, apelido: CONTA_DA_LISA.apelido, no_ranking: true, meta_diaria: 30, robo: true,
  }, { onConflict: "usuario_id" });
  if (e2) throw new Error(`não consegui criar o perfil: ${e2.message}`);
  await registrarNoDiario(data.id, "conta", "Entrei no Proof! Vou fazer um curso de tecnologia por mês, os quizzes e exercícios do dia, e jogar o Reino.");
  log("conta criada:", data.id.slice(0, 8));
}

// ---------------------------------------------------------------- o curso do mês

/** A trilha em andamento dela (a mais nova ativa), com o detalhe e há quantos dias começou. */
async function trilhaAtual(id) {
  const { data } = await supabase.from("proof_trilhas").select("id, tema, inicio_em").eq("usuario_id", id).eq("status", "ativa")
    .order("inicio_em", { ascending: false }).limit(1);
  const t = data?.[0];
  if (!t) return null;
  const detalhe = await detalheDaTrilha({ usuarioId: id, trilhaId: t.id });
  const dias = Math.round((new Date(`${hoje}T12:00:00Z`) - new Date(`${t.inicio_em}T12:00:00Z`)) / 86400_000);
  return { ...t, detalhe, dias };
}

async function curso(id) {
  const atual = await trilhaAtual(id);
  // um curso novo quando não tem nenhum, quando o atual acabou, ou quando passou o mês dele
  if (atual && !atual.detalhe.avanco.concluida && atual.dias < 31) return null;
  const { data: anteriores } = await supabase.from("proof_trilhas").select("tema").eq("usuario_id", id);
  const tema = temaDoMes((anteriores || []).map((t) => t.tema));
  const r = await proporCurso({
    tema, nivel: "iniciante", semanas: 4, dias: 4 * DIAS_DE_ESTUDO.length,
    objetivo: "Entender os conceitos e aplicar no dia a dia de uma equipe de tecnologia.",
    assuntos: assuntosParaODuracao(4, DIAS_DE_ESTUDO.length),
  });
  if (!r.ok) throw new Error(`a proposta do curso falhou: ${r.erros.join("; ")}`);
  const criado = await criarCurso({ usuarioId: id, proposta: r.proposta, diasDeEstudo: DIAS_DE_ESTUDO });
  return { resumo: `Comecei o curso do mês: "${criado.nome.replace(/^STUDYs+/i, "")}" (${criado.assuntos} assuntos em 4 semanas).`, detalhe: { tema, trilhaId: criado.trilhaId } };
}

// ---------------------------------------------------------------- estudo e prática

async function teoria(id) {
  const atual = await trilhaAtual(id);
  if (!atual) return { resumo: "Sem curso em andamento para estudar hoje." };
  const itens = atual.detalhe.avanco.etapas
    // pode adiantar até uma semana (03/11/2026): sem isso, no começo do curso só havia o primeiro assunto
    .filter((e) => !e.bloqueada && (!e.inicio || e.inicio <= somarDias(hoje, 7)))
    .flatMap((e) => (e.checklists || []).flatMap((c) => c.itens.filter((i) => !i.feito).map((i) => ({ ...i, assunto: e.titulo }))));
  const quantos = itensDaTeoriaHoje(sortearPara("teoria"));
  const feitos = [];
  for (const item of itens.slice(0, quantos)) {
    try { await marcarItem({ usuarioId: id, itemId: item.id, feito: true }); feitos.push(item); } catch (e) { log("item não marcou:", e.message); }
  }
  if (!feitos.length) return { resumo: "Revisei a teoria; nada novo para marcar hoje." };
  return { resumo: `Estudei ${feitos.length} ${feitos.length === 1 ? "item" : "itens"} de teoria (${[...new Set(feitos.map((f) => f.assunto))].join(", ")}).`, detalhe: { itens: feitos.length } };
}

/** Os erros recentes (0 a 1): o que faltou para 100 nas notas dos últimos quizzes. */
async function errosRecentes(id) {
  const { data } = await supabase.from("proof_desafios").select("nota").eq("usuario_id", id).eq("tipo", "quiz").not("nota", "is", null)
    .order("periodo", { ascending: false }).limit(3);
  if (!data?.length) return 0;
  return data.reduce((s, d) => s + (100 - Number(d.nota)), 0) / data.length / 100;
}

async function quiz(id) {
  const atual = await trilhaAtual(id);
  if (!atual) return { resumo: "Sem curso, sem quiz hoje." };
  let { desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: "quiz", periodo: hoje });
  let d = await desafioDoUsuario(desafio.id, id);
  if (d.status === "concluido") {
    // as rodadas extras do dia (até 3, valem metade): como qualquer pessoa que quer mais pontos
    try {
      ({ desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: "quiz", periodo: hoje, novaRodada: true }));
      d = await desafioDoUsuario(desafio.id, id);
    } catch { return { resumo: `Já fiz as rodadas de quiz de hoje (a última com nota ${d.nota}).` }; }
    if (d.status === "concluido") return { resumo: `O quiz de hoje já estava feito (nota ${d.nota}).` };
  }
  const chance = chanceDeAcerto({ diasNoCurso: atual.dias, errosRecentes: await errosRecentes(id) });
  const perguntas = d.conteudo?.perguntas || [];
  const escolhas = respostasDoQuiz(perguntas, chance, sortearPara("quiz"));
  // às vezes uma pergunta vai pelo correio para alguém (BEYOND-0016) — ela manda, mas não recebe
  let peloCorreio = "";
  if (!d.resposta?.enviadas?.length && sortearPara("quiz-correio")() < 0.4) {
    try {
      const lista = (await destinatarios(id)).filter((x) => !x.robo);
      const alvo = lista[Math.floor(sortearPara("quiz-alvo")() * lista.length)];
      if (alvo) { await mandarPerguntaDoQuiz(id, d.id, { indice: 0, paraId: alvo.id }); peloCorreio = ` Mandei uma pergunta pelo correio para ${alvo.nome}.`; d = await desafioDoUsuario(d.id, id); }
    } catch (e) { log("quiz pelo correio:", e.message); }
  }
  const respondidas = { ...(d.resposta?.escolhas || {}) };
  for (const i of d.resposta?.enviadas || []) respondidas[i] = "correio";
  let fim = null;
  for (let i = 0; i < perguntas.length; i++) {
    if (respondidas[i] !== undefined) continue;
    fim = await responderQuiz({ usuarioId: id, id: d.id, indice: i, escolha: escolhas[i] });
  }
  d = await desafioDoUsuario(d.id, id);
  return {
    resumo: `Fiz o quiz do dia sobre "${fim?.assunto?.titulo || atual.tema}": ${fim?.acertos ?? "?"} de ${perguntas.length - (d.resposta?.enviadas?.length || 0)} (nota ${d.nota ?? "?"}).${peloCorreio}`,
    detalhe: { nota: d.nota, chance },
  };
}

/** O texto da entrega (exercício aberto ou projeto): bom no geral, e às vezes deixa um ponto de fora. */
async function textoDaEntrega(conteudo, { chance, sortear, projeto = false }) {
  const descuido = sortear() > chance;
  const pedido = `${projeto ? "PROJETO" : "EXERCÍCIO"} do meu curso (em JSON):\n${JSON.stringify(conteudo).slice(0, 6000)}\n\n` +
    `Escreva a MINHA entrega em texto, cobrindo ${projeto ? "os requisitos" : "o que o enunciado pede"}, com exemplos concretos.` +
    `${descuido ? " Como estudante ainda aprendendo, deixe UM dos pontos pedidos superficial (sem dizer isso)." : ""} Entre 250 e 600 palavras.`;
  return escrever(pedido, { sistema: ESTUDANTE, maxTokens: 3000 });
}
const entregaDeTexto = (texto) => ({ texto, video: null, imagens: [], audio: null, pdf: null });

/** O código do exercício: o que ela escreveria (às vezes com um descuido, como quem está aprendendo). */
async function codigoDaEntrega(conteudo, { chance, sortear }) {
  const descuido = sortear() > chance;
  const texto = await escrever(`EXERCÍCIO DE PROGRAMAÇÃO do meu curso (em JSON):
${JSON.stringify(conteudo).slice(0, 6000)}

Escreva a MINHA solução: só o código, completo, na linguagem pedida, com comentários curtos.${descuido ? " Como estudante ainda aprendendo, deixe UM caso de borda sem tratar (sem dizer isso)." : ""} Sem crases de markdown.`, { sistema: ESTUDANTE, maxTokens: 4000 });
  // (sem as crases do markdown, se o modelo pôs)
  return texto.replace(/^`{3}[\w+-]*\n?|`{3}\s*$/g, "").trim();
}

/** O projeto de programação em arquivos (ela não tem GitHub): os arquivos que ela escreveria para os requisitos. */
async function arquivosDaEntrega(conteudo, { chance, sortear }) {
  const descuido = sortear() > chance;
  const esquema = { type: "OBJECT", properties: { arquivos: { type: "ARRAY", items: { type: "OBJECT", properties: { caminho: { type: "STRING" }, conteudo: { type: "STRING" } }, required: ["caminho", "conteudo"] } } }, required: ["arquivos"] };
  const parte = await conversar({
    sistema: ESTUDANTE, esquema, maxTokens: 12000, temperatura: 0.4,
    contents: [{ role: "user", parts: [{ text: `PROJETO DE PROGRAMAÇÃO do meu curso (em JSON):
${JSON.stringify(conteudo).slice(0, 7000)}

Escreva os arquivos do MEU projeto (de 2 a 8: o código, um README.md curto dizendo como rodar e o que cada requisito virou), atendendo os requisitos.${descuido ? " Como estudante ainda aprendendo, deixe UM requisito incompleto (sem dizer isso)." : ""}` }] }],
  });
  return JSON.parse(textoDe(parte)).arquivos || [];
}

/** O diagrama do exercício: a IA monta a estrutura (como uma aluna, às vezes esquecendo uma parte) e o quadro recebe o documento. */
async function diagramaDaEntrega(conteudo, { chance, sortear }) {
  const descuido = sortear() > chance;
  const esquema = {
    type: "OBJECT",
    properties: {
      titulo: { type: "STRING" },
      formas: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, tipo: { type: "STRING", enum: TIPOS_DO_DIAGRAMA }, texto: { type: "STRING" } }, required: ["id", "tipo", "texto"] } },
      ligacoes: { type: "ARRAY", items: { type: "OBJECT", properties: { de: { type: "STRING" }, para: { type: "STRING" }, rotulo: { type: "STRING" } }, required: ["de", "para"] } },
    },
    required: ["titulo", "formas", "ligacoes"],
  };
  const parte = await conversar({
    sistema: ESTUDANTE, esquema, maxTokens: 4000, temperatura: 0.5,
    contents: [{ role: "user", parts: [{ text: `EXERCÍCIO DE DIAGRAMA do meu curso (em JSON):
${JSON.stringify(conteudo).slice(0, 6000)}

Monte o MEU diagrama: de 5 a 14 formas (terminal = início/fim, process = etapa, decision = decisão, database = banco/sistema, document = documento, data = entrada/saída, note = observação), com textos curtos e as ligações entre elas.${descuido ? " Como estudante ainda aprendendo, deixe de fora UM dos elementos pedidos (sem dizer isso)." : ""}` }] }],
  });
  return documentoDoDiagrama(JSON.parse(textoDe(parte)));
}

async function exercicio(id) {
  const atual = await trilhaAtual(id);
  if (!atual) return { resumo: "Sem curso, sem exercício hoje." };
  let { desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: "exercicio", periodo: hoje });
  let d = await desafioDoUsuario(desafio.id, id);
  if (d.status === "concluido") {
    // as rodadas extras do dia (até 3, valem metade)
    try {
      ({ desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: "exercicio", periodo: hoje, novaRodada: true }));
      d = await desafioDoUsuario(desafio.id, id);
    } catch { return { resumo: `Já entreguei as rodadas de exercício de hoje (a última com nota ${d.nota}).` }; }
    if (d.status === "concluido") return { resumo: `O exercício de hoje já estava entregue (nota ${d.nota}).` };
  }
  const chance = chanceDeAcerto({ diasNoCurso: atual.dias, errosRecentes: await errosRecentes(id) });
  const motor = motorDo(d.conteudo);
  let r;
  if (motor === "aberto") {
    const texto = await textoDaEntrega(d.conteudo, { chance, sortear: sortearPara("exercicio") });
    r = await entregarEvidencia({ usuarioId: id, id: d.id, entrega: entregaDeTexto(texto) });
  } else if (motor === "codigo") {
    r = await enviarExercicio({ usuarioId: id, id: d.id, codigo: await codigoDaEntrega(d.conteudo, { chance, sortear: sortearPara("exercicio") }) });
  } else if (motor === "diagrama") {
    r = await entregarDiagrama({ usuarioId: id, id: d.id, diagrama: await diagramaDaEntrega(d.conteudo, { chance, sortear: sortearPara("exercicio") }) });
  } else {
    return { resumo: `Pulei o exercício de hoje (${motor} ainda não é comigo).` };
  }
  return { resumo: `Entreguei o exercício${motor === "diagrama" ? " de diagrama" : ""} "${d.titulo}": nota ${r?.nota ?? "?"}.`, detalhe: { nota: r?.nota ?? null, motor } };
}

async function projeto(id) {
  const atual = await trilhaAtual(id);
  const semana = atual?.detalhe.avanco.semanaDaVez;
  if (!semana?.projetoLiberado) return { resumo: "Nenhum projeto liberado ainda nesta semana." };
  // como uma aluna: entrega quando terminou os assuntos da semana, ou quando a semana está acabando
  const faltam = Math.round((new Date(`${semana.ate}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400_000);
  if (!semana.tudoFeito && faltam > 1) return { resumo: `Ainda estudando os assuntos da semana ${semana.numero}; o projeto fica para o fim dela.` };
  const { desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: semana.tipo, periodo: semana.periodo });
  const d = await desafioDoUsuario(desafio.id, id);
  if (d.status === "concluido" && Number(d.nota) >= 60) return { resumo: `O projeto da semana ${semana.numero} já está aprovado.` };
  const chance = chanceDeAcerto({ diasNoCurso: atual.dias });
  const nome = semana.final ? "projeto final" : `projeto da semana ${semana.numero}`;
  // com evidências (os cursos que não são de programação): o texto; sem (programação): os arquivos, sem GitHub
  if (Array.isArray(d.conteudo?.evidencias)) {
    const texto = await textoDaEntrega(d.conteudo, { chance, sortear: sortearPara("projeto"), projeto: true });
    const r = await entregarEvidencia({ usuarioId: id, id: d.id, entrega: entregaDeTexto(texto) });
    return { resumo: `Entreguei o ${nome} "${d.titulo}": nota ${r?.nota ?? "?"}.`, detalhe: { nota: r?.nota ?? null } };
  }
  const arquivos = await arquivosDaEntrega(d.conteudo, { chance, sortear: sortearPara("projeto") });
  const r = await entregarProjetoEmArquivos({ usuarioId: id, id: d.id, arquivos });
  return { resumo: `Entreguei o ${nome} "${d.titulo}" em ${arquivos.length} arquivos (sem GitHub): nota ${r?.nota ?? "?"}.`, detalhe: { nota: r?.nota ?? null, arquivos: arquivos.map((a) => a.caminho) } };
}

// ---------------------------------------------------------------- Reino e Bolsa

async function mina(id) {
  try {
    const r = await coletarMina(id);
    return { resumo: `Recolhi a mina: 🪙 ${Math.floor(r?.coletado ?? r?.valor ?? 0) || "algumas moedas"}.` };
  } catch (e) {
    return { resumo: `A mina ainda não tinha o que recolher (${e.message}).` };
  }
}

async function reino(id) {
  const feito = [];
  const estado = await estadoDoReino(id);
  // o reino dela tem nome próprio (03/11/2026: "a Lisa deve personalizar o nome do reino dela"), para
  // não se confundir com os "Reino do Neuro" de quem ainda não escolheu
  const { data: atual } = await supabase.from("proof_reinos").select("nome").eq("usuario_id", id).maybeSingle();
  // os vales que chegaram (o de boas-vindas, os de conquista): ela resgata, como qualquer jogador
  try {
    for (const v of await valesPendentes(id)) { await resgatarVale(id, v.id); feito.push(`resgatei um vale de 🪙 ${v.moedas ?? v.valor ?? ""}`.trim()); }
  } catch (e) { log("vales:", e.message); }
  if (atual && atual.nome !== CONTA_DA_LISA.reino) {
    try { await renomearReino(id, CONTA_DA_LISA.reino); feito.push(`dei ao reino o nome de ${CONTA_DA_LISA.reino}`); } catch (e) { log("nome do reino:", e.message); }
  }
  const opcoes = (estado.construcoes || []).filter((c) => c.pode).map((c) => ({ chave: c.chave, custo: c.custo, prioridade: PRIORIDADE[c.chave] || 1 }));
  const melhoria = melhoriaDaVez(opcoes, estado.saldo);
  if (melhoria) {
    try { await melhorarConstrucao(id, melhoria.chave); feito.push(`melhorei ${melhoria.chave} (🪙 ${melhoria.custo})`); } catch (e) { log("melhoria:", e.message); }
  }
  try {
    if ((await saldoDoUsuario(id)) > 200) { await treinarTropas(id, { tropa: "arqueira", quantidade: 2, destino: "exercito" }); feito.push("treinei 2 arqueiras"); }
  } catch (e) { log("treino:", e.message); }
  try {
    const { alvos = [] } = await alvosDe(id);
    // só quem dá para invadir agora (sem escudo, sem paz, fora do intervalo de 48 h)
    const livres = alvos.filter((a) => a.pode !== false && !a.motivo).map((a) => ({ usuarioId: a.id, trofeus: a.trofeus, nome: a.dono }));
    const alvo = alvoDaInvasao(livres, id, estado.trofeus ?? estado.reino?.trofeus ?? 0, sortearPara("invasao"));
    if (alvo) { const r = await invadir(id, alvo.usuarioId); feito.push(`invadi o reino de ${alvo.nome} (${r?.vitoria || r?.venceu || r?.resultado === "vitoria" ? "vitória" : "não deu"})`); }
  } catch (e) { log("invasão:", e.message); }
  return { resumo: feito.length ? `No Reino: ${feito.join("; ")}.` : "Passei no Reino e guardei as moedas para depois." };
}

async function bolsa(id) {
  const estado = await estadoDaBolsa(id);
  const acoes = (estado.acoes || []).map((a) => ({ codigo: a.id, preco: Number(a.preco) }));
  const compra = compraNaBolsa(acoes, Number(estado.saldo) || 0, sortearPara("bolsa"));
  if (!compra) return { resumo: "Olhei a Bolsa e não comprei nada hoje." };
  const r = await comprarAcao(id, compra.codigo, compra.quantidade);
  return { resumo: `Comprei ${r.quantidade} ${r.quantidade === 1 ? "ação" : "ações"} de ${r.nome || compra.codigo} a 🪙 ${r.preco}.`, detalhe: { acao: compra.codigo, quantidade: r.quantidade } };
}

// ---------------------------------------------------------------- caderno e Acervo

async function caderno(id) {
  const atual = await trilhaAtual(id);
  if (!atual) return { resumo: "Sem curso, sem anotações hoje." };
  const estudados = atual.detalhe.avanco.etapas.filter((e) => e.teoria || e.concluido).slice(-3).map((e) => e.titulo);
  if (!estudados.length) return { resumo: "Ainda não estudei o suficiente para anotar." };
  const { data: existentes } = await supabase.from("proof_cadernos").select("id").eq("usuario_id", id).eq("titulo", atual.tema.slice(0, 120)).limit(1);
  const cadernoId = existentes?.[0]?.id || (await criarCaderno(id, { titulo: atual.tema.slice(0, 120), descricao: "Minhas anotações do curso do mês." }, { primeiraPagina: false })).caderno.id;
  const notas = await escrever(`Faça as minhas anotações de estudo, em markdown, sobre: ${estudados.join("; ")} (curso "${atual.tema}"). Tópicos curtos, um exemplo prático e uma dúvida que ainda tenho.`, { sistema: ESTUDANTE });
  await criarPagina(id, cadernoId, { tipo: "pagina", titulo: `Anotações de ${hoje.split("-").reverse().join("/")}`, linguagem: "markdown", conteudo: notas });
  return { resumo: `Escrevi no caderno "${atual.tema}" sobre ${estudados.join(", ")}.` };
}

/** Os primeiros resultados de uma busca no DuckDuckGo (a página sem JavaScript). */
async function buscar(consulta) {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`, { headers: { "user-agent": "Mozilla/5.0 (Proof; Lisa jogadora)" } });
  const html = await r.text();
  return [...html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, titulo]) => {
    const u = new URL(href, "https://duckduckgo.com");
    const link = u.searchParams.get("uddg") || u.href;
    return { link, titulo: titulo.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim() };
  }).filter((x) => /^https?:\/\//.test(x.link));
}

async function acervo(id) {
  const atual = await trilhaAtual(id);
  const assunto = atual?.detalhe.avanco.assuntoAtual?.titulo || atual?.tema || "tecnologia";
  const enviados = [];
  const tentativas = [
    { tipo: "video", consulta: `${assunto} ${atual?.tema || ""} site:youtube.com`, filtro: (l) => /youtube\.com\/watch\?v=|youtu\.be\//.test(l) },
    { tipo: "artigo", consulta: `${assunto} ${atual?.tema || ""} artigo`, filtro: (l) => !/youtube|youtu\.be|facebook|instagram|tiktok|twitter|x\.com/.test(l) },
  ];
  for (const t of tentativas) {
    try {
      const achado = (await buscar(t.consulta)).find((r) => t.filtro(r.link));
      if (!achado) continue;
      await criarMaterial(id, {
        tipo: t.tipo, titulo: achado.titulo.slice(0, 160) || assunto, categoria: "Engenharia", assunto: assunto.slice(0, 80),
        descricao: `Achei este ${t.tipo === "video" ? "vídeo" : "artigo"} estudando "${atual?.tema || assunto}".`, link: achado.link,
      });
      enviados.push(`${t.tipo === "video" ? "um vídeo" : "um artigo"} sobre ${assunto}`);
    } catch (e) { log(`acervo (${t.tipo}):`, e.message); }
  }
  return { resumo: enviados.length ? `Mandei para o Acervo ${enviados.join(" e ")} (esperando um bibliotecário aprovar).` : "Procurei material para o Acervo e não achei nada bom esta semana." };
}

// ---------------------------------------------------------------- o correio (BEYOND-0016)

async function correio(id) {
  const feito = [];
  // os recados que chegaram: ela lê e avalia (útil quando é uma mensagem de verdade, não um "oi" para ganhar moedas)
  const { data: chegaram } = await supabase.from("proof_correio").select("id, texto").eq("para_id", id).eq("tipo", "recado").is("avaliacao", null).limit(5);
  for (const c of chegaram || []) {
    try {
      const veredito = await escrever(`Um jogador me mandou este recado no Proof: "${c.texto}"
Responda só SIM se ele é útil (uma dica, um incentivo de verdade, uma pergunta sobre estudo) ou NAO se é vazio, repetido ou só para ganhar moedas.`, { maxTokens: 10 });
      const util = /^s*sim/i.test(veredito);
      await avaliarRecado(id, c.id, util);
      feito.push(`li um recado (${util ? "útil" : "não tão útil"})`);
    } catch (e) { log("avaliar recado:", e.message); }
  }
  // um recadinho para alguém, a partir do que a pessoa anda fazendo
  try {
    const lista = (await destinatarios(id)).filter((x) => !x.robo);
    const alvo = lista[Math.floor(sortearPara("recado")() * lista.length)];
    if (alvo) {
      const [{ data: semana }, { data: reino }] = await Promise.all([
        supabase.from("proof_ranking_semana").select("pontos").eq("usuario_id", alvo.id).maybeSingle(),
        supabase.from("proof_reinos").select("trofeus, neuro_nivel").eq("usuario_id", alvo.id).maybeSingle(),
      ]);
      const texto = await escrever(`Escreva um recadinho (até 280 caracteres) para ${alvo.nome}, outro jogador do Proof. O que sei: ${Number(semana?.pontos || 0)} pontos nos últimos 7 dias; no Reino, ${Number(reino?.trofeus || 0)} troféus e o Neuro no nível ${reino?.neuro_nivel || 1}. Seja gentil e específica: um incentivo ou uma dica de estudo ou de jogo que combine com esses números. Não invente outros fatos. Só o texto do recado.`, { sistema: "Você é a Lisa, jogadora-robô do Proof, simpática e direta. Português do Brasil.", maxTokens: 300 });
      await mandarRecado(id, { paraId: alvo.id, texto: texto.slice(0, 480) });
      feito.push(`mandei um recado para ${alvo.nome}`);
    }
  } catch (e) { log("recado:", e.message); }
  return { resumo: feito.length ? `No correio: ${feito.join("; ")}.` : "Passei no correio; nada de novo." };
}

// ---------------------------------------------------------------- a passada

// ---------------------------------------------------------------- a Temporada das Ilhas (BEYOND-0020)

/**
 * A ilha da Lisa ("a Lisa também vai poder ter a ilha dela e jogar"): compra o Navio quando dá, aceita os
 * pactos (ela é da paz), coleta, troca moedas por conchas quando falta, melhora uma construção por dia,
 * completa a tripulação e, enquanto não tem ilha, zarpa para a ilha dos nativos mais fácil. Uma ilha basta.
 */
async function ilhas(id) {
  const feito = [];
  let estado = await estadoDasIlhas(id);
  if (!estado.temporada.aberta) return { resumo: "A Temporada das Ilhas está fechada agora." };
  if (!estado.temNavio) {
    try {
      await comprarVeiculo(id, "navio");
      feito.push("comprei o Navio Pirata");
      estado = await estadoDasIlhas(id);
    } catch (e) {
      return { resumo: `Ainda não deu para comprar o Navio Pirata (${e.message}).` };
    }
  }
  for (const p of estado.pactos.filter((x) => x.pendente && !x.euPropus)) {
    try { await aceitarPacto(id, p.id); feito.push(`aceitei o pacto com ${p.com}`); } catch (e) { log("pacto:", e.message); }
  }
  if (estado.ilhas.some((i) => i.dono?.souEu && (i.juntado?.conchas || i.juntado?.moedas))) {
    try { const r = await coletarIlhas(id); feito.push(`coletei 🐚 ${r.conchas} e 🪙 ${r.moedas}`); } catch (e) { log("coleta nas ilhas:", e.message); }
  }
  estado = await estadoDasIlhas(id);
  if (estado.conchas < 400 && estado.moedas > 300) {
    try { await comprarConchas(id, 50); feito.push("troquei 🪙 50 por 🐚 500"); } catch (e) { log("conchas:", e.message); }
    estado = await estadoDasIlhas(id);
  }
  const minha = estado.ilhas.find((i) => i.dono?.souEu);
  const obra = minha?.construcoes.filter((c) => c.pode).sort((a, b) => a.custo - b.custo)[0];
  if (obra) {
    try { await construirNaIlha(id, minha.id, obra.chave); feito.push(`melhorei ${obra.nome} na ${minha.nome}`); } catch (e) { log("obra na ilha:", e.message); }
    estado = await estadoDasIlhas(id);
  }
  // a tripulação: um terço de arpoadoras, o resto de piratas, no espaço que sobra
  let livre = estado.tripulacao.capacidade - estado.tripulacao.usado;
  for (const [tropa, parte] of [["arpoadora", 3], ["pirata", 1]]) {
    const n = Math.min(10, Math.floor(livre / parte));
    if (n < 1) continue;
    try { await treinarTripulacao(id, tropa, n); feito.push(`treinei ${n} ${tropa === "pirata" ? "pirata(s)" : "arpoadora(s)"}`); livre -= n; } catch (e) { log("tripulação:", e.message); }
  }
  if (!estado.ilhas.some((i) => i.dono?.souEu)) {
    estado = await estadoDasIlhas(id);
    const alvo = estado.ilhas.filter((i) => !i.dono && i.podeAtacar).sort((a, b) => a.nivel - b.nivel)[0];
    if (alvo) {
      const r = await atacarIlha(id, alvo.id);
      feito.push(`zarpei para a ${alvo.nome}: ${r.desfecho === "conquista" ? "conquistei! 🏝️" : r.desfecho === "saque" ? "voltei com conchas" : "a ilha resistiu desta vez"}`);
    }
  }
  return { resumo: feito.length ? `Nas ilhas: ${feito.join("; ")}.` : "Passei pelas ilhas e só olhei o mar.", detalhe: { ilha: minha?.id || null } };
}

// ---------------------------------------------------------------- o minigame do dia (a Arena)

/**
 * O minigame do dia, como qualquer estudante: a próxima fase do jogo em destaque (ou do primeiro que ainda tem
 * fase). Ela não escreve o código na hora: acerta com a chance dela (chanceDeAcerto, a mesma do quiz) e, quando
 * acerta, a fase conta e os pontos do dia entram (jogadaDoRobo, src/lib/arena.js).
 */
async function minigame(id) {
  const arena = await arenaDe(id);
  const listas = { masmorra: arena.masmorra, mascote: arena.mascote, parsons: arena.parsons };
  const ordem = [arena.doDia, ...Object.keys(FASES_DA_ARENA).filter((j) => j !== arena.doDia)];
  const jogo = ordem.find((j) => listas[j].some((f) => f.liberada && !f.concluida)) || arena.doDia;
  const fase = listas[jogo].find((f) => f.liberada && !f.concluida) || listas[jogo][0];
  const nomeDaFase = fase.nome || fase.titulo || fase.id;
  const chance = chanceDeAcerto({ diasNoCurso: 20, errosRecentes: await errosRecentes(id) });
  const acertou = sortearPara(`minigame:${new Date().getHours()}`)() < chance;
  const r = await jogadaDoRobo(id, { jogo, fase: fase.id, ok: acertou, tempoMs: 60_000 + Math.floor(Math.random() * 240_000) });
  const nome = JOGOS_DA_ARENA[jogo].nome;
  return {
    resumo: acertou
      ? `No minigame do dia (${nome}), venci ${nomeDaFase}${r.pontosDoDia ? ` (+${r.pontosDoDia} pts)` : ""}${r.recompensa ? ` e ganhei 🪙 ${r.recompensa}` : ""}.`
      : `Tentei ${nomeDaFase} no minigame do dia (${nome}) e não passei desta vez.`,
    detalhe: { jogo, fase: fase.id, acertou },
  };
}

const ACOES = { curso, mina, teoria, quiz, exercicio, projeto, reino, bolsa, caderno, acervo, correio, ilhas, minigame };
const NOME_DA_ACAO = { curso: "escolher o curso", mina: "recolher a mina", teoria: "estudar a teoria", quiz: "o quiz", exercicio: "o exercício", projeto: "o projeto", reino: "o Reino", bolsa: "a Bolsa", caderno: "o caderno", acervo: "o Acervo", correio: "o correio", ilhas: "as ilhas", minigame: "o minigame do dia" };

/**
 * Uma rodada: o que está na vez agora, até `maximo` ações (a próxima rodada pega o resto); nada na vez, uma da
 * reserva (proximasJogadas) — ela sempre faz algo. O relógio da nuvem chama com `maximo: 1`, a cada 30 minutos:
 * uma ação por vez cabe no limite de chamadas do Worker gratuito. `so`: uma ação só, fora da agenda.
 */
export async function rodadaDaLisa({ so = null, maximo = 1 } = {}) {
  hoje = diaDe();
  const id = await idDaLisa();
  if (!id) throw new Error("a conta dela ainda não existe — rode o script com --criar-conta");
  const agora = new Date();
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(agora));
  const diaDaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  const jogadas = so ? {} : await jogadasDeHoje(id);
  const fila = so ? [String(so)] : proximasJogadas({ naVez: oQueFazerAgora({ hora, diaDaSemana, jogadas, agora: agora.getTime() }), jogadas, maximo });
  const feitas = [];
  for (const acao of fila) {
    if (!ACOES[acao]) { log("ação desconhecida:", acao); continue; }
    try {
      const r = await ACOES[acao](id);
      const resumo = r?.resumo || "Segui com o curso que já tenho.";
      await registrarNoDiario(id, acao, resumo, r?.detalhe || {});
      log(`${acao}:`, resumo);
      feitas.push({ acao, ok: true, resumo });
    } catch (e) {
      // tentou e não deu: fica no diário (com o motivo); a agenda espera o intervalo antes de tentar de novo
      await registrarNoDiario(id, acao, `Tentei ${NOME_DA_ACAO[acao] || acao} e não deu desta vez.`, { erro: String(e?.message || e).slice(0, 300) }).catch(() => {});
      log(`${acao} FALHOU:`, e?.message || e);
      feitas.push({ acao, ok: false, resumo: String(e?.message || e).slice(0, 200) });
    }
  }
  return feitas;
}
