import { json } from "@/lib/http.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirLisa } from "@/lib/admin.js";
import { conversar, textoDe, chamadasDe, temModelo } from "@/lib/gemini.js";
import { validarProposta, LIMITES, pareceEstudo, cardsSemMaterial } from "@/dominio/quadroGen.js";
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
            descricao: {
              type: "string",
              description:
                "OBRIGATÓRIA, e nunca o título repetido. Duas a quatro frases: o que é, por que importa, " +
                "e como saber que terminou. Em assunto de estudo, cite material concreto — livro com autor, " +
                "curso, documentação, capítulo.",
            },
            checklist: {
              type: "array",
              description:
                "os passos para concluir este card, na ordem. Use sempre que houver mais de um passo. " +
                "Frases curtas e verificáveis.",
              items: { type: "string" },
            },
            etiqueta: { type: "string", description: "o NOME de uma das etiquetas acima, opcional" },
            prazoEmDias: { type: "number", description: "prazo em dias a partir de hoje, opcional" },
          },
          required: ["titulo", "coluna", "descricao"],
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

PROPONHA DE PRIMEIRA quando o pedido já vier detalhado. Se a pessoa disse o assunto, o ritmo, o nível e quantas tarefas quer, ela já respondeu tudo que importa: chame propor_quadro agora. Perguntar depois disso faz ela repetir o que acabou de escrever.

E se ela disser "cria logo", "não me pergunte mais", "proponha" ou algo assim — PARE de perguntar e proponha na mesma hora, com o que tiver. Insistir depois de um pedido desses é ignorar o que ela falou.

QUANDO TIVER O BASTANTE
Chame propor_quadro. Depois dela, escreva UMA frase curta dizendo o que montou e que é só conferir e confirmar. Não repita a lista de colunas e cards em texto — a tela já mostra tudo.

TODO CARD LEVA DESCRIÇÃO E, QUANDO TIVER PASSOS, CHECKLIST

Isto não é opcional. Um card só com título parece organizado e não ajuda ninguém: quem abre não sabe o que fazer nem quando aquilo está pronto — e preencher trinta descrições depois nunca acontece.

A descrição tem duas a quatro frases e responde três coisas: o que é, por que importa, e como saber que terminou. Nunca repita o título com outras palavras.

A checklist são os passos, na ordem, em frases curtas e verificáveis. Use sempre que o card tiver mais de um passo.

SE O ASSUNTO FOR ESTUDO OU APRENDIZADO
A descrição precisa apontar MATERIAL CONCRETO, com nome: livro e autor, curso, documentação oficial, capítulo. "Estude arrays" não serve; "Arrays e seus métodos — Eloquent JavaScript (Marijn Haverbeke), cap. 4, e a referência de Array no MDN" serve. Cite o que existe de verdade e é conhecido na área; se não tiver certeza de uma fonte, prefira a documentação oficial da linguagem ou ferramenta a inventar um título.

LIMITES
No máximo ${LIMITES.colunas} colunas, ${LIMITES.cards} cards e ${LIMITES.etiquetas} etiquetas, e até ${LIMITES.itensDeChecklist} itens por checklist.

SE A PESSOA DISSER QUANTOS CARDS QUER, FAÇA O QUE ELA PEDIU. "No mínimo 30 tarefas" quer dizer trinta, não oito. O teto de ${LIMITES.cards} é o limite do sistema, e não uma sugestão de tamanho — só recuse acima dele, e aí diga o porquê.

Quando ela não disser um número, proponha o que faz começar — em geral entre oito e quinze — em vez de tudo que existirá um dia.

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

    /* UM QUADRO É UMA RESPOSTA GRANDE.
     *
     * Trinta cards, cada um com descrição de quatro frases e uma checklist, passam
     * folgadamente de dez mil tokens de argumento. Com o teto padrão de 2048 o modelo era
     * cortado no meio da chamada de função: a resposta voltava vazia, e a tela dizia "Me
     * conte um pouco mais" — a cada tentativa, sem nada indicando que o problema era o
     * tamanho. A pessoa respondia, e recebia a mesma frase de novo. */
    const TETO = 16384;

    let resposta = await conversar({ contents, sistema, ferramentas: [FERRAMENTA], maxTokens: TETO });
    let proposta = chamadasDe(resposta).find((c) => c.nome === "propor_quadro");

    if (!proposta) {
      const texto = textoDe(resposta);
      if (texto) return json({ ok: true, texto });

      // Sem texto E sem proposta. Dizer "me conte mais" aqui é empurrar para a pessoa um
      // problema que não é dela.
      if (resposta.motivoDeParada === "MAX_TOKENS") {
        return json({
          ok: true,
          texto: "O quadro que eu estava montando ficou grande demais e foi cortado no meio. " +
            "Peça menos cards de uma vez — dá para começar com quinze e acrescentar o resto depois.",
        });
      }
      return json({
        ok: true,
        texto: "Não consegui montar uma resposta para isso. Tente dizer de outro jeito, " +
          "ou comece pelas etapas: por onde o trabalho passa, do começo ao fim?",
      });
    }

    let conferida = validarProposta(proposta.args);

    // Quadro de estudo sem material indicado é o outro erro que não pode passar. A conferência
    // mora junto com a de estrutura para as duas usarem a MESMA segunda chance: duas idas ao
    // modelo pelo mesmo motivo seriam o dobro do custo e da espera.
    const doQueSeTrata = [
      conferida.proposta?.nome,
      conferida.proposta?.descricao,
      mensagens.map((m) => m.texto).join(" "),
    ];
    if (conferida.ok && pareceEstudo(...doQueSeTrata)) {
      const semMaterial = cardsSemMaterial(conferida.proposta);
      if (semMaterial.length) {
        conferida = {
          ...conferida,
          ok: false,
          erros: [
            `este é um quadro de estudo e ${semMaterial.length} card(s) não indicam material ` +
            `(livro com autor, capítulo, documentação, curso): ${semMaterial.slice(0, 6).join(", ")}`,
          ],
        };
      }
    }

    // UMA SEGUNDA CHANCE, E SÓ UMA.
    //
    // O erro mais comum é card sem descrição: o modelo se empolga com a estrutura e larga os
    // títulos soltos. Devolver isso para a PESSOA gastaria a vez dela para corrigir um
    // descuido que não foi dela — e ela responderia "põe as descrições", que é exatamente o
    // que o servidor pode pedir sozinho.
    //
    // Uma só porque a segunda falha em geral é de limite (cards demais), e insistir nisso
    // vira um laço caro que termina no mesmo lugar.
    if (!conferida.ok) {
      contents.push({ role: "model", parts: resposta.parts });
      contents.push({
        role: "user",
        parts: [{
          text:
            `A proposta não passou na conferência do sistema: ${conferida.erros.join("; ")}.\n\n` +
            `Refaça chamando propor_quadro de novo, corrigindo SÓ isso. ` +
            `Lembre: toda descrição tem duas a quatro frases dizendo o que é, por que importa e ` +
            `como saber que terminou — nunca o título repetido.`,
        }],
      });

      resposta = await conversar({ contents, sistema, ferramentas: [FERRAMENTA], maxTokens: TETO });
      proposta = chamadasDe(resposta).find((c) => c.nome === "propor_quadro");
      if (proposta) {
        const segunda = validarProposta(proposta.args);
        // Na segunda vez a falta de material não derruba mais: o quadro sai como veio, e
        // insistir de novo custaria uma terceira chamada para, na prática, o mesmo texto.
        if (segunda.ok) conferida = segunda;
      }
    }

    if (!conferida.ok) {
      // Insistiu no erro. Agora sim é assunto de quem está conversando.
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
