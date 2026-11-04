// Confere que toda classe `dg-*` que o gerador escreve no HTML existe no tema.
//
// E o defeito que nenhum teste pega e nenhum erro revela: uma classe escrita num
// lugar e chamada de outro jeito no CSS compila, gera, abre — e aparece como um
// bloco sem estilo no meio do portal. O navegador nao tem como avisar: para ele,
// classe sem regra e so classe sem regra.
//
// Nasceu de um erro concreto. Ao renomear as classes para o tema novo, a regra
// `dg-diagram → dg-diagrama` rodou duas vezes e produziu `dg-diagramaa`. O
// gerador continuou funcionando e o portal saiu sem o estilo do diagrama.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.join(import.meta.dirname, "..");

// Meta-nomes: vao para <meta name="..."> e nao sao classe nenhuma.
const META = new Set(["dg-gerador", "dg-app", "dg-app-code", "dg-app-tipo", "dg-origem"]);

// Ids usados pelo script (getElementById), tambem nao sao classes.
const IDS = /id="(dg[A-Za-z]+)"/g;

const fontesCss = ["src/theme.js", "src/highlight.js"]
  .map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");

const geradores = ["render.js", "diagrams.js", "grafo.js", "esquema.js", "index.js", "model.js"]
  .map((f) => path.join(RAIZ, "src", f))
  .filter((p) => fs.existsSync(p));

let falhas = 0;
const usadas = new Map();   // classe inteira -> arquivos
const comecos = new Set();  // pedaco montado na hora: `'dg-selo--' + cor`

for (const arq of geradores) {
  const texto = fs.readFileSync(arq, "utf8");
  const curto = path.basename(arq);
  const ids = new Set([...texto.matchAll(IDS)].map((m) => m[1]));

  for (const achado of texto.matchAll(/dg-[a-z0-9_-]+/g)) {
    const nome = achado[0];
    if (META.has(nome) || ids.has(nome)) continue;
    // Metade das classes e montada na hora: `'dg-selo--' + cor`. O nome inteiro
    // nao existe em lugar nenhum do codigo, so o comeco dele.
    if (nome.endsWith("--") || nome.endsWith("-")) { comecos.add(nome); continue; }
    if (!usadas.has(nome)) usadas.set(nome, new Set());
    usadas.get(nome).add(curto);
  }
}

console.log(`\nClasses do portal — ${usadas.size} usadas pelo gerador\n`);

const orfas = [...usadas.keys()].filter((c) => !fontesCss.includes(c)).sort();
if (orfas.length) {
  falhas += 1;
  console.log(`  FALHOU ${orfas.length} classe(s) sem regra no tema:`);
  orfas.forEach((c) => console.log(`         ${c}  (em ${[...usadas.get(c)].join(", ")})`));
} else {
  console.log("  ok     toda classe escrita tem regra no tema");
}

// Um comeco montado na hora precisa de pelo menos UMA regra que continue dele.
// Sem nenhuma, `dg-selo--` + cor nao vai casar com nada, seja qual for a cor.
const definidas = new Set();
for (const achado of fontesCss.matchAll(/\.(dg-[a-z0-9_-]+)/g)) definidas.add(achado[1]);

const comecosVazios = [...comecos].filter((c) => ![...definidas].some((d) => d.startsWith(c))).sort();
if (comecosVazios.length) {
  falhas += 1;
  console.log(`\n  FALHOU ${comecosVazios.length} nome(s) montado(s) na hora sem nenhuma regra:`);
  comecosVazios.forEach((c) => console.log(`         ${c}…`));
} else {
  console.log("  ok     todo nome montado na hora casa com alguma regra");
}

// ---------------------------------------------------------------- cores dos diagramas

// Uma cor que nao existe na paleta vira fill="undefined" no SVG — e uma forma
// invisivel ou preta, que so aparece olhando o desenho. Nada no terminal avisa.
const { COR } = await import(pathToFileURL(path.join(RAIZ, "src", "diagrams.js")).href);
const chaves = new Set(Object.keys(COR || {}));
// Membros que nao sao cor: `C` tambem e nome de array em alguns pontos.
const NAO_E_COR = new Set(["push", "length", "map", "forEach", "join", "slice", "concat"]);
const coresRuins = new Set();
for (const arq of geradores) {
  const texto = fs.readFileSync(arq, "utf8");
  for (const achado of texto.matchAll(/\b(?:COR|C)\.([A-Za-z0-9_]+)/g)) {
    if (!chaves.has(achado[1]) && !NAO_E_COR.has(achado[1])) {
      coresRuins.add(`${achado[1]} (${path.basename(arq)})`);
    }
  }
}
if (coresRuins.size) {
  falhas += 1;
  console.log(`\n  FALHOU ${coresRuins.size} cor(es) que nao existem na paleta:`);
  [...coresRuins].forEach((c) => console.log(`         ${c}`));
} else {
  console.log("  ok     toda cor usada nos diagramas existe na paleta");
}

// ---------------------------------------------------------------- o que sobra

const semUso = [...definidas]
  .filter((c) => !usadas.has(c) && ![...comecos].some((p) => c.startsWith(p)))
  .sort();
if (semUso.length) {
  console.log(`\n  aviso  ${semUso.length} regra(s) no tema que o gerador nao usa:`);
  console.log(`         ${semUso.join(", ")}`);
  console.log("         nao e defeito — mas costuma ser resto de renomeacao.");
} else {
  console.log("  ok     nenhuma regra sobrando no tema");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
