// Exercita o detector do que está exportado sem explicação.
//
// O erro que importa aqui não é deixar passar um caso exótico — é marcar como indocumentado o
// que JÁ está bem explicado. Este repositório comenta muito e comenta de dois jeitos (bloco
// para o porquê longo, barra dupla para a nota curta), e um detector que só reconhecesse um
// dos formatos mandaria a Lisa reescrever comentário bom, todo dia, até alguém desligar a
// funcionalidade.

import fs from "node:fs";
import { exportacoesSemDoc, resumoDaDocumentacao } from "../src/lib/documentacao.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

console.log("\n1) acha o que está sem explicação");
{
  const codigo = [
    "export function semNada(a) { return a; }",
    "",
    "export const TAMBEM_SEM = 42;",
    "",
    "export class Solta {}",
  ].join("\n");
  const achados = exportacoesSemDoc(codigo);
  conferir("acha os três", achados.length === 3, JSON.stringify(achados.map((a) => a.nome)));
  conferir("com o tipo certo", achados.map((a) => a.tipo).join(",") === "função,constante,classe",
           achados.map((a) => a.tipo).join(","));
  conferir("com a linha contada a partir de 1", achados[0].linha === 1, `veio ${achados[0].linha}`);
  conferir("a terceira está na linha 5", achados[2].linha === 5, `veio ${achados[2].linha}`);
}

console.log("\n2) e NÃO reclama do que já está explicado");
{
  // Os dois formatos que este projeto usa de verdade.
  const comBloco = ["/** Faz alguma coisa. */", "export function explicada() {}"].join("\n");
  conferir("bloco /** */ conta como documentado", exportacoesSemDoc(comBloco).length === 0);

  const comBarra = ["// Faz alguma coisa.", "export const EXPLICADA = 1;"].join("\n");
  conferir("comentário // conta como documentado", exportacoesSemDoc(comBarra).length === 0);

  const blocoLongo = [
    "/**",
    " * Explicação longa,",
    " * de várias linhas.",
    " */",
    "export function tambemExplicada() {}",
  ].join("\n");
  conferir("bloco de várias linhas conta", exportacoesSemDoc(blocoLongo).length === 0);

  const comBranco = ["/** Explicada. */", "", "export function comLinhaEmBranco() {}"].join("\n");
  conferir("linha em branco entre comentário e código não invalida", exportacoesSemDoc(comBranco).length === 0);
}

console.log("\n3) o caso que estragaria a confiança");
{
  // Código ANTES da declaração, sem comentário: não pode contar como documentado só porque
  // existe um comentário mais acima, explicando OUTRA coisa.
  const enganoso = [
    "/** Isto explica a função de cima. */",
    "export function primeira() {}",
    "export function segunda() {}",
  ].join("\n");
  const achados = exportacoesSemDoc(enganoso);
  conferir("o comentário de uma não cobre a seguinte",
           achados.length === 1 && achados[0].nome === "segunda", JSON.stringify(achados.map((a) => a.nome)));
}

console.log("\n4) casos de borda");
{
  conferir("arquivo vazio não acusa nada", exportacoesSemDoc("").length === 0);
  conferir("nulo não quebra", exportacoesSemDoc(null).length === 0);
  conferir("arquivo sem export nenhum não acusa", exportacoesSemDoc("function interna() {}").length === 0);
  conferir("export default function é reconhecido",
           exportacoesSemDoc("export default function Painel() {}").length === 1);
  conferir("uma declaração por linha, sem contar duas vezes",
           exportacoesSemDoc("export default function Painel() {}").length === 1);
  conferir("async function é reconhecida", exportacoesSemDoc("export async function busca() {}").length === 1);
}

console.log("\n5) o resumo em números");
{
  const codigo = [
    "/** Explicada. */",
    "export function a() {}",
    "export function b() {}",
    "export const C = 1;",
  ].join("\n");
  const r = resumoDaDocumentacao(codigo);
  conferir("conta o total de exportações", r.total === 3, `veio ${r.total}`);
  conferir("conta quantas faltam", r.semDoc === 2, `veio ${r.semDoc}`);
  conferir("e quantas já estão", r.documentados === 1, `veio ${r.documentados}`);
}

console.log("\n6) contra os arquivos DE VERDADE deste projeto");
{
  // Este repositório é comentado com cuidado. Se o detector acusar muita coisa aqui, ele está
  // errado — e é exatamente esse erro que faria a funcionalidade virar ruído.
  const arquivos = [
    "src/lib/relevanciaDoArquivo.js",
    "src/lib/escutaPorPalavra.js",
    "src/lib/cleanForSpeech.js",
    "src/lib/documentacao.js",
  ];
  for (const arq of arquivos) {
    const codigo = fs.readFileSync(new URL(`../${arq}`, import.meta.url), "utf8");
    const r = resumoDaDocumentacao(codigo);
    conferir(`${arq}: ${r.documentados}/${r.total} explicadas`, r.semDoc === 0,
             `acusou ${JSON.stringify(r.itens.map((i) => `${i.nome}:${i.linha}`))}`);
  }
}

console.log("\n7) as duas copias concordam");
{
  // A logica existe em dois lugares: o servidor DECLARA a ferramenta e a extensao a
  // EXECUTA, porque o arquivo e do usuario e nao precisa sair da maquina dele. Duas
  // copias divergem em silencio, entao aqui as duas rodam a mesma bateria.
  // Importa o arquivo COMPILADO, e nao o TypeScript.
  //
  // Tentei primeiro tirar os tipos na mao, com expressao regular, e levei tres tentativas
  // para perceber o obvio: o tsc ja faz isso, e o que ele produz e exatamente o que vai
  // dentro do .vsix. Testar a conversao caseira testaria uma coisa que nunca roda.
  //
  // Se out/ nao existir, o teste AVISA em vez de passar calado — um teste que se pula
  // sozinho em silencio e pior que nenhum.
  const { createRequire } = await import("node:module");
  const { fileURLToPath } = await import("node:url");
  const exigir = createRequire(import.meta.url);
  const caminhoCompilado = new URL("../vscode-extension/lisa-code/out/documentacao.js", import.meta.url);
  let copia = null;
  try {
    copia = exigir(fileURLToPath(caminhoCompilado));
  } catch (err) {
    falha("a copia da extensao nao esta compilada", "rode npm run compile em vscode-extension/lisa-code");
  }

  const casos = [
    "export function semNada() {}",
    "/** doc */\nexport function comDoc() {}",
    "// doc\nexport const X = 1;",
    "/**\n * longo\n */\nexport class C {}",
    "export default function P() {}",
    "",
    fs.readFileSync(new URL("../src/lib/relevanciaDoArquivo.js", import.meta.url), "utf8"),
  ];
  let divergiu = 0;
  for (const caso of copia ? casos : []) {
    const a = JSON.stringify(exportacoesSemDoc(caso));
    const b = JSON.stringify(copia.exportacoesSemDoc(caso));
    if (a !== b) { divergiu++; console.log(`        servidor ${a}\n        extensao ${b}`); }
  }
  if (copia) conferir(`as duas copias dao o mesmo resultado nos ${casos.length} casos`, divergiu === 0, `${divergiu} divergencia(s)`);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
