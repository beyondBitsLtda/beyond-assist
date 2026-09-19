// Exercita a tradução entre o formato do Gemini e o da Groq, sem rede.
//
// A tradução de TEXTO é quase trivial e quase nunca quebra. O que quebra é o tool calling, e
// quebra em silêncio: se os argumentos não virarem string de JSON, a ferramenta recebe um
// objeto vazio e a Lisa parece ter ficado confusa sozinha — sem erro, sem log, sem pista. Se
// os ids não sobreviverem à ida e à volta, a resposta da ferramenta não casa com a chamada e o
// modelo responde como se nunca tivesse pedido nada.
//
// Por isso quase todo este arquivo é sobre ferramentas, e não sobre texto.

import { paraMensagensOpenAI, paraFerramentasOpenAI, paraContentDoGemini } from "../src/lib/groq.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

console.log("\n1) texto de ida e volta");
{
  const m = paraMensagensOpenAI(
    [{ role: "user", parts: [{ text: "oi" }] }, { role: "model", parts: [{ text: "olá" }] }],
    "você é a Lisa"
  );
  conferir("a instrução de sistema vira a primeira mensagem", m[0].role === "system" && m[0].content === "você é a Lisa");
  conferir("user continua user", m[1].role === "user" && m[1].content === "oi");
  conferir("model vira assistant", m[2].role === "assistant" && m[2].content === "olá");
  conferir("sem instrução, não inventa mensagem de sistema", paraMensagensOpenAI([{ role: "user", parts: [{ text: "x" }] }])[0].role === "user");
}

console.log("\n2) chamada de ferramenta: o formato que mais diverge");
{
  const contents = [
    { role: "user", parts: [{ text: "rode os testes" }] },
    { role: "model", parts: [
      { text: "vou rodar" },
      { functionCall: { id: "c1", name: "run_command", args: { command: "npm test", explanation: "ver se passa" } } },
    ] },
  ];
  const m = paraMensagensOpenAI(contents, null);
  const assistente = m[m.length - 1];
  conferir("a chamada vira tool_calls no assistant", Array.isArray(assistente.tool_calls) && assistente.tool_calls.length === 1);
  const tc = assistente.tool_calls[0];
  conferir("o id sobrevive", tc.id === "c1", `veio ${tc.id}`);
  conferir("o nome sobrevive", tc.function.name === "run_command");
  // Este é o item que falha calado quando esquecido.
  conferir("os argumentos viram STRING de JSON", typeof tc.function.arguments === "string", `veio ${typeof tc.function.arguments}`);
  conferir("e a string tem o conteúdo certo", JSON.parse(tc.function.arguments).command === "npm test");
  conferir("o texto que acompanhou a chamada não se perde", assistente.content === "vou rodar");
}

console.log("\n3) resposta de ferramenta vira mensagem própria");
{
  // No Gemini as respostas vêm empacotadas num turno de role "user"; no padrão da OpenAI cada
  // uma é uma mensagem role "tool", casada pelo id.
  const contents = [
    { role: "user", parts: [
      { functionResponse: { id: "c1", name: "run_command", response: { ran: true, output: "3 passed" } } },
      { functionResponse: { id: "c2", name: "read_file", response: { content: "abc" } } },
    ] },
  ];
  const m = paraMensagensOpenAI(contents, null);
  conferir("duas respostas viram duas mensagens", m.length === 2, `viraram ${m.length}`);
  conferir("com role tool", m.every((x) => x.role === "tool"));
  conferir("casadas pelo id da chamada", m[0].tool_call_id === "c1" && m[1].tool_call_id === "c2");
  conferir("o conteúdo vai como JSON", JSON.parse(m[0].content).output === "3 passed");
  conferir("nenhuma delas virou mensagem de usuário", !m.some((x) => x.role === "user"));
}

console.log("\n4) declarações de ferramenta");
{
  const ferramentas = [{ functionDeclarations: [
    { name: "read_file", description: "lê", parametersJsonSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
    { name: "run_command", description: "roda", parametersJsonSchema: { type: "object", properties: { command: { type: "string" } } } },
  ] }];
  const t = paraFerramentasOpenAI(ferramentas);
  conferir("todas as declarações atravessam", t.length === 2);
  conferir("no formato type/function", t[0].type === "function" && t[0].function.name === "read_file");
  // parametersJsonSchema (Gemini) → parameters (OpenAI). Errar isso manda as ferramentas sem
  // esquema nenhum, e o modelo passa a chamá-las com argumentos inventados.
  conferir("parametersJsonSchema vira parameters", t[0].function.parameters?.properties?.path?.type === "string");
  conferir("a descrição vai junto", t[1].function.description === "roda");
  conferir("lista vazia não quebra", paraFerramentasOpenAI([]).length === 0);
  conferir("indefinido não quebra", paraFerramentasOpenAI(undefined).length === 0);
}

console.log("\n5) a volta: resposta da Groq vira Content do Gemini");
{
  const c = paraContentDoGemini({
    content: "rodando os testes",
    tool_calls: [{ id: "call_abc", type: "function", function: { name: "run_command", arguments: '{"command":"npm test"}' } }],
  });
  conferir("role model", c.role === "model");
  conferir("o texto vira uma part de texto", c.parts[0].text === "rodando os testes");
  const fc = c.parts.find((p) => p.functionCall)?.functionCall;
  conferir("a chamada vira functionCall", fc?.name === "run_command");
  // Se o id não voltar, o turno seguinte manda a resposta com id errado e o modelo não a
  // reconhece como resposta da chamada que ele fez.
  conferir("o id volta para casar com a resposta depois", fc?.id === "call_abc", `veio ${fc?.id}`);
  conferir("os argumentos voltam a ser OBJETO", typeof fc?.args === "object" && fc.args.command === "npm test");
}

console.log("\n6) o que acontece quando o modelo entrega lixo");
{
  // Modelo menor às vezes devolve JSON quebrado nos argumentos. Derrubar o turno inteiro por
  // isso seria pior que entregar a ferramenta com argumentos vazios: ela responde "faltou o
  // quê" e a conversa segue.
  const c = paraContentDoGemini({ content: null, tool_calls: [{ id: "x", function: { name: "read_file", arguments: "{isso não é json" } }] });
  conferir("JSON quebrado não derruba o turno", c.parts.some((p) => p.functionCall?.name === "read_file"));
  conferir("e vira argumentos vazios", Object.keys(c.parts.find((p) => p.functionCall).functionCall.args).length === 0);
  conferir("resposta completamente vazia ainda devolve um Content válido",
           paraContentDoGemini({}).parts.length === 1 && paraContentDoGemini({}).role === "model");
  conferir("nulo não quebra", paraContentDoGemini(null).role === "model");
}

console.log("\n7) uma conversa inteira, ida e volta");
{
  // O ciclo real: usuário pede → modelo chama ferramenta → cliente responde → modelo conclui.
  // Se os ids não fecharem em todo o percurso, o modelo se perde no último passo.
  const idaEVolta = paraContentDoGemini({
    content: null,
    tool_calls: [{ id: "abc123", function: { name: "run_command", arguments: '{"command":"ls"}' } }],
  });
  const historico = [
    { role: "user", parts: [{ text: "liste os arquivos" }] },
    idaEVolta,
    { role: "user", parts: [{ functionResponse: { id: "abc123", name: "run_command", response: { output: "src" } } }] },
  ];
  const m = paraMensagensOpenAI(historico, "sistema");
  const chamada = m.find((x) => x.tool_calls)?.tool_calls[0];
  const resposta = m.find((x) => x.role === "tool");
  conferir("o id da chamada e o da resposta são o mesmo no fim do percurso",
           chamada?.id === resposta?.tool_call_id && chamada?.id === "abc123",
           `chamada ${chamada?.id} · resposta ${resposta?.tool_call_id}`);
  conferir("a ordem das mensagens se mantém", m.map((x) => x.role).join(",") === "system,user,assistant,tool");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
