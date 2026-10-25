// A Lisa propõe um curso: módulos, assuntos, objetivos e tarefas de teoria. Só PROPÕE — quem
// cria o quadro é src/lib/cursos.js, depois que a pessoa olhou e confirmou.

import { PERSONA, gerarJson } from "./ia.js";
import { NIVEIS } from "@/dominio/plano.js";
import { NIVEIS_DO_CURSO, validarCurso } from "@/dominio/curso.js";
import { validarCursoDoLivro } from "@/dominio/cursoDoLivro.js";

const ESQUEMA_DO_CURSO = {
  type: "OBJECT",
  properties: {
    nome: { type: "STRING" },
    descricao: { type: "STRING" },
    resumo: { type: "STRING" },
    modulos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          assuntos: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                titulo: { type: "STRING" },
                descricao: { type: "STRING" },
                objetivo: { type: "STRING" },
                nivel: { type: "STRING", enum: NIVEIS },
                dias: { type: "INTEGER" },
                tarefas: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["titulo", "descricao", "objetivo", "nivel", "dias", "tarefas"],
            },
          },
        },
        required: ["nome", "assuntos"],
      },
    },
  },
  required: ["nome", "descricao", "resumo", "modulos"],
};

/**
 * @param tema      "JavaScript", "SQL para análise de dados"...
 * @param nivel     chave de NIVEIS_DO_CURSO
 * @param objetivo  o que a pessoa quer conseguir fazer no fim (opcional)
 * @param assuntos  quantos assuntos, mais ou menos (assuntosParaODuracao)
 * @param dias      quantos dias de estudo o curso tem no total
 */
export async function proporCurso({ tema, nivel, objetivo, assuntos, dias, semanas }) {
  const bruto = await gerarJson({
    sistema: PERSONA,
    esquema: ESQUEMA_DO_CURSO,
    maxTokens: 16000,
    pensarPouco: true,
    pedido: [
      `Monte um CURSO de "${tema}".`,
      `Nível de quem vai estudar: ${NIVEIS_DO_CURSO[nivel] || NIVEIS_DO_CURSO.iniciante}.`,
      objetivo ? `Objetivo de quem vai estudar: ${objetivo}` : "",
      `Duração: ${semanas} semana(s), cerca de ${dias} dias de estudo no total.`,
      "",
      "Regras:",
      `- Cerca de ${assuntos} assuntos no total (pode variar 20% para cima ou para baixo), divididos em 3 a 8 módulos.`,
      "- Ordem PROGRESSIVA: do fundamento ao avançado, cada assunto usando o que veio antes. Comece no ponto certo para o nível informado (não ensine o básico a quem é avançado).",
      "- Módulo: nome curto (ex.: \"Fundamentos\", \"Funções e escopo\").",
      "- Assunto: `titulo` claro e específico (ex.: \"Arrays e métodos map/filter/reduce\").",
      "- `descricao`: 1 a 2 frases do que o assunto cobre.",
      "- `objetivo`: uma frase com o que a pessoa saberá fazer ao terminar.",
      "- `nivel`: basico, intermediario ou avancado (dentro do curso).",
      "- `dias`: 1 a 5 dias de estudo, conforme o peso; a soma deve ficar perto da duração.",
      "- `tarefas`: 3 a 5 tarefas de estudo TEÓRICO, cada uma começando com verbo e em até 110 caracteres: ler a documentação oficial ou uma apostila (cite a fonte, ex.: MDN), ler uma discussão de fórum, pedir a definição à Lisa, escrever um resumo próprio. A prática (quiz, exercícios, projetos) a Lisa cuida à parte.",
      "- `nome` do curso: curto, sem a palavra STUDY. `descricao`: 1 frase. `resumo`: 2 a 3 frases sobre a lógica do curso.",
    ].filter(Boolean).join("\n"),
  });
  return validarCurso({ ...bruto, tema, nivel });
}

// ---------------------------------------------------------------- curso a partir de um livro

const ESQUEMA_DO_CURSO_DO_LIVRO = {
  ...ESQUEMA_DO_CURSO,
  properties: {
    ...ESQUEMA_DO_CURSO.properties,
    tema: { type: "STRING" },
    modulos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          assuntos: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                ...ESQUEMA_DO_CURSO.properties.modulos.items.properties.assuntos.items.properties,
                secao: { type: "STRING" },
                paginas: { type: "OBJECT", properties: { de: { type: "INTEGER" }, ate: { type: "INTEGER" } }, required: ["de", "ate"] },
              },
              required: ["titulo", "descricao", "objetivo", "nivel", "dias", "tarefas", "secao", "paginas"],
            },
          },
        },
        required: ["nome", "assuntos"],
      },
    },
  },
  required: ["nome", "tema", "descricao", "resumo", "modulos"],
};

/**
 * A Lisa propõe um curso a partir de um livro: lê o sumário escolhido e o começo de cada seção
 * (material, de src/dominio/cursoDoLivro.js) e monta módulos = capítulos, assuntos = trechos de
 * páginas. Só PROPÕE, como o curso comum.
 *
 * @param livro     { id, titulo, autor, paginas }
 * @param material  o texto que a IA lê (sumário + trechos com [p. N])
 * @param faixas    as faixas de páginas escolhidas [{ de, ate }]
 */
export async function proporCursoDoLivro({ livro, material, faixas, nivel, objetivo, assuntos, dias, semanas }) {
  const bruto = await gerarJson({
    sistema: PERSONA,
    esquema: ESQUEMA_DO_CURSO_DO_LIVRO,
    maxTokens: 20000,
    pensarPouco: true,
    pedido: [
      `Monte um CURSO de estudo baseado no livro abaixo, para quem vai estudar por ele.`,
      `Nível de quem vai estudar: ${NIVEIS_DO_CURSO[nivel] || NIVEIS_DO_CURSO.iniciante}.`,
      objetivo ? `Objetivo de quem vai estudar: ${objetivo}` : "",
      `Duração: ${semanas} semana(s), cerca de ${dias} dias de estudo no total.`,
      `Páginas escolhidas: ${faixas.map((f) => `${f.de}–${f.ate}`).join(", ")}.`,
      "",
      "Regras:",
      "- SIGA O LIVRO: a ordem do curso é a ordem do livro. Cada módulo corresponde a um capítulo (ou a uma parte, se os capítulos forem curtos); use o nome do capítulo, curto.",
      `- Cerca de ${assuntos} assuntos no total (pode variar 20%). Cada assunto cobre um trecho CONTÍNUO de páginas do livro, em \`paginas\` { de, ate } — números de página reais do material ([p. N]), dentro das páginas escolhidas, sem buracos grandes entre um assunto e o próximo e sem repetir trechos.`,
      "- Trecho de 3 a 25 páginas por assunto, conforme a densidade; seção grande pode virar mais de um assunto.",
      "- `secao`: o título da seção do livro de onde o assunto vem.",
      "- `titulo`: o conceito que o trecho ensina (ex.: \"Closures e escopo léxico\"), não \"Capítulo 3\".",
      "- `descricao`: 1 a 2 frases do que o trecho cobre, com os termos do livro. `objetivo`: o que a pessoa saberá fazer depois.",
      "- `nivel`: basico, intermediario ou avancado (dentro do curso). `dias`: 1 a 5, pelo tamanho e pela dificuldade do trecho; a soma perto da duração.",
      "- `tarefas`: 2 a 4 tarefas de estudo sobre o CONTEÚDO do trecho, começando com verbo, até 110 caracteres cada: escrever no caderno um resumo de X, refazer o exemplo da pág. N, explicar com as próprias palavras a diferença entre A e B, listar os termos novos. NÃO inclua a tarefa de ler as páginas — ela é posta automaticamente. A prática (quiz, exercícios, projetos) a Lisa cuida à parte.",
      "- Pule o que não é conteúdo de estudo (capa, agradecimentos, índice remissivo, bibliografia), a menos que seja pedido.",
      "- `tema`: o assunto do livro em 2 a 5 palavras (ex.: \"JavaScript\", \"Estruturas de dados em C\").",
      "- `nome` do curso: curto, sem a palavra STUDY (ex.: o título do livro, encurtado). `descricao`: 1 frase. `resumo`: 2 a 3 frases sobre a lógica do curso.",
      "",
      material,
    ].filter(Boolean).join("\n"),
  });
  return validarCursoDoLivro({ ...bruto, tema: bruto?.tema || livro.titulo, nivel }, { livro, faixas });
}
