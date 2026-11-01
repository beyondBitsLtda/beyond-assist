// A Lisa no modo USUÁRIO (01/11/2026, o MVP: "quando um usuário que não seja eu logar, ele tem acesso
// a uma versão limitada"; e depois: "quero a função dela ver a tela, escrever código e ProcessMap já
// nessa parte do MVP, e usar repositório para contexto também").
//
// Aqui, sem rede e sem banco (testado em scripts/mvp-check.mjs): a instrução da conversa do usuário —
// assistente de dev e estudos, sem nada do admin —, o perfil da entrevista em texto, as tarefas dele
// em texto, o pedido de tarefa por voz ou chat, as perguntas da entrevista e os limites do dia.

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
- Guarda tarefas na Lisa Task dela (só texto, sem arquivos) quando ela pede.

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

/** O perfil da entrevista, em texto para a conversa ("" sem perfil). */
export function secaoDoPerfil(perfil) {
  if (!perfil) return "";
  const p = perfil.preferencias || {};
  const linhas = [
    perfil.nome && `- Chame a pessoa de: ${linha(perfil.nome, 80)}`,
    perfil.area && `- Trabalha ou estuda com: ${linha(perfil.area, 300)}`,
    perfil.nivel && `- Nível em programação: ${linha(perfil.nivel, 80)}`,
    perfil.objetivos && `- O que quer conseguir com a sua ajuda: ${linha(perfil.objetivos, 600)}`,
    p.resposta && `- Prefere respostas: ${linha(p.resposta, 120)}`,
  ].filter(Boolean);
  return linhas.length ? `\n\nQUEM É A PESSOA (da entrevista do primeiro acesso — use para personalizar, sem repetir isso a cada resposta):\n${linhas.join("\n")}` : "";
}

/** As tarefas abertas da pessoa, em texto ("" sem tarefas). */
export function secaoDasTarefas(tarefas) {
  const abertas = (tarefas || []).filter((t) => t.status !== "feita").slice(0, 30);
  if (!abertas.length) return "";
  const item = (t) => `- ${linha(t.titulo, 200)}${t.prioridade === "alta" ? " (prioridade alta)" : ""}${t.lembreteEm ? ` (lembrete: ${String(t.lembreteEm).slice(0, 16).replace("T", " ")})` : ""}`;
  return `\n\nAS TAREFAS ABERTAS DA PESSOA NA LISA TASK (use se ela perguntar das tarefas dela):\n${abertas.map(item).join("\n")}`;
}

// ---- a tarefa pedida por voz ou chat ("crie uma tarefa: revisar o PR", "me lembra de estudar React") ----

const PEDE_TAREFA = /^(?:lisa[,\s]+)?(?:por favor[,\s]+)?(?:cri[ae]|adicion[ae]|anot[ae]|coloqu[ae]|ponh[ae]|inclu[ai]|registr[ae]|nova)\s+(?:(?:uma|a|essa|esta|na minha)\s+)?(?:nova\s+)?tarefa(?:\s+(?:na|no)\s+(?:minha\s+)?(?:lisa\s*task|lista))?\s*(?:de|para|pra|:|-|—)?\s*(.+)$/i;
const ME_LEMBRA = /^(?:lisa[,\s]+)?(?:me\s+lembr[ae]|lembr[ae]-?me)\s+(?:de\s+|que\s+)?(.+)$/i;

/** O pedido é criar uma tarefa? { titulo, prioridade } ou null. */
export function pedidoDeTarefa(texto) {
  const t = String(texto || "").trim().replace(/[.!]+$/, "");
  const m = t.match(PEDE_TAREFA) || t.match(ME_LEMBRA);
  if (!m) return null;
  let titulo = m[1].trim().replace(/^["“']|["”']$/g, "");
  const alta = /\b(urgente|com prioridade alta|prioridade alta|importante)\b/i.test(titulo);
  titulo = titulo.replace(/,?\s*(é\s+)?(urgente|com prioridade alta|prioridade alta|importante)\b/gi, "").trim();
  if (titulo.length < 2) return null;
  return { titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1, 200), prioridade: alta ? "alta" : "normal" };
}

// ---- a entrevista do primeiro acesso ----

export const PEDIDO_DE_CONSENTIMENTO = "Oi! Sou a Lisa. Antes de começar, posso te fazer 5 perguntas rápidas para te conhecer? Eu guardo só as suas respostas, para personalizar a conversa — e você apaga quando quiser dizendo \"apague meu perfil\". Responda sim para começar, ou \"agora não\".";

export const PERGUNTAS_DA_ENTREVISTA = [
  { campo: "nome", pergunta: "Como você quer que eu te chame?" },
  { campo: "area", pergunta: "Com o que você trabalha ou estuda? Por exemplo: front-end em React, dados em Python, back-end, gestão." },
  { campo: "nivel", pergunta: "Qual o seu nível com programação: começando, intermediário ou avançado?" },
  { campo: "objetivos", pergunta: "O que você quer conseguir com a minha ajuda nas próximas semanas?" },
  { campo: "resposta", pergunta: "Por último: prefere respostas curtas e diretas, ou mais explicadas, com exemplos?" },
];

/** O perfil montado a partir das respostas da entrevista (na ordem de PERGUNTAS_DA_ENTREVISTA). */
export function perfilDasRespostas(respostas) {
  const r = (campo) => linha(respostas?.[campo], campo === "objetivos" ? 600 : campo === "area" ? 300 : 80);
  return {
    nome: r("nome").replace(/^(me chame de|pode me chamar de|é|eu sou o|eu sou a|sou o|sou a)\s+/i, ""),
    area: r("area"), nivel: r("nivel"), objetivos: r("objetivos"),
    preferencias: { resposta: r("resposta") },
  };
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
