import { json } from "@/lib/http.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirLisa, podeUsarLisa } from "@/lib/admin.js";
import { conversar, textoDe, chamadasDe, temModelo } from "@/lib/gemini.js";
import { FERRAMENTAS, QUE_MUDAM, executar } from "@/lib/lisaFerramentas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/lisa — esta conta pode falar com a assistente?
 *
 * A tela pergunta uma vez ao carregar, para não desenhar um botão que só dá 403 ao ser
 * clicado. Quem decide de verdade é o POST — esconder um botão não é permissão.
 */
export async function GET(req) {
  try {
    const { usuario, pode } = await podeUsarLisa(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
    return json({ ok: true, podeUsar: pode && temModelo() });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** Quantas rodadas de ferramenta antes de parar.
 *
 *  Um modelo pode entrar em laço — chamar `listar_quadros` para sempre, ou repetir a mesma
 *  busca com o mesmo termo. Seis rodadas dão folga para "acha o quadro, acha o card, muda o
 *  prazo, confere" e cortam o laço antes de virar conta de API. */
const MAXIMO_DE_RODADAS = 6;

/** Quantas mensagens do histórico voltam para o modelo. O suficiente para a conversa fazer
 *  sentido, pouco o bastante para caber e custar pouco. */
const MEMORIA = 16;

const INSTRUCOES = `Você é a Lisa, a assistente do Abacato System — o sistema de quadros de tarefas e documentação da Beyond Bits.

Você conversa em português brasileiro, com frases curtas e diretas. Nada de "claro!", "com certeza!" nem emoji.

COMO VOCÊ TRABALHA

Você tem ferramentas para ler e mexer no Abacato. Use-as em vez de adivinhar:
- Nunca invente um id. Descubra com listar_quadros, ver_quadro, procurar_cards ou listar_projetos.
- Antes de criar ou mudar alguma coisa, tenha certeza de ONDE. Se houver mais de um quadro, coluna ou card possível, PERGUNTE em vez de escolher.
- Depois de agir, diga em uma frase o que foi feito. Não repita a lista inteira do que leu.

O QUE VOCÊ NÃO FAZ
- Não apaga, não arquiva e não remove nada. Se pedirem, explique que isso é feito na tela, de propósito.
- Não dá nem tira acesso de ninguém. Isso é decisão de quem é dono.
- Não responde sobre dados de quem você não alcança: suas ferramentas já respeitam a permissão de quem está falando. Se vier "você não tem permissão", conte isso com naturalidade.

QUADRO E PROJETO SÃO COISAS DIFERENTES
Um QUADRO guarda tarefas em colunas. Um PROJETO guarda documentos em pastas. Eles têm listas separadas de quem acessa. Não confunda um com o outro.

CONVERSA GERAL
Se a pergunta não for sobre o Abacato, responda normalmente, com o que você sabe. Você é uma assistente, não um formulário. Só não invente fatos sobre o sistema — para isso, use as ferramentas.`;

/**
 * POST /api/lisa   body: { mensagens: [{ quem: "pessoa"|"lisa", texto }], fusoMinutos }
 *
 * ------------------------------------------------------------------------------------------
 * O LAÇO DO AGENTE RODA AQUI, E ISSO É UMA DECISÃO DE SEGURANÇA.
 *
 * A Lisa "de fora" — a assistente que já existe no outro sistema — tem o modelo, o índice e o
 * histórico. Seria mais rápido mandar a pergunta para lá. Mas as AÇÕES precisam da permissão
 * de QUEM ESTÁ FALANDO: criar um card, mudar um prazo. Executadas do outro lado, elas usariam
 * a credencial do serviço, e qualquer pessoa com acesso à assistente passaria a ter acesso a
 * tudo — o contrário do que a tela de "Quem acessa" promete.
 *
 * Por isso o laço mora no Abacato, com o cookie da sessão em mãos, e cada ferramenta passa
 * pelo mesmo `exigir()` das rotas normais. A Lisa não ganha poder nenhum além do seu.
 * ------------------------------------------------------------------------------------------
 */
export async function POST(req) {
  try {
    // A liberação vem do BANCO, e é conferida antes de qualquer outra coisa: antes de gastar
    // cota do modelo, antes de ler quadro nenhum.
    const usuario = await exigirLisa(req);

    if (!temModelo()) {
      throw new ErroDeAcesso(503, "a assistente não está ligada neste servidor — falta a chave do modelo");
    }

    const corpo = await req.json().catch(() => ({}));
    const fuso = Number.isFinite(corpo.fusoMinutos) ? corpo.fusoMinutos : 180;
    const mensagens = Array.isArray(corpo.mensagens) ? corpo.mensagens.slice(-MEMORIA) : [];
    if (!mensagens.length) throw new ErroDeAcesso(400, "não veio pergunta nenhuma");

    // O histórico vira o formato do Gemini. O papel "model" é o que ele chama de si mesmo.
    const contents = mensagens
      .filter((m) => m && typeof m.texto === "string" && m.texto.trim())
      .map((m) => ({
        role: m.quem === "lisa" ? "model" : "user",
        parts: [{ text: String(m.texto).slice(0, 8000) }],
      }));

    // Quem é a pessoa e que dia é hoje entram na instrução, e não no histórico: assim não
    // gastam uma rodada e não podem ser "esquecidos" quando a conversa fica longa.
    const hoje = new Date(Date.now() - fuso * 60000).toISOString().slice(0, 10);
    const sistema = `${INSTRUCOES}\n\nQuem está falando com você: ${usuario.nome} (${usuario.email}).\nHoje é ${hoje}.`;

    const acoes = [];
    let rodadas = 0;

    while (rodadas < MAXIMO_DE_RODADAS) {
      rodadas += 1;
      const resposta = await conversar({ contents, sistema, ferramentas: FERRAMENTAS });
      const chamadas = chamadasDe(resposta);

      if (!chamadas.length) {
        const texto = textoDe(resposta);
        return json({
          ok: true,
          texto: texto || "Não consegui formular uma resposta para isso.",
          acoes,
        });
      }

      // A resposta do modelo (com as chamadas) precisa voltar ao histórico ANTES dos
      // resultados: sem ela, a rodada seguinte recebe resultados de funções que, para o
      // modelo, ninguém pediu.
      contents.push({ role: "model", parts: resposta.parts });

      const respostasDasFerramentas = [];
      for (const chamada of chamadas) {
        const resultado = await executar(req, chamada.nome, chamada.args, fuso);
        if (QUE_MUDAM.has(chamada.nome) && resultado?.feito) {
          acoes.push({ ferramenta: chamada.nome, resultado });
        }
        respostasDasFerramentas.push({
          functionResponse: { name: chamada.nome, response: resultado },
        });
      }
      contents.push({ role: "user", parts: respostasDasFerramentas });
    }

    // Estourou as rodadas. Dizer isso é melhor que devolver silêncio: quem está esperando
    // precisa saber que o pedido parou no meio, e não que foi feito.
    return json({
      ok: true,
      texto: "Me perdi no meio deste pedido — dei voltas demais sem chegar a uma resposta. Tente dividir em passos menores.",
      acoes,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
