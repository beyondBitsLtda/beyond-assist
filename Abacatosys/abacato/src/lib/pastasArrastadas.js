"use client";

/**
 * Ler uma PASTA arrastada do computador, com tudo que está dentro dela.
 *
 * Arrastar uma pasta para uma página é uma das coisas mais cheias de armadilha que o navegador
 * oferece. Três delas derrubam a leitura em silêncio — o arquivo simplesmente não aparece, sem
 * erro nenhum:
 *
 *   1. OS ITENS MORREM QUANDO O EVENTO TERMINA. `dataTransfer.items` só vale durante o
 *      manipulador do `drop`. Um único `await` antes de tocar neles e a lista fica vazia. Por
 *      isso a primeira coisa aqui é pegar todas as entradas de forma síncrona, e só depois
 *      começar a percorrer.
 *
 *   2. `readEntries()` DEVOLVE NO MÁXIMO 100 POR VEZ. Não é erro, é o contrato: chamar uma vez
 *      e parar significa perder tudo a partir do arquivo 101 numa pasta grande — e é
 *      exatamente o tipo de pasta que se arrasta.
 *
 *   3. NEM TODO NAVEGADOR TEM ISSO. Onde `webkitGetAsEntry` não existe, sobram os arquivos
 *      soltos, sem estrutura. Melhor que nada, e a tela diz que a estrutura não veio.
 */

const TETO_DE_ARQUIVOS = 500;

/** Lê todas as entradas de uma pasta — em voltas, porque vêm de 100 em 100. */
function lerTudoDaPasta(leitor) {
  return new Promise((resolve, reject) => {
    const tudo = [];
    const proxima = () => {
      leitor.readEntries((entradas) => {
        // Lista vazia é o sinal de fim. É o único sinal que existe.
        if (!entradas.length) return resolve(tudo);
        tudo.push(...entradas);
        proxima();
      }, reject);
    };
    proxima();
  });
}

function arquivoDaEntrada(entrada) {
  return new Promise((resolve, reject) => entrada.file(resolve, reject));
}

async function percorrer(entrada, caminho, saida, limite) {
  if (saida.length >= limite) return;

  if (entrada.isFile) {
    try {
      const file = await arquivoDaEntrada(entrada);
      // Arquivos escondidos do sistema entram junto e não interessam a ninguém: .DS_Store do
      // Mac, Thumbs.db do Windows. Eles apareceriam como documentos no projeto.
      if (!/^(\.|~\$)|^Thumbs\.db$|^desktop\.ini$/i.test(file.name)) {
        saida.push({ file, caminho });
      }
    } catch { /* arquivo que o navegador não conseguiu ler — segue com o resto */ }
    return;
  }

  if (entrada.isDirectory) {
    const filhas = await lerTudoDaPasta(entrada.createReader());
    for (const f of filhas) {
      await percorrer(f, [...caminho, entrada.name], saida, limite);
      if (saida.length >= limite) return;
    }
  }
}

/**
 * O que foi solto na tela: cada arquivo com o caminho de pastas dele.
 *
 * Devolve `{ itens, estrutura, cortou }`. `estrutura` diz se veio árvore de verdade ou só
 * arquivos soltos — a tela usa para avisar quando o navegador não entregou as pastas.
 */
export async function lerArrastados(dataTransfer, limite = TETO_DE_ARQUIVOS) {
  // SÍNCRONO, antes de qualquer `await`: depois que este trecho sai do ar, `items` está vazio.
  //
  // `Array.from`, e NÃO `[...items]`. Este foi o defeito que fez o arrastar não funcionar:
  // `DataTransferItemList` tem `length` e índices, mas não é iterável — espalhar com `...`
  // lança. E como o manipulador do `drop` é `async`, a exceção virava uma promessa rejeitada
  // que ninguém escutava: nada acontecia, e nada aparecia na tela. `Array.from` lê qualquer
  // coisa parecida com lista, iterável ou não.
  const entradas = [];
  const lista = dataTransfer?.items;
  for (let i = 0; i < (lista?.length || 0); i++) {
    const entrada = lista[i]?.webkitGetAsEntry?.();
    if (entrada) entradas.push(entrada);
  }

  if (!entradas.length) {
    // Navegador sem suporte, ou algo que não é arquivo (um texto, um link). Sobram os arquivos
    // soltos, que é o comportamento de sempre.
    const soltos = Array.from(dataTransfer?.files || []).slice(0, limite).map((file) => ({ file, caminho: [] }));
    return { itens: soltos, estrutura: false, cortou: false };
  }

  const saida = [];
  for (const entrada of entradas) {
    // Um arquivo solto no meio de pastas não ganha caminho nenhum: ele fica onde a pessoa
    // estava, que é o que ela esperaria.
    await percorrer(entrada, [], saida, limite);
    if (saida.length >= limite) break;
  }

  return {
    itens: saida,
    estrutura: entradas.some((e) => e.isDirectory),
    cortou: saida.length >= limite,
  };
}

/**
 * O mesmo, para quem escolheu uma pasta pelo botão (`<input webkitdirectory>`).
 *
 * Aqui o caminho vem pronto em `webkitRelativePath` — e vem com o nome do ARQUIVO no fim, que
 * precisa sair, senão cada arquivo viraria uma pasta com o próprio nome.
 */
export function lerDoSeletor(fileList, limite = TETO_DE_ARQUIVOS) {
  const arquivos = Array.from(fileList || []);
  const itens = [];
  for (const file of arquivos) {
    if (itens.length >= limite) break;
    if (/^(\.|~\$)|^Thumbs\.db$|^desktop\.ini$/i.test(file.name)) continue;
    const relativo = file.webkitRelativePath || "";
    const caminho = relativo ? relativo.split("/").slice(0, -1) : [];
    itens.push({ file, caminho });
  }
  return { itens, estrutura: arquivos.some((f) => f.webkitRelativePath), cortou: arquivos.length > limite };
}

/** Os caminhos distintos, para pedir a árvore ao servidor de uma vez só. */
export function caminhosDistintos(itens) {
  const vistos = new Set();
  for (const i of itens) if (i.caminho.length) vistos.add(i.caminho.join("/"));
  return [...vistos].map((c) => c.split("/"));
}
