// A Lisa escreve a aula completa de um assunto (a apostila, 06/11/2026): todos os pontos do checklist de
// teoria, cada um numa seção que ENSINA o conteúdo — se o item manda "ler a documentação X", a seção traz
// o que a pessoa aprenderia lendo, e o link vai para as fontes. O que sai daqui passa por
// src/dominio/apostila.js antes de virar caderno.

import { personaDo, corte, gerarJson } from "./ia.js";
import { perfilValido } from "@/dominio/perfis.js";
import { validarApostila, juntarSecoes, apostilaCompleta } from "@/dominio/apostila.js";

const SECAO = {
  type: "OBJECT",
  properties: {
    ponto: { type: "INTEGER" },
    titulo: { type: "STRING" },
    conteudo: { type: "STRING" },
  },
  required: ["ponto", "titulo", "conteudo"],
};

const ESQUEMA_DA_APOSTILA = {
  type: "OBJECT",
  properties: {
    titulo: { type: "STRING" },
    introducao: { type: "STRING" },
    secoes: { type: "ARRAY", items: SECAO },
    resumo: { type: "STRING" },
    exercicios: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { pergunta: { type: "STRING" }, resposta: { type: "STRING" } }, required: ["pergunta", "resposta"] },
    },
    fontes: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { titulo: { type: "STRING" }, url: { type: "STRING" }, descricao: { type: "STRING" } }, required: ["titulo", "url"] },
    },
  },
  required: ["titulo", "introducao", "secoes", "resumo", "exercicios", "fontes"],
};

const ESQUEMA_DAS_SECOES = {
  type: "OBJECT",
  properties: { secoes: { type: "ARRAY", items: SECAO } },
  required: ["secoes"],
};

/** O jeito de exemplificar de cada perfil (programação: código; os outros, sem código). */
const EXEMPLOS_DO_PERFIL = {
  programacao: "exemplos de código completos e comentados, em blocos ``` com a linguagem do curso (ex.: ```javascript), e a saída esperada quando fizer sentido",
  musica: "exemplos com as notas pelo nome (Dó–Mi–Sol) ou a cifra, e como tocar ou cantar, passo a passo — sem código",
  idiomas: "frases de exemplo na língua estudada, cada uma com a tradução e o ponto que ela mostra — sem código",
  matematica: "exemplos resolvidos passo a passo, com as contas em texto simples (x^2, sqrt(2), 3/4), sem LaTeX — sem código de programação",
  livre: "exemplos concretos, do jeito que aparecem na prática — sem código de programação",
};

const REGRAS_DO_MARKDOWN = [
  "Formato do texto (`introducao`, `conteudo`, `resumo`, exercícios): Markdown simples, que será mostrado já renderizado:",
  "- subtítulos com ## e ###; parágrafos curtos; listas com - ou 1.; **negrito** para os termos novos; `código em linha`;",
  "- blocos de código entre ``` com a linguagem, com as quebras de linha de verdade (nunca o programa numa linha só);",
  "- tabelas Markdown quando comparar coisas; > para dica ou atenção;",
  "- NADA de HTML, imagens, LaTeX, emojis em excesso ou listas com mais de um nível de recuo.",
];

function blocoDoAssunto({ tema, assunto, pontos, trecho }) {
  return [
    `Curso: ${corte(tema, 160)}`,
    `Assunto: ${corte(assunto.titulo, 200)}`,
    assunto.descricao ? `Descrição: ${corte(assunto.descricao, 600)}` : "",
    assunto.objetivo ? `Objetivo: ${corte(assunto.objetivo, 300)}` : "",
    trecho || "", // curso de um livro: o trecho das páginas do assunto
    "",
    pontos.length
      ? `Checklist de teoria do assunto (os pontos que a aula TEM de cobrir, numerados):\n${pontos.map((p, i) => `${i + 1}. ${corte(p, 200)}`).join("\n")}`
      : "O assunto não tem checklist: cubra o assunto inteiro, do conceito à aplicação, em 4 a 6 pontos seus (use `ponto` 0).",
  ].filter(Boolean).join("\n");
}

const regraDosPontos = [
  "- Cada seção diz em `ponto` qual item do checklist ela ensina (o número). Um item pode ter mais de uma seção; seção extra, fora do checklist, usa `ponto` 0.",
  "- O item manda LER ou CONSULTAR uma fonte (documentação oficial, MDN, um livro, um fórum)? A seção ENSINA o que a pessoa aprenderia lendo — o conteúdo de verdade, com as definições, os detalhes e os exemplos — e a fonte entra em `fontes`, com o link oficial.",
  "- O item manda PEDIR À LISA uma definição? A seção traz a definição completa, explicada.",
  "- O item manda ESCREVER UM RESUMO, LISTAR TERMOS ou REFAZER UM EXEMPLO? A seção é um roteiro guiado: o que o resumo precisa conter, a lista de termos com o significado de cada um, o exemplo resolvido passo a passo.",
];

/**
 * A aula completa. `pontos`: os itens do checklist (textos). Devolve a aula conferida e completa
 * (todos os pontos cobertos): se a primeira resposta deixar pontos de fora, a Lisa escreve só as seções
 * que faltaram, numa segunda chamada menor.
 */
export async function escreverApostila({ tema, assunto, pontos = [], trecho = "", perfil = "programacao" }) {
  const p = perfilValido(perfil);
  // a resposta cortada (grande demais de uma vez) ou ilegível: mais uma vez, com seções mais enxutas
  let bruto = null;
  let ultimoErro = null;
  for (const palavras of ["300 a 700", "200 a 400"]) {
    try {
      bruto = await pedirAula({ tema, assunto, pontos, trecho, p, palavras });
      break;
    } catch (e) {
      ultimoErro = e;
    }
  }
  if (!bruto) throw ultimoErro;

  let conferida = validarApostila(bruto, { pontos });
  if (conferida.faltando.length) {
    // a primeira resposta deixou pontos de fora: só as seções que faltam, numa chamada menor
    const extra = await gerarJson({
      sistema: personaDo(p) + " Agora você completa uma apostila: a aula completa de um assunto.",
      esquema: ESQUEMA_DAS_SECOES,
      maxTokens: 16000,
      pensarPouco: true,
      pedido: [
        blocoDoAssunto({ tema, assunto, pontos, trecho }),
        "",
        `A apostila deste assunto ficou sem as seções dos pontos ${conferida.faltando.join(", ")} do checklist. Escreva SÓ essas seções (uma ou mais por ponto), de 300 a 700 palavras cada: a explicação completa, ${EXEMPLOS_DO_PERFIL[p]}, os erros comuns e uma dica prática.`,
        ...regraDosPontos,
        "",
        ...REGRAS_DO_MARKDOWN,
      ].join("\n"),
    }).catch(() => null);
    const novas = validarApostila({ secoes: extra?.secoes || [] }, { pontos }).apostila.secoes.filter((s) => conferida.faltando.includes(s.ponto));
    const juntada = juntarSecoes(conferida.apostila, novas);
    const cobertos = new Set(juntada.secoes.map((s) => s.ponto));
    conferida = { apostila: juntada, faltando: conferida.faltando.filter((n) => !cobertos.has(n)) };
  }
  const pronta = apostilaCompleta(conferida);
  if (!pronta.ok) throw new Error(`a Lisa não conseguiu montar a apostila (${pronta.motivo}) — tente de novo`);
  return conferida.apostila;
}

function pedirAula({ tema, assunto, pontos, trecho, p, palavras }) {
  return gerarJson({
    sistema: personaDo(p) + " Agora você escreve uma apostila: a aula completa de um assunto, para a pessoa estudar sozinha.",
    esquema: ESQUEMA_DA_APOSTILA,
    maxTokens: 32000,
    pensarPouco: true,
    pedido: [
      blocoDoAssunto({ tema, assunto, pontos, trecho }),
      "",
      "Escreva a AULA COMPLETA deste assunto, como uma apostila de curso: tudo o que a pessoa precisa saber para dominar cada ponto do checklist, sem precisar abrir outra fonte para entender.",
      "",
      "Regras:",
      "- Fique NESTE assunto e neste curso: nada de outro tema nem do que vem depois na trilha.",
      "- `titulo`: o título da aula (curto, sem a palavra \"Apostila\").",
      "- `introducao`: 2 ou 3 parágrafos — o que é o assunto, por que importa e como a aula está organizada.",
      `- \`secoes\`: uma ou mais por item do checklist, na ordem do checklist. Cada seção tem de ${palavras} palavras: a explicação completa, ${EXEMPLOS_DO_PERFIL[p]}, os erros comuns e uma dica prática.`,
      ...regraDosPontos,
      "- `resumo`: os pontos-chave da aula em uma lista curta.",
      "- `exercicios`: 4 a 6 exercícios de fixação sobre a aula, cada um com a resposta comentada.",
      "- `fontes`: 2 a 6 fontes reais e confiáveis (a documentação oficial primeiro), com a URL de verdade (https). Sem inventar endereço: na dúvida, a página inicial da documentação oficial.",
      "",
      ...REGRAS_DO_MARKDOWN,
    ].join("\n"),
  });
}
