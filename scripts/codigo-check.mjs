// Guarda o editor que abre quando a Lisa fala de código (src/lib/codigoNaResposta.js): ler os
// blocos da resposta — inclusive pela metade, durante o streaming —, a explicação de cada passo,
// a tela de conversa sem as crases, a ordem da digitação e a voz, que nunca lê código.

import {
  trechosDaResposta, respostaSemCodigo, digitacao, passoDaDigitacao, linguagemDe, CODIGO_NA_TELA, comCodigoNaTela,
  codigoDaConversa, secaoDoCodigoDaConversa, TETO_DO_CODIGO,
} from "../src/lib/codigoNaResposta.js";
import { cleanForSpeech } from "../src/lib/cleanForSpeech.js";
import { caixaInicial, moverCaixa, redimensionarCaixa, caixaGuardada, MINIMO } from "../src/lib/janelaFlutuante.js";

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

console.log("README com blocos dentro (24/10/2026: saía quebrado em dois)");
{
  const readme = (cerca) => [
    "Olha no editor, o README inteiro:",
    `${cerca}markdown README.md`,
    "# LogSphere",
    "## Como rodar",
    "```bash",
    "npm install",
    "node index.js",
    "```",
    "## Como a Lisa vai avaliar",
    "- Uso correto de map, filter e reduce",
    cerca,
    "Qualquer dúvida, me chama.",
  ].join("\n");
  for (const [nome, cerca] of [["três crases (bloco de dentro com linguagem)", "```"], ["quatro crases", "````"]]) {
    const r = trechosDaResposta(readme(cerca));
    conferir(`${nome}: o README vira UM bloco só`, r.trechos.length === 1 && r.trechos[0].rotulo === "README.md" && r.trechos[0].completo, JSON.stringify(r.trechos.map((t) => t.rotulo)));
    conferir(`${nome}: com o bloco de comando dentro e o resto do arquivo`, r.trechos[0].codigo.includes("```bash") && r.trechos[0].codigo.includes("node index.js") && r.trechos[0].codigo.endsWith("map, filter e reduce"));
    conferir(`${nome}: o texto de depois fica fora do código`, r.depois === "Qualquer dúvida, me chama.");
    conferir(`${nome}: a conversa mostra um aviso só`, respostaSemCodigo(readme(cerca)) === "Olha no editor, o README inteiro:\n⟨ código no editor: README.md ⟩\nQualquer dúvida, me chama.");
    const fala = cleanForSpeech(readme(cerca));
    conferir(`${nome}: a voz não lê o README`, !/npm install|LogSphere|Como rodar/.test(fala) && fala.includes("Qualquer dúvida"), fala);
  }
  // um README ainda chegando, parado dentro do bloco de comando: continua um bloco só
  const meio = readme("```").split("node index.js")[0];
  const r = trechosDaResposta(meio);
  conferir("README chegando, no meio do bloco de dentro: um bloco só, incompleto", r.trechos.length === 1 && !r.trechos[0].completo);
  conferir("em código que não é markdown, três crases sozinhas fecham o bloco", trechosDaResposta("```js\nconst a = 1;\n```\n```js\nconst b = 2;\n```").trechos.length === 2);
  conferir("a regra pede um arquivo inteiro num bloco só, com quatro crases se precisar", /ARQUIVO INTEIRO/.test(CODIGO_NA_TELA) && /QUATRO crases/.test(CODIGO_NA_TELA));
}

console.log("o código da conversa (para a Lisa ver o todo)");
{
  const colado = "Meu código:\n```js filtrarLog.js\nfunction filtrarLog(logs, nivel) { return logs.filter((l) => l.level === nivel); }\n```";
  const textos = [colado, resposta, "Valeu!", "```js traduzirLog.js\n// versão nova\nfunction traduzirLog(l) {}\n```"];
  const c = codigoDaConversa(textos);
  conferir("junta o que a pessoa colou e o que a Lisa mostrou", c.includes("### filtrarLog.js") && c.includes("traduzirLog(logFiltrado)"));
  conferir("bloco sem nome de arquivo entra também, identificado", c.includes("### trecho sem nome de arquivo (javascript)"));
  conferir("de cada arquivo, fica só a versão mais recente", c.includes("// versão nova") && !c.includes("NIVEIS[log.level]") && c.split("### traduzirLog.js").length === 2);
  conferir("o mais recente fica por último", c.trim().endsWith("function traduzirLog(l) {}\n```"));
  const grande = Array.from({ length: 10 }, (_, i) => `\`\`\`js arq${i}.js\n${"x".repeat(2000)}\n\`\`\``);
  const cortado = codigoDaConversa(grande);
  conferir("passando do teto, saem os mais antigos", cortado.length <= TETO_DO_CODIGO && cortado.includes("arq9.js") && !cortado.includes("arq0.js"));
  conferir("um arquivo maior que o teto vai cortado, mas vai", codigoDaConversa([`\`\`\`js enorme.js\n${"y".repeat(20000)}\n\`\`\``]).length === TETO_DO_CODIGO);
  conferir("sem código na conversa, nada", codigoDaConversa(["Bom dia", "Oi!"]) === "" && secaoDoCodigoDaConversa("") === "");
  conferir("a seção do prompt avisa para ler o todo", /leia o todo/.test(secaoDoCodigoDaConversa(c)) && secaoDoCodigoDaConversa(c).includes("### filtrarLog.js"));
  conferir("o que vem do navegador é conferido (tipo e tamanho)", secaoDoCodigoDaConversa({ x: 1 }) === "" && secaoDoCodigoDaConversa("z".repeat(50000)).length < TETO_DO_CODIGO + 700);
  conferir("a regra pede para ver o todo e pedir o que falta", /entenda o TODO/.test(CODIGO_NA_TELA) && /PEÇA essa parte/.test(CODIGO_NA_TELA) && /Nunca invente/.test(CODIGO_NA_TELA));
}

console.log("janela do editor: arrastar e redimensionar");
{
  const tela = { w: 1600, h: 1000 };
  const c0 = caixaInicial(tela);
  conferir("nasce no canto direito, do tamanho padrão", c0.w === 640 && c0.h === 480 && c0.x === 1600 - 640 - 24 && c0.y === 84);
  conferir("no celular, quase a largura toda", caixaInicial({ w: 390, h: 844 }).w === 374);
  conferir("arrasta para qualquer lugar da tela", JSON.stringify(moverCaixa(c0, -900, 400, tela)) === JSON.stringify({ ...c0, x: c0.x - 900, y: c0.y + 400 }));
  const fora = moverCaixa(c0, 5000, 5000, tela);
  conferir("pode sair em parte da tela, mas um pedaço e a barra de título ficam à vista", fora.x === 1600 - 80 && fora.y === 1000 - 36);
  conferir("nem por cima nem pela esquerda some de vez", moverCaixa(c0, -5000, -5000, tela).x === 80 - 640 && moverCaixa(c0, 0, -5000, tela).y === 0);
  const se = redimensionarCaixa(c0, "se", 200, 150, tela);
  conferir("o canto de baixo à direita aumenta largura e altura", se.w === 840 && se.h === 630 && se.x === c0.x && se.y === c0.y);
  const w = redimensionarCaixa(c0, "w", -300, 0, tela);
  conferir("puxar a borda esquerda aumenta sem mexer na direita", w.w === 940 && w.x + w.w === c0.x + c0.w);
  const n = redimensionarCaixa(c0, "n", 0, -50, tela);
  conferir("puxar a borda de cima aumenta sem mexer na de baixo", n.h === 530 && n.y + n.h === c0.y + c0.h);
  const pequena = redimensionarCaixa(c0, "nw", 5000, 5000, tela);
  conferir("não fica menor que o mínimo, e a borda oposta continua parada", pequena.w === MINIMO.w && pequena.h === MINIMO.h && pequena.x + pequena.w === c0.x + c0.w && pequena.y + pequena.h === c0.y + c0.h);
  conferir("não fica maior que a tela", redimensionarCaixa(c0, "se", 9000, 9000, tela).w === 1600);
  conferir("a caixa guardada volta, ajustada à tela de agora", JSON.stringify(caixaGuardada({ x: 3000, y: 50, w: 700, h: 400 }, tela)) === JSON.stringify({ x: 1520, y: 50, w: 700, h: 400 }));
  conferir("caixa guardada estragada: volta para o canto", JSON.stringify(caixaGuardada({ x: "a" }, tela)) === JSON.stringify(c0) && JSON.stringify(caixaGuardada(null, tela)) === JSON.stringify(c0));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
