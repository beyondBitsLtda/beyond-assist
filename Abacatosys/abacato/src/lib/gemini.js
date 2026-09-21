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
export async function conversar({ contents, sistema, ferramentas }) {
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
      maxOutputTokens: 2048,
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

    const parte = dados?.candidates?.[0]?.content;
    if (!parte) {
      // Resposta vazia costuma ser filtro de segurança do próprio modelo.
      const motivo = dados?.candidates?.[0]?.finishReason;
      throw new Error(motivo === "SAFETY"
        ? "o modelo recusou responder a isso"
        : "o modelo devolveu uma resposta vazia");
    }
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
