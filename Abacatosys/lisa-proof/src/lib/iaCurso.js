// A Lisa propõe um curso: módulos, assuntos, objetivos e tarefas de teoria. Só PROPÕE — quem
// cria o quadro é src/lib/cursos.js, depois que a pessoa olhou e confirmou.

import { PERSONA, gerarJson } from "./ia.js";
import { NIVEIS } from "@/dominio/plano.js";
import { NIVEIS_DO_CURSO, validarCurso } from "@/dominio/curso.js";

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
