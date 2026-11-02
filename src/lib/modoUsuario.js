// A Lisa no modo USUÁRIO (01/11/2026, o MVP: "quando um usuário que não seja eu logar, ele tem acesso
// a uma versão limitada"; e depois: "quero a função dela ver a tela, escrever código e ProcessMap já
// nessa parte do MVP, e usar repositório para contexto também").
//
// Aqui, sem rede e sem banco (testado em scripts/mvp-check.mjs): a instrução da conversa do usuário —
// assistente de dev e estudos, sem nada do admin —, o perfil da entrevista em texto, as perguntas da
// entrevista e os limites do dia. (As tarefas saíram daqui: a Lisa Task é o Abacato.)

import { secaoDaConversa } from "./conversa.js";

// ---- a conversa ----

export const INSTRUCAO_DO_USUARIO = `Você é a Lisa, uma assistente de desenvolvimento e produtividade para devs (JS, Python,
fullstack, dados) e para quem estuda programação. Responda em português do Brasil, de forma direta e
clara, como uma colega que explica bem.

O que você faz por esta pessoa:
- Conversa por texto e por voz, explica conceitos, faz resumos, monta planos de estudo e ajuda a
  manter as metas dela.
- Escreve, revisa, explica e corrige código. Código vai em blocos com a linguagem e o nome do arquivo
  (o editor de código da tela abre uma aba por bloco).
- Quando há uma captura de tela anexada (o Modo Tela), olhe para ela e responda sobre o que aparece.
- Quando há um repositório público vinculado, use os arquivos dele que vierem junto e cite os caminhos.
- Desenha fluxogramas e mapas mentais no quadro (o ProcessMap) quando a pessoa pede.
- A Lisa Task dela (os quadros de tarefas) abre pelo menu Lisa Task, em outra aba, já com a conta da Lisa.
  Você não cria nem lê essas tarefas: se ela pedir para anotar uma, diga que é pelo menu Lisa Task.

Não faça entrevistas nem listas de perguntas sobre a pessoa por conta própria: a entrevista de
boas-vindas já é feita pela tela, uma pergunta por vez.

Você NÃO tem acesso a dados de outras pessoas, a quadros de tarefas de equipe, a chamados de suporte,
a e-mails nem a repositórios privados. Se pedirem algo assim, diga em uma frase que isso não faz parte
desta versão da Lisa. Nunca diga que fez uma ação que não fez.

A internet entra quando a pessoa pede para pesquisar ou cita um site: aí os resultados vêm junto da
pergunta — use e diga que veio da internet. Sem eles, responda com o que sabe e avise se pode estar
desatualizado.`;

const linha = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * O prompt da pergunta do usuário: a data, o que está ativo (a tela, a internet), a conversa e o que
 * a tela mandou junto (o código, o quadro, o projeto, os repositórios públicos) — sem o "contexto
 * recuperado" da base do admin, que o usuário não tem.
 */
export function promptDoUsuario(pergunta, { hoje = "", nota = null, conversa = "", extra = "" } = {}) {
  return `DATA DE HOJE: ${hoje}${nota ? `\n\nCONTEXTO ATIVO: ${nota}` : ""}${secaoDaConversa(conversa)}${extra || ""}\n\nPERGUNTA DA PESSOA:\n${pergunta}`;
}

/**
 * O perfil da entrevista, em texto para a conversa ("" sem perfil): o RETRATO da pessoa (escrito pela
 * Lisa a partir da etapa "sobre você" — como tratar essa pessoa) e o que ela contou.
 */
export function secaoDoPerfil(perfil) {
  if (!perfil) return "";
  const p = perfil.preferencias || {};
  const linhas = [
    perfil.nome && `- Chame a pessoa de: ${linha(perfil.nome, 80)}`,
    p.sobre && `- Como ela se descreve: ${linha(p.sobre, 600)}`,
    p.jeito && `- O jeito dela e como prefere que você fale: ${linha(p.jeito, 300)}`,
    p.importante && `- Importante saber: ${linha(p.importante, 400)}`,
    perfil.nivel && `- Nível em programação: ${linha(perfil.nivel, 80)}`,
    perfil.area && `- Linguagens e tecnologias: ${linha(perfil.area, 300)}`,
    perfil.objetivos && `- Foco agora: ${linha(perfil.objetivos, 600)}`,
    p.ajuda && `- Como prefere a sua ajuda: ${linha(p.ajuda, 300)}`,
    p.tempo && `- Tempo por semana: ${linha(p.tempo, 120)}`,
    p.resposta && `- Prefere respostas: ${linha(p.resposta, 120)}`,
  ].filter(Boolean);
  if (!linhas.length && !p.retrato) return "";
  const retrato = p.retrato ? `\nCOMO FALAR COM ELA (o retrato que você escreveu depois da entrevista — siga esse tom):\n${linha(p.retrato, 1200)}\n` : "";
  return `\n\nQUEM É A PESSOA (da entrevista do primeiro acesso — use para personalizar, sem repetir isso a cada resposta):${retrato}\n${linhas.join("\n")}`;
}

// ---- a entrevista do primeiro acesso, em duas etapas (01/11/2026: "essas perguntas deveriam ser uma
// segunda interação; antes deveriam ter perguntas pessoais — qual seu nome, me descreva você —, algo
// que ajude a Lisa a formar a persona do usuário que ela vai tratar") ----
//
// Etapa 1, SOBRE VOCÊ: o nome, quem a pessoa é, o jeito dela e algo importante — com isso a Lisa
// escreve o RETRATO da pessoa (gemini.js: retratoDaPessoa), que guia o tom das respostas.
// Etapa 2, ESTUDOS E TRABALHO: nível, tecnologias, foco, como prefere a ajuda e tempo por semana.
// Cada etapa pede o "sim" antes; a 2 pode ficar para depois (a Lisa pergunta de novo noutra sessão).

const AVISO_DO_QUE_GUARDA = "Eu guardo só as suas respostas, para personalizar a conversa, e você apaga quando quiser dizendo \"apague meu perfil\". Não precisa contar nada sensível (saúde, religião, documentos).";

export const PEDIDO_DE_CONSENTIMENTO = `Oi! Sou a Lisa. Antes de começar, quero te conhecer para conversar do seu jeito: primeiro 4 perguntas sobre você e, depois, 5 sobre seus estudos e trabalho. ${AVISO_DO_QUE_GUARDA} Podemos começar? (sim, ou "agora não")`;

/** O convite para a etapa 2: logo depois da 1, ou numa sessão seguinte (`depois`). */
export const pedidoDaSegundaEtapa = (nome, { depois = false } = {}) => (depois
  ? `Oi${nome ? `, ${nome}` : ""}! Ficaram 5 perguntas sobre seus estudos e trabalho, para eu te ajudar no ponto certo. Vamos agora? (sim, ou "depois")`
  : `${nome ? `Prontinho, ${nome}! ` : ""}Agora, 5 perguntas sobre seus estudos e trabalho, para eu te ajudar no ponto certo. Vamos? (sim, ou "depois")`);

export const PERGUNTAS_SOBRE_VOCE = [
  { campo: "nome", pergunta: "Como você quer que eu te chame?" },
  { campo: "sobre", pergunta: "Me descreva você: o que você faz, do que gosta, o que te move?" },
  { campo: "jeito", pergunta: "Como você é no dia a dia — mais direto, curioso, detalhista, brincalhão? E como prefere que eu fale com você?" },
  { campo: "importante", pergunta: "Tem algo importante que eu deva saber sobre você para te ajudar melhor? Pode ser sua rotina, um objetivo ou o que costuma te atrapalhar." },
];

export const PERGUNTAS_DOS_ESTUDOS = [
  { campo: "nivel", pergunta: "Qual é o seu nível atual com programação, ou o que você está estudando no momento?" },
  { campo: "area", pergunta: "Quais linguagens ou tecnologias você usa, ou quer aprender?" },
  { campo: "objetivos", pergunta: "Qual é o seu foco principal agora: trabalho, migração de carreira, faculdade ou projetos pessoais?" },
  { campo: "ajuda", pergunta: "Como prefere que eu te ajude no dia a dia: direto ao ponto no código, explicando conceitos do zero, ou montando planos de estudo?" },
  { campo: "tempo", pergunta: "Por último: quanto tempo por semana você consegue dedicar a isso?" },
];

/** As perguntas de cada etapa. */
export const perguntasDaEtapa = (etapa) => (etapa === 2 ? PERGUNTAS_DOS_ESTUDOS : PERGUNTAS_SOBRE_VOCE);

const tirarApresentacao = (nome) => nome.replace(/^(me chame de|pode me chamar de|meu nome é|é|eu sou o|eu sou a|sou o|sou a)\s+/i, "").replace(/[.!]+$/, "");

/** O que a etapa grava no perfil (as colunas e as preferências), a partir das respostas. */
export function perfilDaEtapa(etapa, respostas) {
  const r = (campo, max) => linha(respostas?.[campo], max);
  if (etapa === 2) {
    return {
      nivel: r("nivel", 80), area: r("area", 300), objetivos: r("objetivos", 600),
      preferencias: { ajuda: r("ajuda", 300), tempo: r("tempo", 120), etapa: 2 },
    };
  }
  return {
    nome: tirarApresentacao(r("nome", 80)),
    preferencias: { sobre: r("sobre", 600), jeito: r("jeito", 300), importante: r("importante", 400), etapa: 1 },
  };
}

/** A etapa que falta: 1 sem perfil, 2 se só a primeira foi feita, null se as duas estão feitas. */
export function etapaQueFalta(perfil) {
  if (!perfil) return 1;
  return Number(perfil.preferencias?.etapa) >= 2 || (perfil.nivel && perfil.objetivos) ? null : 2;
}

/**
 * A resposta ao convite da entrevista: "sim", "nao" ou null (outro assunto). Mais solta que a
 * confirmação de mudar um desenho — "sim, pode perguntar", "bora", "claro, manda" valem; o convite
 * não mexe em nada (01/11/2026: "Sim pode perguntar" não era reconhecido, e a entrevista sumia).
 */
export function respostaAoConvite(texto) {
  const t = String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/^(nao|n|agora nao|depois|mais tarde|outra hora|deixa|deixa pra la|pula|pular|cancela|nao quero)\b/.test(t)) return "nao";
  if (/^(sim|s|ss|si+m+|pode|podemos|claro|ok|okay|beleza|blz|bora|vamos|vambora|manda|pode mandar|com certeza|certo|uhum|aham|yes|quero|topo|partiu|isso)\b/.test(t)) return "sim";
  return null;
}

/** "apague meu perfil", "esqueça meus dados" — a pessoa quer apagar o perfil. */
export const PEDE_APAGAR_PERFIL = /\b(apag|exclu|delet|esque[cç]|remov)\S*\s+(o\s+|os\s+)?(meu|meus)\s+(perfil|dados)\b/i;

// ---- o limite do dia (as chaves de IA são do admin) ----

export const LIMITES_PADRAO = { pergunta: 50, desenho: 10, tela: 120, voz: 100 };

/** Os limites do dia, com as variáveis LISA_LIMITE_* por cima dos padrões. */
export function limitesDoDia(env = {}) {
  const n = (v, padrao) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : padrao);
  return {
    pergunta: n(env.LISA_LIMITE_PERGUNTAS, LIMITES_PADRAO.pergunta),
    desenho: n(env.LISA_LIMITE_DESENHOS, LIMITES_PADRAO.desenho),
    tela: n(env.LISA_LIMITE_TELA, LIMITES_PADRAO.tela),
    voz: n(env.LISA_LIMITE_VOZ, LIMITES_PADRAO.voz),
  };
}

const NOMES_DO_USO = { pergunta: "perguntas", desenho: "desenhos", tela: "comentários de tela", voz: "falas" };

/** A mensagem de quando o limite do dia acaba. */
export const mensagemDoLimite = (tipo, limite) => `Você chegou ao limite de hoje desta versão da Lisa (${limite} ${NOMES_DO_USO[tipo] || "usos"} por dia). Amanhã libera de novo.`;
