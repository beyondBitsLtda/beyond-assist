// Conferência da IDE livre (05/11/2026): o terminal rodando linhas inteiras (src/dominio/shell.js, com um "rodar"
// de mentira) e o JavaScript do navegador rodando de verdade (o código do Worker de src/componentes/ide/executores.js
// num contexto do vm do Node, com as peças que o navegador daria). O Python (Pyodide) e o SQLite (sql.js) baixam da
// CDN e são conferidos na tela, no navegador.
// Uso: npm run ide-check
import assert from "node:assert/strict";
import vm from "node:vm";
import { executarLinha, ESTADO_INICIAL } from "../src/dominio/shell.js";
import { projetoDoModelo, escrever, IDE } from "../src/dominio/ide.js";
import { CODIGO_DOS_TRABALHADORES } from "../src/componentes/ide/executores.js";

let passou = 0;
const caso = async (nome, fn) => {
  try { await fn(); passou++; console.log(`  ok    ${nome}`); } catch (e) { console.error(`  FALHOU ${nome}\n        ${e.message}`); process.exitCode = 1; }
};

// ---------------------------------------------------------------- o terminal
function terminal(modelo = "javascript") {
  let estado = ESTADO_INICIAL(projetoDoModelo(modelo));
  const pedidos = [];
  const ctx = {
    rodar: async (p) => {
      pedidos.push(p);
      if (p.tipo === "compilar") return /erro/.test(p.projeto.arquivos[p.fontes[0]]) ? { saida: "", erro: "main.c:1: error: esperado ';'\n", status: 1 } : { saida: "", erro: "", status: 0 };
      return { saida: `[${p.executor || p.tipo} ${p.arquivo || ""} entrada=${JSON.stringify(p.entrada)}]\n`, erro: "", status: 0 };
    },
  };
  const rodar = async (linha, extra = {}) => { const r = await executarLinha(linha, estado, { ...ctx, ...extra }); estado = r.estado; return r; };
  return { rodar, pedidos, get estado() { return estado; } };
}

await caso("terminal: encadeia, redireciona, lê de arquivo e de pipe", async () => {
  const t = terminal();
  let r = await t.rodar("mkdir -p dados && echo 3 > dados/n.txt && echo 4 >> dados/n.txt && cat dados/n.txt | wc -l");
  assert.equal(r.saida.trim(), "2");
  r = await t.rodar("node index.js < dados/n.txt");
  assert.match(r.saida, /\[js \/index\.js entrada="3\\n4\\n"\]/, "o < vira a entrada do programa");
  r = await t.rodar("echo Bia | node index.js");
  assert.match(r.saida, /entrada="Bia\\n"/, "o | também");
  r = await t.rodar("node index.js > saida.txt; cat saida.txt");
  assert.match(r.saida, /\[js \/index\.js/, "a saída do programa foi para o arquivo e o cat mostrou");
  r = await t.rodar("false && echo nunca || echo então");
  assert.equal(r.saida, "então\n");
  r = await t.rodar("ls naoexiste 2> erros.txt; cat erros.txt");
  assert.match(r.saida, /naoexiste/, "2> grava o erro");
});

await caso("terminal: gcc compila, o executável roda e o erro de compilação para o &&", async () => {
  const t = terminal("c");
  let r = await t.rodar("gcc main.c -o app && ./app");
  assert.equal(r.status, 0);
  assert.ok(t.estado.projeto.arquivos["/app"].startsWith(IDE.marcaDeBinario), "o executável fica no projeto");
  assert.equal(t.pedidos.at(-1).tipo, "programa");
  assert.deepEqual(t.pedidos.at(-1).fontes, ["/main.c"]);
  r = await t.rodar("./app", { entradaPadrao: "5\n" });
  assert.match(r.saida, /entrada="5\\n"/, "a entrada que o terminal pediu antes de rodar");
  await t.rodar("echo 'int main() { erro }' > ruim.c");
  r = await t.rodar("gcc ruim.c -o ruim && ./ruim");
  assert.equal(r.status, 1);
  assert.match(r.erro, /error/);
  assert.ok(!t.estado.projeto.arquivos["/ruim"], "sem compilar, sem executável");
});

await caso("terminal: npm install, npm run e o package.json", async () => {
  const t = terminal();
  await t.rodar("npm init");
  let r = await t.rodar("npm install dayjs@1.11.10 lodash");
  assert.match(r.saida, /\+ dayjs@1\.11\.10, lodash/);
  const pacote = JSON.parse(t.estado.projeto.arquivos["/package.json"]);
  assert.deepEqual(pacote.dependencies, { dayjs: "1.11.10", lodash: "latest" });
  r = await t.rodar("npm start");
  assert.match(r.saida, /\[js \/index\.js/, "o script start roda o node index.js");
  r = await t.rodar("npm install ../../etc");
  assert.equal(r.status, 1, "nome de pacote inválido");
});

await caso("terminal: cd, pwd, export, history e comando desconhecido", async () => {
  const t = terminal();
  await t.rodar("mkdir -p a/b && cd a/b");
  assert.equal((await t.rodar("pwd")).saida, "~/a/b\n");
  assert.equal((await t.rodar("cd ../.. && pwd")).saida, "~\n");
  await t.rodar("export NOME=Ana");
  assert.equal((await t.rodar("echo \"oi $NOME\"")).saida, "oi Ana\n");
  const r = await t.rodar("bananas");
  assert.equal(r.status, 127);
  assert.match(r.erro, /comando não encontrado/);
  assert.deepEqual((await t.rodar("node")).efeitos, [{ tipo: "repl", linguagem: "javascript" }]);
  assert.deepEqual((await t.rodar("preview")).efeitos, [], "sem página no projeto, sem prévia");
});

// ---------------------------------------------------------------- o JavaScript do navegador, rodando de verdade
function worker() {
  const msgs = [];
  let aoFim;
  const ctx = {
    postMessage: (m) => { msgs.push(m); if (["fim", "repl-ok", "repl-mais"].includes(m.tipo)) aoFim?.(m); },
    location: { origin: "https://proof.beyond.dev.br" }, fetch: async (u) => ({ ok: true, url: String(u) }),
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, performance, crypto: globalThis.crypto, URL, TextEncoder, TextDecoder,
    WebSocket: function () {}, addEventListener: () => {}, console: { log() {}, warn() {}, error() {} },
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(CODIGO_DOS_TRABALHADORES.node, ctx);
  return (data) => new Promise((ok) => {
    msgs.length = 0;
    aoFim = (m) => ok({ fim: m, saida: msgs.filter((x) => x.tipo === "saida").map((x) => x.texto).join(""), erro: msgs.filter((x) => x.tipo === "erro").map((x) => x.texto).join("") });
    ctx.onmessage({ data });
  });
}
const rodarJs = (arquivos, extra = {}) => worker()({ tipo: "rodar", cwd: "/", args: [], entrada: "", arquivo: Object.keys(arquivos)[0], arquivos, ...extra });

await caso("node: require, import/export, JSON, fs que volta para o projeto", async () => {
  let r = await rodarJs({ "/index.js": "const { saudar } = require('./util');\nconsole.log(saudar('Ana'))", "/util.js": "module.exports = { saudar: (n) => `Olá, ${n}!` };" });
  assert.equal(r.saida, "Olá, Ana!\n");
  r = await rodarJs({ "/m.mjs": "import soma, { dobro as d } from './mat.js';\nconsole.log(soma(2, 3), d(4))", "/mat.js": "export default function soma(a, b) { return a + b; }\nexport const dobro = (x) => x * 2;" });
  assert.equal(r.saida, "5 8\n");
  r = await rodarJs({ "/a.js": "const fs = require('fs'); const n = require('./d.json').n; fs.writeFileSync('s.txt', 'n=' + n); console.log(fs.readFileSync('s.txt', 'utf8'))", "/d.json": "{\"n\": 7}" });
  assert.equal(r.saida, "n=7\n");
  assert.deepEqual(JSON.parse(JSON.stringify(r.fim.mudou)), [["/s.txt", "n=7"]], "o arquivo gravado volta para o projeto");
});

await caso("node: a entrada (readline, prompt), process.exit, timers e erros com a linha certa", async () => {
  let r = await rodarJs({ "/r.js": "const rl = require('readline').createInterface({ input: process.stdin });\nlet s = 0; rl.on('line', (l) => s += Number(l)); rl.on('close', () => console.log('soma', s));" }, { entrada: "3\n4\n" });
  assert.equal(r.saida, "soma 7\n");
  r = await rodarJs({ "/p.js": "const n = prompt('Nome?'); console.log('oi ' + n);" }, { entrada: "Bia\n" });
  assert.equal(r.saida, "Nome?Bia\noi Bia\n", "o prompt mostra o que foi digitado, como num terminal");
  r = await rodarJs({ "/x.js": "console.log('a'); process.exit(3); console.log('b');" });
  assert.deepEqual([r.saida, r.fim.status], ["a\n", 3]);
  r = await rodarJs({ "/t.js": "setTimeout(() => console.log('depois'), 30); console.log('agora');" });
  assert.equal(r.saida, "agora\ndepois\n", "espera o timer, como o Node");
  r = await rodarJs({ "/e.js": "\n\nfunction f() { return x.y; }\nf();" });
  assert.equal(r.fim.status, 1);
  assert.match(r.erro, /ReferenceError: x is not defined/);
  assert.match(r.erro, /\/e\.js:3:/, "a linha do erro bate com o arquivo");
});

await caso("node: o programa não chama o próprio Proof; a internet sim", async () => {
  const r = await rodarJs({ "/f.js": "fetch('/api/hoje').then(() => console.log('passou'), (e) => console.log('barrou'));\nfetch('https://api.github.com').then((x) => console.log('internet', x.ok));" });
  assert.equal(r.saida, "barrou\ninternet true\n");
});

await caso("node: a saída como a do Node (util.inspect, %s, console.table)", async () => {
  let r = await rodarJs({ "/c.js": "console.log([1, 2, 3], { nome: 'Ana', idade: 30 });\nconsole.log('%s tem %d anos', 'Bia', 7);" });
  assert.equal(r.saida, "[ 1, 2, 3 ] { nome: 'Ana', idade: 30 }\nBia tem 7 anos\n");
  r = await rodarJs({ "/t.js": "console.table([{ a: 1 }])" });
  assert.match(r.saida, /┌.*┐\n│ \(índice\) │ a │/);
});

await caso("node: o modo interativo guarda as variáveis, junta o bloco e aceita await", async () => {
  const w = worker();
  const linha = (l, preparar = false) => w({ tipo: "repl", linha: l, preparar, arquivos: {}, cwd: "/" });
  assert.equal((await linha("let x = 2", true)).saida, "");
  assert.equal((await linha("x * 3")).saida, "6\n");
  assert.equal((await linha("function f() {")).fim.tipo, "repl-mais", "o bloco que não fechou pede mais");
  assert.equal((await linha("function f() {\n  return 5;\n}\nf()")).saida, "5\n");
  assert.equal((await linha("await Promise.resolve(42)")).saida, "42\n");
  assert.equal((await linha("'texto'")).saida, "'texto'\n");
  assert.match((await linha("y.z")).erro, /ReferenceError/);
});

await caso("os Workers do Python e do SQLite são JavaScript válido", async () => {
  for (const k of ["python", "sqlite"]) new Function(CODIGO_DOS_TRABALHADORES[k]);
  assert.match(CODIGO_DOS_TRABALHADORES.python, /loadPackagesFromImports/, "numpy, pandas... vêm sozinhos pelo import");
  assert.match(CODIGO_DOS_TRABALHADORES.python, /micropip/, "pip install");
  assert.match(CODIGO_DOS_TRABALHADORES.sqlite, /\.tables/);
});

console.log(`\n${passou} caso(s) da IDE passaram${process.exitCode ? ", com falhas acima" : ""}.`);
process.exit(process.exitCode || 0);
