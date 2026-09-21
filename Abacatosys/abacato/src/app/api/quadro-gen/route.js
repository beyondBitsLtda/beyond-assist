import { json } from "@/lib/http.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirLisa } from "@/lib/admin.js";
import { conversar, textoDe, chamadasDe, temModelo } from "@/lib/gemini.js";
import { validarProposta, LIMITES } from "@/dominio/quadroGen.js";
import { CORES } from "@/dominio/cores.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORIA = 20;

/**
 * A ÚNICA ferramenta desta conversa, e ela não cria nada.
 *
 * Devolve a proposta para a tela mostrar. O que cria é outra rota, depois de alguém clicar.
 * Uma ferramenta que escrevesse no banco aqui tiraria justamente o passo que dá valor a isto:
 * olhar o quadro inteiro antes de ele existir.
 */
const FERRAMENTA = {
  name: "propor_quadro",
  description:
    "Monta a PROPOSTA do quadro e a mostra para a pessoa aprovar. Não cria nada — quem cria é ela, clicando. " +
    "Use quando já souber as etapas e o que entra em cada uma. Se ainda faltar informação, PERGUNTE antes.",
  parameters: {
    type: "object",
    properties: {
      nome: { type: "string", description: "nome do quadro" },
      descricao: { type: "string", description: "uma frase sobre para que ele serve" },
      colunas: {
        type: "array",
        description: "as etapas, na ordem em que o trabalho anda. A primeira é a fila de entrada.",
        items: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
      },
      etiquetas: {
        type: "array",
        description: "categorias transversais (tipo, cliente, prioridade). Opcional.",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            cor: { type: "string", description: "hexadecimal da paleta" },
          },
          required: ["nome"],
        },
      },
      cards: {
        type: "array",
        description: "as tarefas iniciais. Concretas e acionáveis — 'Levantar requisitos com o cliente', não 'Requisitos'.",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            coluna: { type: "string", description: "o NOME de uma das colunas acima" },
            descricao: { type: "string", description: "opcional" },
            etiqueta: { type: "string", description: "o NOME de uma das etiquetas acima, opcional" },
            prazoEmDias: { type: "number", description: "prazo em dias a partir de hoje, opcional" },
          },
          required: ["titulo", "coluna"],
        },
      },
    },
    required: ["nome", "colunas"],
  },
};

const INSTRUCOES = `Você é a Lisa montando um quadro de tarefas com alguém, no Abacato System.

A pessoa vai dizer sobre o que é o quadro. Seu trabalho é ENTENDER o trabalho dela antes de propor a forma dele.

COMO CONDUZIR

Faça UMA pergunta por vez. Uma lista de seis perguntas de uma vez não é conversa, é formulário — e ninguém responde formulário direito.

Pergunte o que muda a forma do quadro, e nada além disso. Em geral bastam três ou quatro:
- Quais são as etapas por que uma coisa passa, do começo ao fim?
- O que já existe hoje para entrar nele?
- Tem prazo, ciclo ou data que se repete?
- Vale separar por tipo, cliente ou prioridade? (isso vira etiqueta)

Não pergunte o que você pode deduzir. Se a pessoa disse "quadro de recrutamento", você já sabe que as etapas terminam em contratado ou recusado — confirme, não interrogue.

Pare de perguntar assim que der para montar algo útil. Um quadro imperfeito que a pessoa ajusta em dois cliques vale mais que dez perguntas.

QUANDO TIVER O BASTANTE
Chame propor_quadro. Depois dela, escreva UMA frase curta dizendo o que montou e que é só conferir e confirmar. Não repita a lista de colunas e cards em texto — a tela já mostra tudo.

LIMITES
No máximo ${LIMITES.colunas} colunas, ${LIMITES.cards} cards e ${LIMITES.etiquetas} etiquetas. Um quadro de trinta cards não é um plano, é uma parede: proponha o que faz começar, não tudo que existirá um dia.

A primeira coluna é a fila de entrada ("A fazer", "Entrada", "Backlog"). A última é o fim ("Feito", "Entregue").

Cards concretos e acionáveis: "Levantar requisitos com o cliente", e não "Requisitos".

CORES DAS ETIQUETAS, só estas: ${CORES.map((c) => `${c.cor} (${c.nome})`).join(", ")}.

SE PEDIREM OUTRA COISA
Esta conversa monta um quadro. Se a pessoa perguntar outra coisa, responda curto e traga de volta — ela tem a Lisa normal, no botão do canto, para o resto.

Você fala português brasileiro, em frases curtas. Nada de "claro!" nem emoji.`;

/**
 * POST /api/quadro-gen   body: { mensagens, fusoMinutos }
 *
 * A conversa que desenha um quadro. Devolve `{ texto, proposta }` — a proposta só aparece
 * quando o modelo chamou `propor_quadro`, e ela ainda não é nada no banco.
 */
export async function POST(req) {
  try {
    const usuario = await exigirLisa(req);
    if (!temModelo()) throw new ErroDeAcesso(503, "a assistente não está ligada neste servidor");

    const corpo = await req.json().catch(() => ({}));
    const fuso = Number.isFinite(corpo.fusoMinutos) ? corpo.fusoMinutos : 180;
    const mensagens = Array.isArray(corpo.mensagens) ? corpo.mensagens.slice(-MEMORIA) : [];
    if (!mensagens.length) throw new ErroDeAcesso(400, "não veio nada para conversar");

    const contents = mensagens
      .filter((m) => m && typeof m.texto === "string" && m.texto.trim())
      .map((m) => ({
        role: m.quem === "lisa" ? "model" : "user",
        parts: [{ text: String(m.texto).slice(0, 4000) }],
      }));

    const hoje = new Date(Date.now() - fuso * 60000).toISOString().slice(0, 10);
    const sistema = `${INSTRUCOES}\n\nQuem está montando: ${usuario.nome}.\nHoje é ${hoje}.`;

    const resposta = await conversar({ contents, sistema, ferramentas: [FERRAMENTA] });
    const chamadas = chamadasDe(resposta);
    const proposta = chamadas.find((c) => c.nome === "propor_quadro");

    if (!proposta) {
      // Ainda perguntando. É o caso mais comum, e é o que esta tela existe para fazer.
      return json({ ok: true, texto: textoDe(resposta) || "Me conte um pouco mais." });
    }

    const conferida = validarProposta(proposta.args);
    if (!conferida.ok) {
      // O modelo propôs algo que o sistema não aceita. Devolver o motivo para a PESSOA, e não
      // para o modelo, é deliberado: mandar de volta para ele gastaria outra rodada e ele
      // costuma repetir o mesmo erro. Uma frase e a conversa continua.
      return json({
        ok: true,
        texto: `Montei uma proposta que não passou na conferência: ${conferida.erros.join("; ")}. Me diga como simplificar.`,
      });
    }

    // O texto do modelo pode vir vazio quando ele só chama a ferramenta — e uma tela que
    // mostra uma proposta sem uma linha de explicação parece que travou.
    const texto = textoDe(resposta) ||
      "Montei uma proposta. Confira abaixo e, se estiver bom, é só criar.";

    return json({ ok: true, texto, proposta: conferida.proposta, avisos: conferida.avisos });
  } catch (e) {
    return respostaDeErro(e);
  }
}
