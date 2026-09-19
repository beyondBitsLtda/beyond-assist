// Groq como alternativa ao Gemini na Lisa Code.
//
// A extensão fala no formato do Gemini e não sabe que existe outro provedor — de propósito.
// Trocar de modelo não pode exigir republicar a extensão nem mexer no histórico que ela guarda,
// então a tradução mora aqui, num ponto só, e os dois formatos se encontram nesta linha.
//
// A parte que realmente diverge é o `tool calling`. O resto (texto de ida e volta) é quase
// igual nos dois. Por isso este arquivo é quase todo sobre ferramentas:
//
//   Gemini                                   OpenAI/Groq
//   role "model"                             role "assistant"
//   parts[].functionCall {id,name,args}      tool_calls[] {id, function:{name, arguments}}
//   args como objeto                         arguments como STRING de JSON
//   parts[].functionResponse (role "user")   uma mensagem role "tool" por resultado
//   parametersJsonSchema                     parameters
//
// A linha que mais dá trabalho é a do meio: o Gemini manda os argumentos já como objeto e o
// padrão da OpenAI manda uma string de JSON. Esquecer de converter não quebra nada na hora —
// a ferramenta só recebe argumentos vazios e a Lisa parece ter ficado confusa sozinha.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Modelo padrão. Fica em variável porque os nomes na Groq mudam com alguma frequência, e um
// nome morto aqui dentro daria "modelo não encontrado" sem explicar onde consertar.
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/** Converte o histórico do formato do Gemini para o formato de mensagens da OpenAI/Groq. */
export function paraMensagensOpenAI(contents, instrucaoDeSistema) {
  const mensagens = [];
  if (instrucaoDeSistema) mensagens.push({ role: "system", content: instrucaoDeSistema });

  for (const c of contents || []) {
    const partes = c?.parts || [];

    // As respostas de ferramenta vêm com role "user" no Gemini, empacotadas junto. No padrão
    // da OpenAI cada uma é uma mensagem própria, com role "tool" e o id da chamada.
    const respostas = partes.filter((p) => p.functionResponse);
    if (respostas.length) {
      for (const p of respostas) {
        mensagens.push({
          role: "tool",
          tool_call_id: p.functionResponse.id || p.functionResponse.name,
          content: JSON.stringify(p.functionResponse.response ?? {}),
        });
      }
      continue;
    }

    const texto = partes.filter((p) => typeof p.text === "string" && p.text).map((p) => p.text).join("\n");
    const chamadas = partes.filter((p) => p.functionCall?.name);

    if (c.role === "model") {
      const msg = { role: "assistant", content: texto || null };
      if (chamadas.length) {
        msg.tool_calls = chamadas.map((p, i) => ({
          id: p.functionCall.id || `call_${i}`,
          type: "function",
          function: {
            name: p.functionCall.name,
            // String de JSON, não objeto: é aqui que os dois formatos mais se desencontram.
            arguments: JSON.stringify(p.functionCall.args ?? {}),
          },
        }));
      }
      mensagens.push(msg);
    } else if (texto) {
      mensagens.push({ role: "user", content: texto });
    }
  }
  return mensagens;
}

/** Converte as declarações de ferramenta do Gemini para o formato da OpenAI/Groq. */
export function paraFerramentasOpenAI(ferramentasGemini) {
  const decls = (ferramentasGemini || []).flatMap((t) => t.functionDeclarations || []);
  return decls.map((d) => ({
    type: "function",
    function: {
      name: d.name,
      description: d.description,
      // O Gemini chama de parametersJsonSchema; o padrão da OpenAI, de parameters. O conteúdo
      // é o mesmo JSON Schema nos dois.
      parameters: d.parametersJsonSchema || d.parameters || { type: "object", properties: {} },
    },
  }));
}

/** Converte a resposta da Groq de volta para um `Content` do Gemini, que é o que a extensão
 *  entende. Os ids das chamadas precisam sobreviver à volta: é por eles que a resposta da
 *  ferramenta é casada com a chamada no turno seguinte. */
export function paraContentDoGemini(mensagem) {
  const parts = [];
  if (mensagem?.content) parts.push({ text: mensagem.content });

  for (const tc of mensagem?.tool_calls || []) {
    let args = {};
    try {
      args = JSON.parse(tc.function?.arguments || "{}");
    } catch {
      // Modelo menor às vezes devolve JSON quebrado. Melhor entregar a ferramenta com
      // argumentos vazios (ela responde "faltou o quê") do que derrubar o turno inteiro.
      args = {};
    }
    parts.push({ functionCall: { id: tc.id, name: tc.function?.name, args } });
  }

  if (!parts.length) parts.push({ text: "" });
  return { role: "model", parts };
}

/**
 * Um turno da Lisa Code usando a Groq.
 *
 * Mesma assinatura de entrada e saída de runLisaCodeTurn com o Gemini, para quem chama não
 * precisar saber qual provedor está atendendo.
 */
export async function turnoNaGroq(contents, { instrucao, ferramentas } = {}) {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) {
    throw new Error("GROQ_API_KEY não configurada no servidor — pegue uma em console.groq.com e adicione ao ambiente da Lisa");
  }

  const corpo = {
    model: GROQ_MODEL,
    messages: paraMensagensOpenAI(contents, instrucao),
    tools: paraFerramentasOpenAI(ferramentas),
    tool_choice: "auto",
    temperature: 0.6,
  };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    // O nome do modelo é a causa mais provável de um 404 aqui, e é o que a mensagem precisa
    // dizer: os identificadores da Groq mudam, e adivinhar no escuro custa tempo.
    if (res.status === 404) {
      throw new Error(`Groq não conhece o modelo "${GROQ_MODEL}" — ajuste GROQ_MODEL. Resposta: ${detalhe.slice(0, 200)}`);
    }
    if (res.status === 429) {
      const e = new Error("QUOTA_EXCEEDED: limite da Groq atingido. Aguarde e tente de novo.");
      e.code = "QUOTA";
      throw e;
    }
    throw new Error(`Groq respondeu ${res.status}: ${detalhe.slice(0, 300)}`);
  }

  const json = await res.json();
  const mensagem = json?.choices?.[0]?.message;
  if (!mensagem) throw new Error("Groq devolveu uma resposta sem mensagem");
  return paraContentDoGemini(mensagem);
}

export const GROQ_MODELO_ATUAL = GROQ_MODEL;
