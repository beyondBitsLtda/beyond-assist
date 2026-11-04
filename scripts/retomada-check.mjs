// A retomada de uma resposta cortada no meio (src/lib/retomada.js). Sem rede: streams de mentira.
import { streamComRetomada, contentsParaContinuar, PEDIDO_DE_CONTINUAR } from "../src/lib/retomada.js";

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};

// um stream que entrega `pedacos` e, se `quebra`, estoura como o SDK estoura
async function* falso(pedacos, quebra = false) {
  for (const p of pedacos) yield { text: p };
  if (quebra) throw new Error("Incomplete JSON segment at the end");
}
async function juntar(gerador) {
  let s = "";
  for await (const t of gerador) s += t;
  return s;
}

console.log("\nResposta cortada no meio\n");

{
  const pedidos = [];
  const abrir = async (c) => { pedidos.push(c); return pedidos.length === 1 ? falso(["Queda de ", "energia pode "], true) : falso(["corromper o banco."]); };
  const texto = await juntar(streamComRetomada(abrir, "por que queda de luz estraga banco?"));
  conferir("o texto sai inteiro, sem repetir o começo", texto === "Queda de energia pode corromper o banco.", JSON.stringify(texto));
  const segundo = pedidos[1];
  conferir("a retomada leva o que ela já disse, como fala do modelo", segundo?.[1]?.role === "model" && segundo[1].parts[0].text === "Queda de energia pode ");
  conferir("e pede para continuar dali", segundo?.[2]?.parts?.[0]?.text === PEDIDO_DE_CONTINUAR);
}

{
  let n = 0;
  const abrir = async (c) => { n++; return n === 1 ? falso([], true) : falso(["Oi."]); };
  const texto = await juntar(streamComRetomada(abrir, "oi"));
  conferir("quebrou antes de qualquer texto: repete o pedido original", texto === "Oi." && n === 2);
}

{
  const abrir = async () => falso(["meia "], true);
  let erro = null, texto = "";
  try { for await (const t of streamComRetomada(abrir, "x")) texto += t; } catch (e) { erro = e; }
  conferir("quebrou de novo: vira erro com frase que se entende", /cortou a resposta no meio/.test(erro?.message || ""), erro?.message);
  conferir("o erro original fica guardado em cause", /Incomplete JSON/.test(erro?.cause?.message || ""));
  conferir("o que já tinha chegado foi entregue", texto === "meia meia ");
}

{
  let n = 0;
  const abrir = async () => { n++; return falso(["tudo ", "certo"]); };
  conferir("stream normal: uma chamada só", (await juntar(streamComRetomada(abrir, "x"))) === "tudo certo" && n === 1);
}

console.log("\nPedido de continuação\n");
const comImagem = [{ role: "user", parts: [{ text: "o que tem na tela?" }, { inlineData: { mimeType: "image/png", data: "AAA" } }] }];
const c = contentsParaContinuar(comImagem, "Na tela tem");
conferir("pergunta com imagem continua com a imagem", c[0].parts.length === 2 && c.length === 3);
conferir("pergunta em texto vira conversa de três falas", contentsParaContinuar("oi", "olá").map((x) => x.role).join(",") === "user,model,user");

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
