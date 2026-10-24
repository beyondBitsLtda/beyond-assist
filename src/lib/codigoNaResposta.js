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
  parte, cada um com a sua explicação antes. Mas um ARQUIVO INTEIRO que você escreve (um README,
  um package.json, um componente) vai num bloco só, do começo ao fim — nunca quebrado em dois.
- Se o conteúdo do bloco tiver três crases dentro (um README com exemplos de comando, por
  exemplo), abra e feche o bloco de fora com QUATRO crases: \`\`\`\`markdown README.md … \`\`\`\`.
  Assim os blocos de dentro não fecham o de fora.
- Comentários curtos dentro do código, nas linhas importantes, explicam o passo a passo.
- ANTES de propor qualquer correção, entenda o TODO, não só o trecho do erro: o código que já
  apareceu na conversa (a seção CÓDIGO DA CONVERSA traz a versão mais recente de cada arquivo),
  de onde vêm os dados, quem chama a função, o que cada parte recebe e devolve. A solução tem que
  funcionar no fluxo inteiro — uma correção que conserta a linha do erro e quebra quem chama é
  uma solução ruim.
- Se faltar uma parte que muda a resposta (a função que chama, o formato dos dados, o arquivo do
  erro), PEÇA essa parte antes de propor a correção, ou diga com todas as letras a suposição que
  você fez. Nunca invente o código que você não viu.
- Mostre a função (ou o arquivo) completa que muda, não um pedaço solto — e cada outro arquivo
  que precisa mudar junto, em blocos separados.
- O código NÃO é lido em voz alta: o texto fora dos blocos segue as regras de fala (frases
  curtas, sem outro markdown) e não repete o código palavra por palavra — diga "olha no editor".
- Os blocos de código são a ÚNICA exceção à regra de não usar markdown. Sem código no assunto,
  nada de blocos.`;

/** A instrução de sistema com a regra do código na tela por cima. */
export function comCodigoNaTela(instrucao) {
  return `${instrucao}\n\n---\n${CODIGO_NA_TELA}`;
}

/** Quanto do código da conversa vai para o prompt (caracteres). */
export const TETO_DO_CODIGO = 12000;

/**
 * O código que já apareceu na conversa — o que a pessoa colou em bloco e o que a Lisa mostrou —
 * para ela enxergar o TODO antes de propor uma correção (pedido de 24/10/2026). A conversa vai
 * para o prompt cortada em 700 caracteres por fala (src/lib/conversa.js), e o corte pega
 * justamente o código. Fica a versão mais recente de cada arquivo (o mesmo nome numa resposta
 * nova substitui o antigo); passando do teto, saem os mais antigos.
 * `textos`: as falas da conversa, da mais antiga para a mais nova.
 */
export function codigoDaConversa(textos, teto = TETO_DO_CODIGO) {
  const porArquivo = new Map();
  (textos || []).forEach((texto, i) => {
    trechosDaResposta(texto).trechos.forEach((t, j) => {
      if (!t.codigo.trim()) return;
      const chave = t.arquivo || `trecho ${i + 1}.${j + 1}`;
      porArquivo.delete(chave); // reinsere no fim: no Map, o mais recente fica por último
      porArquivo.set(chave, t);
    });
  });
  const blocos = [...porArquivo.values()].map((t) =>
    `### ${t.arquivo || "trecho sem nome de arquivo"}${t.linguagem ? ` (${t.linguagem})` : ""}\n\`\`\`\n${t.codigo}\n\`\`\``);
  const escolhidos = [];
  let total = 0;
  for (let k = blocos.length - 1; k >= 0; k--) {
    if (total + blocos[k].length > teto) {
      if (!escolhidos.length) escolhidos.unshift(blocos[k].slice(0, teto)); // um arquivo enorme: vai cortado
      break;
    }
    escolhidos.unshift(blocos[k]);
    total += blocos[k].length;
  }
  return escolhidos.join("\n\n");
}

/** A seção do prompt com o código da conversa ("" sem código). Confere o que veio do navegador. */
export function secaoDoCodigoDaConversa(codigo) {
  const c = typeof codigo === "string" ? codigo.slice(0, TETO_DO_CODIGO + 500).trim() : "";
  return c
    ? `\n\nCÓDIGO DA CONVERSA (a versão mais recente de cada arquivo que já apareceu aqui — leia o todo antes de propor uma correção):\n${c}`
    : "";
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

// a cerca de abertura: 3 ou mais crases, a linguagem e (opcional) o arquivo
const ABRE = /^\s*(`{3,})\s*([^\s`]*)\s*(.*?)\s*$/;
// a de fechamento: só crases (fecha o bloco se tiver pelo menos tantas quanto a que abriu)
const SO_CRASES = /^\s*(`{3,})\s*$/;

/**
 * A resposta em pedaços, na ordem: texto ou bloco de código. Um só leitor para tudo (os trechos
 * do editor, a conversa sem o código e a voz), para os três nunca discordarem.
 *
 * As cercas seguem o Markdown: um bloco aberto com N crases só fecha com N ou mais — por isso um
 * README com blocos de três crases dentro vai num bloco de QUATRO (a regra pede isso à Lisa).
 * E se ela abrir o README com três mesmo, dentro de um bloco de markdown uma cerca COM linguagem
 * ("```bash") abre um bloco de dentro, e a próxima cerca só de crases fecha esse, não o de fora
 * (pedido de 24/10/2026: o README saía quebrado em dois, com metade na caixa de texto).
 */
export function pedacosDaResposta(texto) {
  const linhas = String(texto || "").replace(/\r\n/g, "\n").split("\n");
  const pedacos = [];
  let textoAtual = [];
  let bloco = null;
  const fecharTexto = () => { if (textoAtual.length) pedacos.push({ tipo: "texto", texto: textoAtual.join("\n") }); textoAtual = []; };
  for (const linha of linhas) {
    if (!bloco) {
      const m = linha.match(ABRE);
      if (m) {
        fecharTexto();
        const [, cerca, apelido, resto] = m;
        // "```javascript traduzirLog.js" — o que vem depois da linguagem é o arquivo (se parece um)
        const arquivo = /[\w-]+\.[\w]+$|\//.test(resto) ? resto.replace(/^[(\[]|[)\]]$/g, "") : "";
        bloco = { tipo: "codigo", cerca: cerca.length, apelido, arquivo, linhas: [], dentro: 0, completo: false };
        pedacos.push(bloco);
      } else {
        textoAtual.push(linha);
      }
      continue;
    }
    const so = linha.match(SO_CRASES);
    const markdown = linguagemDe(bloco.apelido, bloco.arquivo) === "markdown";
    if (so && so[1].length >= bloco.cerca && bloco.dentro === 0) {
      bloco.completo = true;
      bloco = null;
      continue;
    }
    if (markdown && bloco.cerca === 3) {
      const abreDentro = linha.match(ABRE);
      if (so && bloco.dentro > 0) bloco.dentro--;
      else if (abreDentro && !so && abreDentro[2]) bloco.dentro++;
    }
    bloco.linhas.push(linha);
  }
  fecharTexto();
  return pedacos;
}

/**
 * A resposta em trechos de código, cada um com a fala que vem antes dele (a explicação daquele
 * passo): { trechos: [{ fala, codigo, linguagem, arquivo, rotulo, completo }], depois, temCodigo }.
 * `depois` é o que vem depois do último bloco.
 */
export function trechosDaResposta(texto) {
  const trechos = [];
  let fala = "";
  for (const p of pedacosDaResposta(texto)) {
    if (p.tipo === "texto") { fala = p.texto; continue; }
    const linguagem = linguagemDe(p.apelido, p.arquivo);
    const rotulo = p.arquivo ? p.arquivo.split("/").pop() : `${NOMES[linguagem] || "código"} ${trechos.length + 1}`;
    trechos.push({ fala: fala.trim(), codigo: p.linhas.join("\n"), linguagem, arquivo: p.arquivo, rotulo, completo: p.completo });
    fala = "";
  }
  return { trechos, depois: fala.trim(), temCodigo: trechos.length > 0 };
}

/**
 * A resposta sem os blocos de código: cada bloco vira `aviso(rotulo)` (ou some, com aviso vazio).
 * Um bloco ainda chegando também é tirado — nada de crases soltas na tela nem na voz.
 */
export function semBlocosDeCodigo(texto, aviso = () => "") {
  const pedacos = pedacosDaResposta(texto);
  if (!pedacos.some((p) => p.tipo === "codigo")) return String(texto || "");
  const { trechos } = trechosDaResposta(texto);
  let n = 0;
  return pedacos
    .map((p) => (p.tipo === "texto" ? p.texto : aviso(trechos[n++]?.rotulo || "código")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A resposta para a tela de conversa, com cada bloco de código trocado por um aviso curto — o
 * código em si está no editor.
 */
export function respostaSemCodigo(texto) {
  return semBlocosDeCodigo(texto, (rotulo) => `⟨ código no editor: ${rotulo} ⟩`);
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
