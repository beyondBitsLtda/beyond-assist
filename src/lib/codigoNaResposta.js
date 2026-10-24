// O código dentro de uma resposta da Lisa, para o editor que abre na tela e DIGITA o código
// enquanto ela explica (pedido de 24/10/2026: "se eu estiver conversando com a Lisa sobre código,
// em qualquer modalidade, ela abre uma IDE na tela, com realce de sintaxe, e começa a digitar o
// código e explicar o que está fazendo"). Ver src/components/panels/IdeDaLisa.js.
//
// A resposta continua sendo texto normal; o código vem nos blocos de três crases que a instrução
// da Lisa pede quando o assunto é código (CODIGO_NA_TELA em src/lib/rag.js). A linha de abertura
// pode trazer a linguagem e o arquivo: ```javascript traduzirLog.js
//
// Puro (sem navegador): funciona com a resposta PELA METADE, enquanto ela ainda chega em
// streaming — o bloco aberto e não fechado vem com `completo: false`. Testado por
// `npm run codigo-check`.

/**
 * A regra que entra na instrução de sistema de TODA conversa (qualquer modo — ver
 * src/app/api/ask/route.js): quando o assunto é código, mostrar o código, em blocos, com a
 * explicação de cada passo antes dele. É a única exceção ao "sem markdown" da fala.
 */
export const CODIGO_NA_TELA = `QUANDO A CONVERSA FOR SOBRE CÓDIGO (um erro, uma função, um trecho, como fazer algo numa
linguagem, uma consulta SQL...): a tela da Lisa abre um editor de código e DIGITA o código
enquanto você explica. Então MOSTRE o código — em vez de só descrever a correção, escreva-a.
- Antes de cada bloco, uma ou duas frases curtas dizendo o que aquele trecho faz (é a explicação
  que aparece enquanto ele é digitado).
- O código vai entre três crases, com a linguagem na linha de abertura; se o código é de um
  arquivo, ponha o nome dele logo depois da linguagem: \`\`\`javascript traduzirLog.js
- Se forem partes diferentes (a função corrigida, depois o uso dela no index.js), um bloco por
  parte, cada um com a sua explicação antes.
- Comentários curtos dentro do código, nas linhas importantes, explicam o passo a passo.
- Mostre só o necessário para entender e resolver: o trecho que muda e o que está em volta dele,
  não o projeto inteiro.
- O código NÃO é lido em voz alta: o texto fora dos blocos segue as regras de fala (frases
  curtas, sem outro markdown) e não repete o código palavra por palavra — diga "olha no editor".
- Os blocos de código são a ÚNICA exceção à regra de não usar markdown. Sem código no assunto,
  nada de blocos.`;

/** A instrução de sistema com a regra do código na tela por cima. */
export function comCodigoNaTela(instrucao) {
  return `${instrucao}\n\n---\n${CODIGO_NA_TELA}`;
}

// apelidos de linguagem → o nome da gramática no prism-react-renderer (as que ele traz prontas;
// java, C# e PHP caem na "clike", que dá a cor das palavras-chave e strings)
const LINGUAGENS = {
  javascript: "javascript", js: "javascript", node: "javascript", nodejs: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "jsx", typescript: "typescript", ts: "typescript", tsx: "tsx",
  python: "python", py: "python",
  sql: "sql", postgres: "sql", postgresql: "sql", plpgsql: "sql",
  css: "css", html: "markup", xml: "markup", svg: "markup", markup: "markup", vue: "markup",
  json: "json", yaml: "yaml", yml: "yaml", markdown: "markdown", md: "markdown", graphql: "graphql",
  go: "go", rust: "rust", rs: "rust", c: "c", cpp: "cpp", "c++": "cpp", kotlin: "kotlin", kt: "kotlin", swift: "swift",
  java: "clike", csharp: "clike", cs: "clike", "c#": "clike", php: "clike",
};

// o nome que aparece na aba quando o bloco não diz o arquivo
const NOMES = {
  javascript: "JavaScript", jsx: "JSX", typescript: "TypeScript", tsx: "TSX", python: "Python", sql: "SQL", css: "CSS",
  markup: "HTML", json: "JSON", yaml: "YAML", markdown: "Markdown", graphql: "GraphQL", go: "Go", rust: "Rust",
  c: "C", cpp: "C++", kotlin: "Kotlin", swift: "Swift", clike: "código",
};

/** A linguagem (no vocabulário do Prism) de um apelido ou da extensão de um arquivo; null = sem cor. */
export function linguagemDe(apelido, arquivo = "") {
  const a = String(apelido || "").trim().toLowerCase();
  if (LINGUAGENS[a]) return LINGUAGENS[a];
  const ext = String(arquivo || "").split(".").pop().toLowerCase();
  return arquivo && LINGUAGENS[ext] ? LINGUAGENS[ext] : null;
}

const ABRE = /^\s*```\s*([^\s`]*)\s*(.*?)\s*$/;
const FECHA = /^\s*```\s*$/;

/**
 * A resposta em trechos de código, cada um com a fala que vem antes dele (a explicação daquele
 * passo): { trechos: [{ fala, codigo, linguagem, arquivo, rotulo, completo }], depois, temCodigo }.
 * `depois` é o que vem depois do último bloco.
 */
export function trechosDaResposta(texto) {
  const linhas = String(texto || "").replace(/\r\n/g, "\n").split("\n");
  const trechos = [];
  let fala = [];
  let aberto = null;
  for (const linha of linhas) {
    if (!aberto) {
      const m = linha.match(ABRE);
      if (m) {
        const [apelido, resto] = [m[1], m[2]];
        // "```javascript traduzirLog.js" — o que vem depois da linguagem é o arquivo (se parece um)
        const arquivo = /[\w-]+\.[\w]+$|\//.test(resto) ? resto.replace(/^[(\[]|[)\]]$/g, "") : "";
        aberto = { fala: fala.join("\n").trim(), linhas: [], apelido, arquivo };
        fala = [];
      } else {
        fala.push(linha);
      }
    } else if (FECHA.test(linha)) {
      trechos.push(fechar(aberto, true, trechos.length));
      aberto = null;
    } else {
      aberto.linhas.push(linha);
    }
  }
  if (aberto) trechos.push(fechar(aberto, false, trechos.length));
  return { trechos, depois: aberto ? "" : fala.join("\n").trim(), temCodigo: trechos.length > 0 };
}

function fechar(aberto, completo, i) {
  const linguagem = linguagemDe(aberto.apelido, aberto.arquivo);
  const nome = aberto.arquivo ? aberto.arquivo.split("/").pop() : `${NOMES[linguagem] || "código"} ${i + 1}`;
  return { fala: aberto.fala, codigo: aberto.linhas.join("\n"), linguagem, arquivo: aberto.arquivo, rotulo: nome, completo };
}

/**
 * A resposta para a tela de conversa, com cada bloco de código trocado por um aviso curto — o
 * código em si está no editor. Um bloco ainda chegando também vira o aviso (nada de crases soltas).
 */
export function respostaSemCodigo(texto) {
  const { trechos } = trechosDaResposta(texto);
  if (!trechos.length) return String(texto || "");
  const saida = [];
  let dentro = false;
  let n = 0;
  for (const linha of String(texto).replace(/\r\n/g, "\n").split("\n")) {
    if (!dentro && ABRE.test(linha)) {
      dentro = true;
      saida.push(`⟨ código no editor: ${trechos[n]?.rotulo || "código"} ⟩`);
      n++;
    } else if (dentro && FECHA.test(linha)) {
      dentro = false;
    } else if (!dentro) {
      saida.push(linha);
    }
  }
  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Onde está a digitação: com `digitados` caracteres já escritos (somando os trechos, na ordem),
 * quanto de cada trecho aparece e qual é o trecho da vez (o primeiro que ainda não terminou).
 */
export function digitacao(trechos, digitados) {
  let resto = Math.max(0, digitados);
  let atual = -1;
  const visiveis = trechos.map((t, i) => {
    const n = Math.min(t.codigo.length, resto);
    resto -= n;
    if (atual < 0 && n < t.codigo.length) atual = i;
    return t.codigo.slice(0, n);
  });
  const total = trechos.reduce((s, t) => s + t.codigo.length, 0);
  return { visiveis, atual: atual < 0 ? trechos.length - 1 : atual, terminou: atual < 0, total };
}

/**
 * Quantos caracteres digitar por batida (a cada ~30 ms): uns 70 por segundo para dar tempo de ler,
 * acelerando quando falta muito, para um arquivo grande não levar minutos.
 */
export function passoDaDigitacao(faltam) {
  if (faltam <= 0) return 0;
  return Math.max(2, Math.ceil(faltam / 150));
}
