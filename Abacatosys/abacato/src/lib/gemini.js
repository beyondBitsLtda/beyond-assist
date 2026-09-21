/**
 * O modelo que a Lisa usa, falado direto pela API REST.
 *
 * Sem SDK: a biblioteca oficial do Google traz dependências que não rodam no runtime da
 * Cloudflare, e o que a gente precisa aqui é uma chamada HTTP com JSON. Menos código, menos
 * coisa para quebrar num deploy.
 *
 * VÁRIAS CHAVES, UMA FILA. O plano gratuito do Gemini tem cota por projeto; com uma chave só,
 * um dia movimentado derruba a assistente até a meia-noite. A lista é percorrida em ordem e a
 * primeira que responder ganha — e a que devolveu 429 fica marcada como cansada por alguns
 * minutos, para não gastar uma ida de rede toda vez só para levar o mesmo não.
 */

const MODELO = process.env.GEMINI_CHAT_MODEL || "gemini-3.6-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Quanto tempo uma chave que estourou a cota fica de fora. */
const DESCANSO_MS = 5 * 60 * 1000;
const cansadas = new Map();

function chaves() {
  return String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function temModelo() {
  return chaves().length > 0;
}

/** As chaves que valem tentar agora: as descansadas primeiro, na ordem em que foram dadas. */
function disponiveis() {
  const agora = Date.now();
  const todas = chaves();
  const prontas = todas.filter((k) => (cansadas.get(k) || 0) < agora);
  // Se TODAS estão de castigo, tenta assim mesmo: melhor um 429 do que dizer que não há
  // assistente quando a cota pode ter virado antes da hora.
  return prontas.length ? prontas : todas;
}

/**
 * Uma rodada de conversa com o modelo.
 *
 * `contents` é o histórico no formato do Gemini; `ferramentas` são as declarações de função.
 * Devolve a parte de conteúdo da primeira candidata — texto, chamadas de função, ou os dois.
 */
export async function conversar({ contents, sistema, ferramentas, maxTokens }) {
  const lista = disponiveis();
  if (!lista.length) {
    throw new Error("a assistente não está configurada neste servidor (falta GEMINI_API_KEYS)");
  }

  const corpo = {
    contents,
    ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
    ...(ferramentas?.length ? { tools: [{ functionDeclarations: ferramentas }] } : {}),
    generationConfig: {
      // Baixa de propósito: esta assistente cria tarefas e muda prazos. Criatividade aqui não
      // é qualidade, é risco de inventar um id que não existe.
      temperature: 0.2,
      // Quem chama diz de quanto precisa.
      //
      // O padrão serve a uma resposta de conversa. Quem devolve ESTRUTURA — um quadro com
      // trinta cards, cada um com descrição e checklist — precisa de muito mais: com 2048 o
      // modelo era cortado no meio da chamada de função e devolvia uma resposta vazia, que
      // na tela virava "Me conte um pouco mais" a cada tentativa. A pessoa repetia o pedido
      // e recebia a mesma frase, sem nada dizendo que o problema era tamanho.
      maxOutputTokens: Number.isFinite(maxTokens) ? maxTokens : 2048,
    },
  };

  let ultimoErro = null;
  for (const chave of lista) {
    let resposta;
    try {
      resposta = await fetch(`${BASE}/${MODELO}:generateContent?key=${encodeURIComponent(chave)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
    } catch (e) {
      ultimoErro = new Error(`não consegui falar com o modelo: ${e.message}`);
      continue;
    }

    if (resposta.status === 429 || resposta.status === 503) {
      cansadas.set(chave, Date.now() + DESCANSO_MS);
      ultimoErro = new Error("a cota do modelo acabou por agora — tente daqui a alguns minutos");
      continue;
    }

    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      // A mensagem do Google costuma dizer o que falta (chave inválida, modelo inexistente).
      // Guardar e seguir: outra chave pode estar boa.
      ultimoErro = new Error(dados?.error?.message || `o modelo respondeu ${resposta.status}`);
      continue;
    }

    const candidata = dados?.candidates?.[0];
    const parte = candidata?.content;
    const motivo = candidata?.finishReason;

    if (!parte) {
      // Resposta vazia costuma ser filtro de segurança do próprio modelo — ou corte por
      // tamanho, que é indistinguível daqui se não olharmos o motivo.
      throw new Error(
        motivo === "SAFETY" ? "o modelo recusou responder a isso"
        : motivo === "MAX_TOKENS" ? "a resposta não coube no limite de tamanho"
        : "o modelo devolveu uma resposta vazia"
      );
    }

    // POR QUE O MOTIVO VIAJA JUNTO COM O CONTEÚDO
    //
    // "Parou porque terminou" e "parou porque acabou o espaço" chegam aqui com a mesma cara:
    // um objeto de conteúdo. Quem chamou precisa distinguir os dois para poder dizer a
    // verdade — sem isto, uma chamada de função cortada no meio vira "resposta vazia" e a
    // tela pede à pessoa que repita o que já disse.
    parte.motivoDeParada = motivo || null;
    return parte;
  }

  throw ultimoErro || new Error("nenhuma chave do modelo respondeu");
}

/** O texto de uma resposta, juntando as partes de texto e ignorando as de função. */
export function textoDe(conteudo) {
  return (conteudo?.parts || [])
    .map((p) => p.text)
    .filter(Boolean)
    .join("")
    .trim();
}

/** As chamadas de função pedidas pelo modelo nesta rodada. */
export function chamadasDe(conteudo) {
  return (conteudo?.parts || [])
    .map((p) => p.functionCall)
    .filter(Boolean)
    .map((f) => ({ nome: f.name, args: f.args || {} }));
}
