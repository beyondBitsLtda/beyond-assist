// Guarda o editor que abre quando a Lisa fala de código (src/lib/codigoNaResposta.js): ler os
// blocos da resposta — inclusive pela metade, durante o streaming —, a explicação de cada passo,
// a tela de conversa sem as crases, a ordem da digitação e a voz, que nunca lê código.

import { trechosDaResposta, respostaSemCodigo, digitacao, passoDaDigitacao, linguagemDe, CODIGO_NA_TELA, comCodigoNaTela } from "../src/lib/codigoNaResposta.js";
import { cleanForSpeech } from "../src/lib/cleanForSpeech.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

// a resposta do exemplo de 24/10/2026, agora com o código mostrado
const resposta = [
  "Achei: a filtrarLog devolve um array, e a traduzirLog espera um log só.",
  "",
  "Primeiro, a traduzirLog passa a receber o array e traduzir cada log com um map:",
  "```javascript traduzirLog.js",
  "function traduzirLog(logs) {",
  "  // um log traduzido para cada log do array",
  "  return logs.map((log) => ({ ...log, nivel: NIVEIS[log.level] }));",
  "}",
  "```",
  "Depois, no index.js, é só passar o array inteiro:",
  "```js",
  "const traduzidos = traduzirLog(logFiltrado);",
  "```",
  "E adeus TypeError.",
].join("\n");

console.log("trechos da resposta");
{
  const r = trechosDaResposta(resposta);
  conferir("acha os dois blocos", r.trechos.length === 2 && r.temCodigo);
  conferir("o arquivo da linha de abertura vira o nome da aba", r.trechos[0].arquivo === "traduzirLog.js" && r.trechos[0].rotulo === "traduzirLog.js");
  conferir("sem arquivo, a aba leva a linguagem", r.trechos[1].rotulo === "JavaScript 2", r.trechos[1].rotulo);
  conferir("a explicação de cada passo é o texto antes do bloco", r.trechos[0].fala.endsWith("traduzir cada log com um map:") && r.trechos[1].fala === "Depois, no index.js, é só passar o array inteiro:");
  conferir("o código vem sem as crases", r.trechos[0].codigo.startsWith("function traduzirLog") && !r.trechos[0].codigo.includes("```"));
  conferir("o que vem depois do último bloco fica em `depois`", r.depois === "E adeus TypeError.");
  conferir("blocos fechados estão completos", r.trechos.every((t) => t.completo));
  conferir("js e javascript viram a mesma gramática", r.trechos.every((t) => t.linguagem === "javascript"));
}
{
  // no meio do streaming: o segundo bloco ainda não fechou
  const meio = resposta.slice(0, resposta.indexOf("traduzirLog(logFiltrado)") + 5);
  const r = trechosDaResposta(meio);
  conferir("bloco ainda chegando aparece, marcado como incompleto", r.trechos.length === 2 && r.trechos[0].completo && !r.trechos[1].completo);
  conferir("e com o código que já chegou", r.trechos[1].codigo === "const traduzidos = tradu");
  conferir("sem bloco nenhum, nada de editor", !trechosDaResposta("Bom dia! Você tem duas tarefas hoje.").temCodigo);
}

console.log("linguagens");
conferir("apelidos comuns", [linguagemDe("py"), linguagemDe("TS"), linguagemDe("html"), linguagemDe("sql")].join() === "python,typescript,markup,sql");
conferir("sem linguagem, vale a extensão do arquivo", linguagemDe("", "src/app.tsx") === "tsx");
conferir("linguagem desconhecida fica sem cor (null)", linguagemDe("cobol") === null);
conferir("java e C# usam a gramática genérica", linguagemDe("java") === "clike" && linguagemDe("c#") === "clike");

console.log("tela de conversa e voz");
{
  const tela = respostaSemCodigo(resposta);
  conferir("a conversa não mostra crases", !tela.includes("```"));
  conferir("cada bloco vira um aviso com o nome da aba", tela.includes("⟨ código no editor: traduzirLog.js ⟩") && tela.includes("⟨ código no editor: JavaScript 2 ⟩"));
  conferir("o texto em volta continua", tela.startsWith("Achei:") && tela.endsWith("E adeus TypeError."));
  conferir("bloco ainda chegando também vira aviso", !respostaSemCodigo(resposta.slice(0, 200)).includes("```"));
  conferir("sem código, o texto passa igual", respostaSemCodigo("Oi, tudo bem?") === "Oi, tudo bem?");
  const fala = cleanForSpeech(resposta);
  conferir("a voz não lê o código", !fala.includes("logs.map") && !fala.includes("```") && fala.includes("adeus TypeError"));
}

console.log("digitação");
{
  const { trechos } = trechosDaResposta(resposta);
  const n0 = trechos[0].codigo.length;
  const d1 = digitacao(trechos, 10);
  conferir("começa pelo primeiro trecho", d1.atual === 0 && d1.visiveis[0].length === 10 && d1.visiveis[1] === "");
  const d2 = digitacao(trechos, n0 + 3);
  conferir("terminado o primeiro, passa para o segundo", d2.atual === 1 && d2.visiveis[0] === trechos[0].codigo && d2.visiveis[1].length === 3);
  const d3 = digitacao(trechos, 1e9);
  conferir("no fim, tudo aparece e a digitação terminou", d3.terminou && d3.visiveis.join("") === trechos.map((t) => t.codigo).join(""));
  conferir("o passo acelera quando falta muito", passoDaDigitacao(10) === 2 && passoDaDigitacao(3000) === 20 && passoDaDigitacao(0) === 0);
}

console.log("instrução da Lisa");
conferir("pede o código em blocos quando o assunto é código", /três crases/i.test(CODIGO_NA_TELA) && /arquivo/i.test(CODIGO_NA_TELA));
conferir("e lembra que o código não é lido em voz alta", /voz alta/i.test(CODIGO_NA_TELA));
conferir("entra por cima da instrução base, sem apagar nada", comCodigoNaTela("BASE").startsWith("BASE") && comCodigoNaTela("BASE").includes(CODIGO_NA_TELA));

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
