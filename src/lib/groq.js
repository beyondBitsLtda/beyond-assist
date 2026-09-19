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

import { pickKeyIndex, markCooldown, markOk } from "./geminiKeyHealth.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Várias chaves em rodízio, igual ao Gemini. A camada gratuita da Groq é por CONTA, então
// várias contas multiplicam a cota do dia — mesma ideia que fez o pool do Gemini chegar a 35.
//
// `GROQ_API_KEY` (singular) continua valendo como atalho de uma chave só: quem já tinha isso
// configurado não precisa mexer em nada.
const CHAVES = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

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
  if (!CHAVES.length) {
    throw new Error("GROQ_API_KEYS não configurada no servidor — pegue chaves em console.groq.com e adicione ao ambiente da Lisa (várias, separadas por vírgula)");
  }

  const corpo = {
    model: GROQ_MODEL,
    messages: paraMensagensOpenAI(contents, instrucao),
    tools: paraFerramentasOpenAI(ferramentas),
    tool_choice: "auto",
    temperature: 0.6,
  };

  // Rodízio com as mesmas regras do Gemini: cada tentativa numa chave diferente, respeitando
  // o cooldown de quem já falhou, e nunca repetindo uma que já falhou NESTA chamada.
  const tentadas = new Set();
  let ultimoErro;
  for (let tentativa = 1; tentativa <= Math.min(3, CHAVES.length + 1); tentativa++) {
    const indice = await pickKeyIndex(CHAVES.length, GROQ_MODEL, tentadas);
    tentadas.add(indice);

    let res;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${CHAVES[indice]}`, "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
    } catch (err) {
      // Falha de REDE, não da chave: castigar a chave por isso tiraria de circulação uma que
      // está boa. Tenta a próxima sem marcar nada.
      ultimoErro = err;
      continue;
    }

    if (res.ok) {
      await markOk(indice, GROQ_MODEL);
      const json = await res.json();
      const mensagem = json?.choices?.[0]?.message;
      if (!mensagem) throw new Error("Groq devolveu uma resposta sem mensagem");
      return paraContentDoGemini(mensagem);
    }

    const detalhe = await res.text().catch(() => "");
    const classificado = classificarErroDaGroq(res.status, detalhe);

    if (!classificado.transitorio) {
      // Modelo inexistente e corpo malformado não melhoram trocando de chave — e insistir
      // gastaria as outras duas tentativas para chegar na mesma mensagem.
      if (classificado.marcar) await markCooldown(indice, GROQ_MODEL, { untilMs: classificado.ateMs, reason: classificado.motivo, error: detalhe.slice(0, 200) });
      throw new Error(classificado.mensagem);
    }

    await markCooldown(indice, GROQ_MODEL, { untilMs: classificado.ateMs, reason: classificado.motivo, error: detalhe.slice(0, 200) });
    ultimoErro = Object.assign(new Error(classificado.mensagem), { code: classificado.code });
  }

  throw ultimoErro || new Error("Groq: todas as tentativas falharam");
}

/** Traduz o status HTTP da Groq para a mesma linguagem de cooldown que o Gemini já usa. */
function classificarErroDaGroq(status, detalhe) {
  const agora = Date.now();
  if (status === 429) {
    // A Groq informa o tempo de espera no corpo quando é limite por minuto. Usar o número dela
    // é melhor que chutar: chutar para baixo martela, chutar para cima desperdiça a chave.
    const m = /try again in ([\d.]+)s/i.exec(detalhe);
    const diario = /per day|daily/i.test(detalhe);
    return {
      transitorio: true, marcar: true, code: "QUOTA", motivo: diario ? "rpd" : "rpm",
      ateMs: diario ? agora + 6 * 3_600_000 : agora + (m ? Math.ceil(Number(m[1])) * 1000 + 2000 : 60_000),
      mensagem: `QUOTA_EXCEEDED: limite da Groq atingido${diario ? " (cota DIÁRIA)" : ""}.`,
    };
  }
  if (status === 401 || status === 403) {
    // Chave inválida não volta sozinha: tirar de circulação por bastante tempo evita gastar
    // uma tentativa nela em toda chamada.
    return { transitorio: true, marcar: true, code: "AUTH", motivo: "chave inválida", ateMs: agora + 24 * 3_600_000,
             mensagem: "Groq recusou a chave (401/403) — confira GROQ_API_KEYS." };
  }
  if (status === 404) {
    return { transitorio: false, marcar: false, code: "MODEL", motivo: "modelo",
             mensagem: `Groq não conhece o modelo "${GROQ_MODEL}" — ajuste GROQ_MODEL. Resposta: ${detalhe.slice(0, 200)}` };
  }
  if (status >= 500 || status === 408) {
    return { transitorio: true, marcar: true, code: "UNAVAILABLE", motivo: "overload", ateMs: agora + 30_000,
             mensagem: `Groq indisponível (${status}).` };
  }
  return { transitorio: false, marcar: false, code: "ERRO", motivo: "erro",
           mensagem: `Groq respondeu ${status}: ${detalhe.slice(0, 300)}` };
}

/** Para o painel de chaves: quantas existem e qual modelo elas atendem. Nunca as chaves. */
export const GROQ_KEY_COUNT = CHAVES.length;
export const GROQ_MODELS = { chat: GROQ_MODEL };

export const GROQ_MODELO_ATUAL = GROQ_MODEL;
