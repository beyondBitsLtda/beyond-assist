// Exercita a leitura de uma pasta arrastada, com um navegador de mentira.
//
// Este script existe por causa de um defeito que custou caro e não deu erro nenhum:
//
//     const itens = [...dataTransfer.items];
//
// `DataTransferItemList` tem `length` e índices, mas NÃO é iterável. Espalhar com `...` lança
// um TypeError — e como o manipulador do `drop` é `async`, a exceção virava uma promessa
// rejeitada que ninguém escutava. Arrastar uma pasta simplesmente não fazia nada: sem erro na
// tela, sem pista no console, sem nada.
//
// Por isso o dublê abaixo é rigoroso: ele imita a lista do navegador INCLUSIVE na parte
// desagradável — não é iterável, e `readEntries` devolve no máximo 100 por vez. Um dublê
// gentil demais deixaria os dois defeitos passarem de novo.

import { lerArrastados, lerDoSeletor, caminhosDistintos } from "../src/lib/pastasArrastadas.js";

let falhas = 0;
const ok = (t, d = "") => console.log(`  ok    ${t}${d ? `  — ${d}` : ""}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

/** Um arquivo, como o navegador entrega. */
function arquivo(nome) {
  return { name: nome, size: 10, type: "text/plain" };
}

/** Uma entrada de arquivo do sistema de arquivos do navegador. */
function entradaDeArquivo(nome) {
  return { isFile: true, isDirectory: false, name: nome, file: (ok) => ok(arquivo(nome)) };
}

/**
 * Uma pasta. O leitor devolve no máximo `porVez` entradas por chamada e uma lista vazia no
 * fim — que é o contrato de verdade do `readEntries`, e a armadilha número dois.
 */
function entradaDePasta(nome, filhas, porVez = 100) {
  return {
    isFile: false,
    isDirectory: true,
    name: nome,
    createReader() {
      let i = 0;
      return {
        readEntries(ok) {
          const fatia = filhas.slice(i, i + porVez);
          i += fatia.length;
          ok(fatia);
        },
      };
    },
  };
}

/**
 * Um DataTransfer como o do navegador: `items` com `length` e índices, e SEM `Symbol.iterator`.
 * É este detalhe que o código precisa aguentar.
 */
function arrastoDe(entradas, comFiles = []) {
  const items = { length: entradas.length };
  entradas.forEach((e, i) => { items[i] = { kind: "file", webkitGetAsEntry: () => e }; });
  // Sem iterador, de propósito. `[...items]` lança aqui, igualzinho ao navegador.
  return { items, files: comFiles };
}

console.log("\n1) a lista de itens NÃO é iterável — e tem de funcionar assim mesmo");
{
  const arrasto = arrastoDe([entradaDeArquivo("a.txt")]);
  let espalharLanca = false;
  try { [...arrasto.items]; } catch { espalharLanca = true; }
  conferir("o dublê imita mesmo o navegador (espalhar lança)", espalharLanca,
    "se isto falhar, o teste não está testando nada");

  const r = await lerArrastados(arrasto);
  conferir("mesmo assim, o arquivo foi lido", r.itens.length === 1, `leu ${r.itens.length}`);
  conferir("com o nome certo", r.itens[0].file.name === "a.txt");
  conferir("arquivo solto não ganha pasta", r.itens[0].caminho.length === 0);
}

console.log("\n2) uma pasta com subpastas");
{
  const arvore = entradaDePasta("Obra Delp", [
    entradaDeArquivo("capa.pdf"),
    entradaDePasta("Contratos", [
      entradaDeArquivo("contrato.pdf"),
      entradaDePasta("2026", [entradaDeArquivo("aditivo.pdf")]),
    ]),
    entradaDePasta("Fotos", [entradaDeArquivo("foto1.jpg"), entradaDeArquivo("foto2.jpg")]),
  ]);

  const r = await lerArrastados(arrastoDe([arvore]));
  conferir("achou os cinco arquivos", r.itens.length === 5, `${r.itens.length}`);
  conferir("reconheceu que veio estrutura", r.estrutura === true);

  const onde = new Map(r.itens.map((i) => [i.file.name, i.caminho.join("/")]));
  conferir("o arquivo da raiz fica na pasta de cima", onde.get("capa.pdf") === "Obra Delp", onde.get("capa.pdf"));
  conferir("o do meio fica dois níveis abaixo", onde.get("contrato.pdf") === "Obra Delp/Contratos", onde.get("contrato.pdf"));
  conferir("o mais fundo fica três níveis abaixo",
    onde.get("aditivo.pdf") === "Obra Delp/Contratos/2026", onde.get("aditivo.pdf"));
  conferir("os irmãos ficam na mesma pasta",
    onde.get("foto1.jpg") === "Obra Delp/Fotos" && onde.get("foto2.jpg") === "Obra Delp/Fotos");

  const caminhos = caminhosDistintos(r.itens);
  conferir("os caminhos distintos são quatro", caminhos.length === 4, JSON.stringify(caminhos.map((c) => c.join("/"))));
}

console.log("\n3) readEntries devolve de 100 em 100 — a segunda armadilha");
{
  // 250 arquivos numa pasta. Quem chama `readEntries` uma vez só acha 100 e acha que acabou.
  const muitos = Array.from({ length: 250 }, (_, i) => entradaDeArquivo(`arq-${i}.txt`));
  const r = await lerArrastados(arrastoDe([entradaDePasta("Grande", muitos)]));
  conferir("leu os 250, e não só os 100 primeiros", r.itens.length === 250, `leu ${r.itens.length}`);
  conferir("inclusive o último", r.itens.some((i) => i.file.name === "arq-249.txt"));
}

console.log("\n4) o que NÃO entra");
{
  const lixo = entradaDePasta("Pasta", [
    entradaDeArquivo("bom.txt"),
    entradaDeArquivo(".DS_Store"),
    entradaDeArquivo("Thumbs.db"),
    entradaDeArquivo("desktop.ini"),
    entradaDeArquivo("~$rascunho.docx"),
  ]);
  const r = await lerArrastados(arrastoDe([lixo]));
  conferir("os arquivos do sistema ficam de fora", r.itens.length === 1, JSON.stringify(r.itens.map((i) => i.file.name)));
  conferir("e o de verdade entra", r.itens[0].file.name === "bom.txt");
}

console.log("\n5) o teto, para um engano não virar estrago");
{
  const muitos = Array.from({ length: 900 }, (_, i) => entradaDeArquivo(`a-${i}.txt`));
  const r = await lerArrastados(arrastoDe([entradaDePasta("Downloads", muitos)]), 500);
  conferir("para no teto", r.itens.length === 500, `${r.itens.length}`);
  conferir("e avisa que cortou", r.cortou === true);
}

console.log("\n6) navegador sem suporte a pasta");
{
  // Sem `webkitGetAsEntry`, sobram os arquivos soltos. Melhor que nada.
  const arrasto = { items: { length: 1, 0: { kind: "file" } }, files: [arquivo("solto.txt")] };
  const r = await lerArrastados(arrasto);
  conferir("cai nos arquivos soltos", r.itens.length === 1 && r.itens[0].file.name === "solto.txt");
  conferir("e diz que não veio estrutura", r.estrutura === false);

  const nada = await lerArrastados(null);
  conferir("arrasto vazio não quebra", nada.itens.length === 0);
}

console.log("\n7) escolher a pasta pelo botão");
{
  const comCaminho = (nome, rel) => ({ ...arquivo(nome), webkitRelativePath: rel });
  const r = lerDoSeletor([
    comCaminho("contrato.pdf", "Obra/Contratos/contrato.pdf"),
    comCaminho("foto.jpg", "Obra/Fotos/foto.jpg"),
    comCaminho("capa.pdf", "Obra/capa.pdf"),
    comCaminho(".DS_Store", "Obra/.DS_Store"),
  ]);
  conferir("três arquivos, o do sistema fora", r.itens.length === 3, `${r.itens.length}`);

  const onde = new Map(r.itens.map((i) => [i.file.name, i.caminho.join("/")]));
  // O `webkitRelativePath` vem com o NOME DO ARQUIVO no fim. Sem tirá-lo, cada arquivo viraria
  // uma pasta com o próprio nome — "Obra/Contratos/contrato.pdf/" como se fosse diretório.
  conferir("o nome do arquivo não vira pasta", onde.get("contrato.pdf") === "Obra/Contratos", onde.get("contrato.pdf"));
  conferir("arquivo na raiz da pasta escolhida", onde.get("capa.pdf") === "Obra", onde.get("capa.pdf"));
  conferir("reconheceu a estrutura", r.estrutura === true);

  const semPasta = lerDoSeletor([arquivo("avulso.txt")]);
  conferir("arquivo sem caminho não ganha pasta", semPasta.itens[0].caminho.length === 0);
  conferir("e diz que não veio estrutura", semPasta.estrutura === false);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
