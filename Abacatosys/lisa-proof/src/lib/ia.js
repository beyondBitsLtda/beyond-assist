// O que a Lisa faz com o modelo: montar a trilha, sugerir tarefas de teoria e explicar um
// assunto. Cada função devolve dado já conferido — nada sai daqui do jeito que o modelo mandou.

import { conversar, textoDe, temModelo } from "./gemini.js";
import { NIVEIS, validarPlano } from "@/dominio/plano.js";

export { temModelo };

export const PERSONA =
  "Você é a Lisa, tutora de programação da Lisa_Proof, um app de estudo no estilo Duolingo. " +
  "Responde sempre em português do Brasil, com linguagem direta e didática.";

/** Corta e junta espaços — para texto de prompt, nunca para código (quebraria as linhas). */
export function corte(valor, limite) {
  const t = String(valor ?? "").replace(/\s+/g, " ").trim();
  return t.length > limite ? `${t.slice(0, limite)}…` : t;
}

export async function gerarJson({ sistema, pedido, esquema, maxTokens = 4096 }) {
  const parte = await conversar({
    contents: [{ role: "user", parts: [{ text: pedido }] }],
    sistema,
    esquema,
    maxTokens,
  });
  try {
    return JSON.parse(textoDe(parte));
  } catch {
    throw new Error(
      parte.motivoDeParada === "MAX_TOKENS"
        ? "a resposta da IA veio cortada (conteúdo grande demais de uma vez)"
        : "a IA devolveu um formato que não deu para ler"
    );
  }
}

// ---------------------------------------------------------------- trilha

/** Quantos cards vão para a IA de uma vez. Os que passarem entram no fim, na ordem do quadro
 *  (é o que `validarPlano` faz com o que a IA não devolveu). */
const MAXIMO_DE_CARDS = 120;

const ESQUEMA_DO_PLANO = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    etapas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          cardId: { type: "STRING" },
          dias: { type: "INTEGER" },
          nivel: { type: "STRING", enum: NIVEIS },
          objetivo: { type: "STRING" },
        },
        required: ["cardId", "dias", "nivel", "objetivo"],
      },
    },
  },
  required: ["resumo", "etapas"],
};

/**
 * Ordena os assuntos do mais fundamental ao mais avançado.
 *
 * O modelo recebe apelidos curtos (c1, c2...) no lugar dos uuids. Pedir que ele copie trinta
 * uuids de 36 caracteres é pedir um erro de digitação — e um id errado é um assunto perdido.
 */
export async function planejarTrilha({ tema, cards }) {
  const enviados = cards.slice(0, MAXIMO_DE_CARDS);
  const apelido = new Map(enviados.map((c, i) => [`c${i + 1}`, c.id]));
  const lista = enviados.map((c, i) => ({
    id: `c${i + 1}`,
    titulo: corte(c.titulo, 160),
    descricao: corte(c.descricao, 260) || undefined,
    coluna: c.colunaNome || undefined,
    tarefas: c.checklists.flatMap((cl) => cl.itens.map((it) => corte(it.texto, 90))).slice(0, 12),
  }));

  const bruto = await gerarJson({
    sistema: PERSONA,
    maxTokens: 8192,
    esquema: ESQUEMA_DO_PLANO,
    pedido: [
      `Monte a trilha de estudo do tema "${tema}". Cada item abaixo é um assunto (card) do quadro de estudo.`,
      "",
      "Regras:",
      "- Ordene TODOS os assuntos do mais fundamental ao mais avançado, de forma progressiva: o que é pré-requisito vem antes.",
      "- Ignore a coluna em que o card está: ela é organização do quadro, não ordem de estudo.",
      "- `dias`: quantos dias de estudo (1 a 5) o assunto pede, pelo tamanho e dificuldade. Na dúvida, 1.",
      "- `nivel`: basico, intermediario ou avancado.",
      "- `objetivo`: uma frase curta com o que a pessoa deve saber fazer ao terminar o assunto.",
      "- `resumo`: 2 ou 3 frases explicando a lógica da trilha.",
      "- Use exatamente os ids recebidos (c1, c2...). Não invente assuntos.",
      "",
      JSON.stringify(lista),
    ].join("\n"),
  });

  const traduzido = {
    resumo: bruto?.resumo,
    etapas: (bruto?.etapas || []).map((e) => ({ ...e, cardId: apelido.get(String(e?.cardId)) || "" })),
  };
  return validarPlano(traduzido, cards);
}

// ---------------------------------------------------------------- tarefas de teoria

const ESQUEMA_DAS_TAREFAS = {
  type: "OBJECT",
  properties: { itens: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["itens"],
};

/** De 4 a 6 tarefas de teoria para um assunto, no formato de item de checklist. */
export async function tarefasDeTeoria({ tema, card }) {
  const bruto = await gerarJson({
    sistema: PERSONA,
    esquema: ESQUEMA_DAS_TAREFAS,
    pedido: [
      `Tema: ${tema}`,
      `Assunto: ${card.titulo}`,
      card.descricao ? `Descrição do card: ${corte(card.descricao, 600)}` : "",
      "",
      "Crie de 4 a 6 tarefas de estudo TEÓRICO para este assunto, para virar uma checklist.",
      "- Cada tarefa começa com um verbo e cabe em uma linha (até 110 caracteres).",
      "- Inclua: ler a documentação oficial ou uma apostila técnica (cite a fonte concreta, ex.: MDN, docs.oracle.com),",
      "  ler uma discussão de fórum sobre o assunto (ex.: Stack Overflow), pedir a definição do assunto à Lisa,",
      "  e escrever um resumo próprio em poucas linhas.",
      "- Não inclua exercícios de programação longos: a parte prática é outra.",
    ].filter(Boolean).join("\n"),
  });

  const itens = (Array.isArray(bruto?.itens) ? bruto.itens : [])
    .map((t) => corte(t, 140))
    .filter(Boolean)
    .slice(0, 6);
  if (itens.length < 2) throw new Error("a IA não devolveu tarefas suficientes — tente de novo");
  return itens;
}

// ---------------------------------------------------------------- explicação

/** A "definição com a IA" do conteúdo teórico: texto curto, com exemplo de código. */
export async function explicarAssunto({ tema, card }) {
  const parte = await conversar({
    sistema: PERSONA,
    maxTokens: 4096,
    temperatura: 0.4,
    contents: [{
      role: "user",
      parts: [{
        text: [
          `Tema: ${tema}`,
          `Assunto: ${card.titulo}`,
          card.descricao ? `Contexto do card: ${corte(card.descricao, 600)}` : "",
          "",
          "Explique este assunto para quem está estudando, em até 450 palavras, nesta ordem:",
          "1. O que é (definição em 2 ou 3 frases).",
          "2. Por que importa na prática.",
          "3. Um exemplo de código curto e comentado, num bloco ``` com a linguagem.",
          "4. Erros comuns.",
          "5. Três perguntas rápidas para a pessoa se autoavaliar (sem as respostas).",
          "Use títulos curtos começando com ## e texto simples. Sem tabelas.",
        ].filter(Boolean).join("\n"),
      }],
    }],
  });
  const texto = textoDe(parte);
  if (!texto) throw new Error("a IA não devolveu a explicação — tente de novo");
  return texto;
}
