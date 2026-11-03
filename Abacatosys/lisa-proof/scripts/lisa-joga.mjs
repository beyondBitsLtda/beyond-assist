// A Lisa joga o Proof (03/11/2026, BEYOND-0014). Roda de hora em hora no relógio do iMac, pela conta
// própria dela (CONTA_DA_LISA), chamando as mesmas funções que as telas chamam — sem atalho: ela ganha
// e perde pontos e moedas como qualquer jogador. A cada passada, faz o que está na vez da agenda e ainda
// não fez hoje (src/dominio/lisaJogadora.js) e anota no diário dela, que é a página pública /lisa.
//
// Uso (na pasta do lisa-proof, com o .env.local, que tem o banco e as chaves do Gemini):
//   npm run lisa-joga                       uma passada: o que está na vez agora
//   npm run lisa-joga -- --criar-conta      cria a conta dela (uma vez) e sai
//   npm run lisa-joga -- --so=quiz          só uma ação, fora da agenda (curso, mina, teoria, quiz,
//                                           exercicio, projeto, reino, bolsa, caderno, acervo)
// Crontab sugerido (de hora em hora, das 7h às 22h, com trava para não rodar duas juntas):
//   15 7-22 * * * cd <pasta>/Abacatosys/lisa-proof && /usr/bin/flock -n /tmp/proof-lisa.lock npm run lisa-joga >> ~/proof-lisa.log 2>&1

import crypto from "node:crypto";
import { supabase } from "@/lib/supabase.js";
import { idDaLisa, registrarNoDiario, feitoHoje } from "@/lib/lisaJogadora.js";
import { proporCurso } from "@/lib/iaCurso.js";
import { criarCurso } from "@/lib/cursos.js";
import { detalheDaTrilha } from "@/lib/trilhas.js";
import { marcarItem } from "@/lib/estudo.js";
import { obterOuCriarDesafio, desafioDoUsuario, responderQuiz, entregarEvidencia, entregarDiagrama } from "@/lib/pratica.js";
import { estadoDoReino, coletarMina, melhorarConstrucao, treinarTropas, alvosDe, invadir, saldoDoUsuario } from "@/lib/reino.js";
import { estadoDaBolsa, comprarAcao } from "@/lib/bolsa.js";
import { criarMaterial } from "@/lib/acervo.js";
import { criarCaderno, criarPagina } from "@/lib/cadernos.js";
import { conversar, textoDe } from "@/lib/gemini.js";
import { assuntosParaODuracao } from "@/dominio/curso.js";
import { diaDe } from "@/dominio/datas.js";
import { motorDo } from "@/dominio/motores.js";
import {
  CONTA_DA_LISA, PERFIL_DO_CURSO, temaDoMes, sorteio, sementeDe, chanceDeAcerto, respostasDoQuiz, oQueFazerAgora,
  itensDaTeoriaHoje, melhoriaDaVez, compraNaBolsa, alvoDaInvasao, documentoDoDiagrama, TIPOS_DO_DIAGRAMA,
} from "@/dominio/lisaJogadora.js";

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const hoje = diaDe();
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

async function criarConta() {
  const ja = await idDaLisa();
  if (ja) return log("a conta dela já existe:", ja.slice(0, 8));
  // senha que ninguém sabe: a conta não entra pela tela, só joga pelo relógio
  const { data, error } = await supabase.from("abacato_usuarios").insert({
    email: CONTA_DA_LISA.email, nome: CONTA_DA_LISA.nome,
    senha_hash: crypto.randomBytes(32).toString("hex"), senha_sal: crypto.randomBytes(16).toString("hex"),
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
    objetivo: "Entender os conceitos e aplicar no dia a dia de uma equipe de tecnologia, sem precisar programar.",
    assuntos: assuntosParaODuracao(4, DIAS_DE_ESTUDO.length),
  });
  if (!r.ok) throw new Error(`a proposta do curso falhou: ${r.erros.join("; ")}`);
  const proposta = { ...r.proposta, perfil: PERFIL_DO_CURSO };
  const criado = await criarCurso({ usuarioId: id, proposta, diasDeEstudo: DIAS_DE_ESTUDO });
  return { resumo: `Comecei o curso do mês: "${criado.nome.replace(/^STUDYs+/i, "")}" (${criado.assuntos} assuntos em 4 semanas).`, detalhe: { tema, trilhaId: criado.trilhaId } };
}

// ---------------------------------------------------------------- estudo e prática

async function teoria(id) {
  const atual = await trilhaAtual(id);
  if (!atual) return { resumo: "Sem curso em andamento para estudar hoje." };
  const itens = atual.detalhe.avanco.etapas
    .filter((e) => !e.bloqueada && (!e.inicio || e.inicio <= hoje))
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
  const { desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: "quiz", periodo: hoje });
  let d = await desafioDoUsuario(desafio.id, id);
  if (d.status === "concluido") return { resumo: `O quiz de hoje já estava feito (nota ${d.nota}).` };
  const chance = chanceDeAcerto({ diasNoCurso: atual.dias, errosRecentes: await errosRecentes(id) });
  const perguntas = d.conteudo?.perguntas || [];
  const escolhas = respostasDoQuiz(perguntas, chance, sortearPara("quiz"));
  const respondidas = d.resposta?.escolhas || {};
  let fim = null;
  for (let i = 0; i < perguntas.length; i++) {
    if (respondidas[i] !== undefined) continue;
    fim = await responderQuiz({ usuarioId: id, id: d.id, indice: i, escolha: escolhas[i] });
  }
  d = await desafioDoUsuario(d.id, id);
  return {
    resumo: `Fiz o quiz do dia sobre "${fim?.assunto?.titulo || fim?.assunto || atual.tema}": ${fim?.acertos ?? "?"} de ${perguntas.length} (nota ${d.nota ?? "?"}).`,
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
  const { desafio } = await obterOuCriarDesafio({ usuarioId: id, trilhaId: atual.id, tipo: "exercicio", periodo: hoje });
  const d = await desafioDoUsuario(desafio.id, id);
  if (d.status === "concluido") return { resumo: `O exercício de hoje já estava entregue (nota ${d.nota}).` };
  const chance = chanceDeAcerto({ diasNoCurso: atual.dias, errosRecentes: await errosRecentes(id) });
  const motor = motorDo(d.conteudo);
  let r;
  if (motor === "aberto") {
    const texto = await textoDaEntrega(d.conteudo, { chance, sortear: sortearPara("exercicio") });
    r = await entregarEvidencia({ usuarioId: id, id: d.id, entrega: entregaDeTexto(texto) });
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
  const texto = await textoDaEntrega(d.conteudo, { chance: chanceDeAcerto({ diasNoCurso: atual.dias }), sortear: sortearPara("projeto"), projeto: true });
  const r = await entregarEvidencia({ usuarioId: id, id: d.id, entrega: entregaDeTexto(texto) });
  return { resumo: `Entreguei o ${semana.final ? "projeto final" : `projeto da semana ${semana.numero}`} "${d.titulo}": nota ${r?.nota ?? "?"}.`, detalhe: { nota: r?.nota ?? null } };
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

// ---------------------------------------------------------------- a passada

const ACOES = { curso, mina, teoria, quiz, exercicio, projeto, reino, bolsa, caderno, acervo };
const NOME_DA_ACAO = { curso: "escolher o curso", mina: "recolher a mina", teoria: "estudar a teoria", quiz: "o quiz", exercicio: "o exercício", projeto: "o projeto", reino: "o Reino", bolsa: "a Bolsa", caderno: "o caderno", acervo: "o Acervo" };

async function main() {
  if (args.has("criar-conta")) return criarConta();
  const id = await idDaLisa();
  if (!id) throw new Error("a conta dela ainda não existe — rode com --criar-conta");
  const agora = new Date();
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(agora));
  const diaDaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  const fila = args.has("so") ? [String(args.get("so"))] : oQueFazerAgora({ hora, diaDaSemana, feito: await feitoHoje(id) });
  if (!fila.length) return log("nada na vez agora");
  for (const acao of fila) {
    if (!ACOES[acao]) { log("ação desconhecida:", acao); continue; }
    try {
      const r = await ACOES[acao](id);
      if (r) { await registrarNoDiario(id, acao, r.resumo, r.detalhe || {}); log(`${acao}:`, r.resumo); }
      else { await registrarNoDiario(id, acao, "Segui com o curso que já tenho.", {}); log(`${acao}: nada a fazer`); }
    } catch (e) {
      // tentou e não deu: fica no diário (com o motivo) e não insiste de hora em hora
      await registrarNoDiario(id, acao, `Tentei ${NOME_DA_ACAO[acao] || acao} e não deu desta vez.`, { erro: String(e?.message || e).slice(0, 300) }).catch(() => {});
      log(`${acao} FALHOU:`, e?.message || e);
    }
  }
}

main().then(() => process.exit(0), (e) => { log("ERRO:", e?.message || e); process.exit(1); });
