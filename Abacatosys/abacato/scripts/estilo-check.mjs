// Confere que toda classe `abacato-*` usada nas telas existe no CSS, e vice-versa.
//
// É o defeito que nenhum teste de API pega e nenhum build reclama: um `abacato-coluna__titulo`
// escrito onde o CSS diz `abacato-coluna__nome` compila, sobe, responde 200 — e aparece como
// um bloco sem estilo no meio da tela. O navegador não tem como avisar: para ele, uma classe
// que não existe é só uma classe sem regra.
//
// Duas armadilhas que este script precisa entender, porque as duas apareceram na primeira vez
// que ele rodou e as duas eram falso alarme:
//
//   1. Nem todo texto com "abacato-" é classe. `localStorage.getItem("abacato-tema")` é uma
//      chave de armazenamento e `<datalist id="abacato-categorias">` é um id — acusar os dois
//      ensina a ignorar o resultado, que é o pior que pode acontecer com um verificador.
//
//   2. Metade das classes é montada na hora: `abacato-prazo--${estado}`. O nome completo não
//      existe em lugar nenhum do código, só o começo dele — e a classe do CSS está em uso.

import fs from "node:fs";
import path from "node:path";

const RAIZ = path.join(import.meta.dirname, "..");

// Contextos em que um texto "abacato-…" NÃO é classe.
const NAO_E_CLASSE =
  /(localStorage|sessionStorage|setAttribute|getAttribute|dataset|\bkey\s*:|data-|\bid=|\blist=|\bhtmlFor=)[^;\n]{0,40}$/;

function varrer(pasta, extensoes, achados = []) {
  for (const nome of fs.readdirSync(pasta)) {
    const cheio = path.join(pasta, nome);
    if (fs.statSync(cheio).isDirectory()) varrer(cheio, extensoes, achados);
    else if (extensoes.some((e) => nome.endsWith(e))) achados.push(cheio);
  }
  return achados;
}

// ---------------------------------------------------------------- o que o CSS define

const folhas = varrer(path.join(RAIZ, "src"), [".css"]);
const definidas = new Set();
for (const folha of folhas) {
  const texto = fs.readFileSync(folha, "utf8");
  for (const achado of texto.matchAll(/\.(abacato-[A-Za-z0-9_-]+)/g)) definidas.add(achado[1]);
}

// ---------------------------------------------------------------- o que as telas usam

const telas = varrer(path.join(RAIZ, "src"), [".js", ".jsx"]);
const usadas = new Map();        // nome inteiro -> arquivos
const comecos = new Set();       // pedaços de nome montados na hora ("abacato-prazo--")

for (const tela of telas) {
  const texto = fs.readFileSync(tela, "utf8");
  const curto = path.relative(RAIZ, tela).replace(/\\/g, "/");

  // Varre o nome onde quer que ele esteja, em vez de tentar entender aspas.
  //
  // A primeira versão procurava strings inteiras com uma expressão regular, e ela quebrava
  // justamente onde mais importa: `className={`abacato-coluna${x === "coluna" ? …}`}` tem
  // ASPAS DENTRO da interpolação, e a varredura de strings parava ali. O resultado foi um
  // relatório dizendo "tudo passou" que na verdade não tinha olhado metade das telas.
  //
  // Os comentários saem antes: eles citam nomes de classe em prosa, e um nome citado num
  // comentário não é uma classe em uso.
  const codigo = texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  for (const achado of codigo.matchAll(/abacato-[A-Za-z0-9_-]*/g)) {
    const nome = achado[0];
    const antes = codigo.slice(Math.max(0, achado.index - 60), achado.index);
    if (NAO_E_CLASSE.test(antes)) continue;

    // `var(--abacato-verde)` é uma VARIÁVEL de cor, não uma classe. As telas usam variáveis
    // direto em `style={{ background: "var(--abacato-verde)" }}`, e acusá-las como classe
    // inexistente é o tipo de alarme falso que ensina a ignorar o verificador.
    if (antes.endsWith("--")) continue;

    // Colado numa interpolação, é um COMEÇO de nome: `abacato-prazo--${estado}` nunca aparece
    // inteiro no código, e o nome completo só existe em tempo de execução.
    if (codigo.slice(achado.index + nome.length).startsWith("${")) {
      comecos.add(nome);
      continue;
    }
    if (!usadas.has(nome)) usadas.set(nome, new Set());
    usadas.get(nome).add(curto);
  }
}

// ---------------------------------------------------------------- comparar

let falhas = 0;
console.log(`\nClasses do Abacato — ${definidas.size} no CSS, ${usadas.size} inteiras nas telas, ${comecos.size} montadas na hora\n`);

const orfas = [...usadas.keys()].filter((c) => !definidas.has(c)).sort();
if (orfas.length === 0) {
  console.log("  ok     toda classe escrita por inteiro existe no CSS");
} else {
  for (const c of orfas) {
    falhas++;
    console.log(`  FALHA  .${c} é usada e não existe no CSS  — ${[...usadas.get(c)].join(", ")}`);
  }
}

// Um começo montado na hora precisa de pelo menos UMA classe no CSS que continue dele. Sem
// nenhuma, `abacato-prazo--${x}` não vai casar com nada, seja qual for o valor de x.
const comecosVazios = [...comecos].filter((c) => ![...definidas].some((d) => d.startsWith(c))).sort();
if (comecosVazios.length) {
  for (const c of comecosVazios) { falhas++; console.log(`  FALHA  .${c}… é montada na hora e o CSS não tem nenhuma classe que comece assim`); }
} else if (comecos.size) {
  console.log("  ok     todo nome montado na hora casa com alguma classe do CSS");
}

const modificadoresSoltos = [...usadas.keys()].filter((c) => {
  if (!c.includes("--")) return false;
  return !definidas.has(c.split("--")[0]);
}).sort();
if (modificadoresSoltos.length) {
  for (const c of modificadoresSoltos) { falhas++; console.log(`  FALHA  .${c} é modificador de um bloco que não existe`); }
} else {
  console.log("  ok     todo modificador tem o bloco base dele");
}

const semUso = [...definidas]
  .filter((c) => !usadas.has(c) && ![...comecos].some((p) => c.startsWith(p)))
  .sort();
if (semUso.length) {
  console.log(`\n  aviso  ${semUso.length} classe(s) no CSS que nenhuma tela usa:`);
  console.log(`         ${semUso.join(", ")}`);
  console.log("         não é defeito — mas se alguma devia estar em uso, o defeito está na tela.");
} else {
  console.log("  ok     nenhuma regra sobrando no CSS");
}

// ---------------------------------------------------------------- painel sem gatilho

// Um painel ligado ao estado, renderizado, estilizado — e que nada na tela abre.
//
// Foi exatamente o que aconteceu com o "Quem acessa" do quadro: o componente importado, o
// `useState` no lugar, o `{compartilhar && <Compartilhar …/>}` escrito, o CSS existindo, a API
// passando 67 verificações. Faltava a única linha que chama `setCompartilhar(true)` — e o
// recurso simplesmente não existia para quem usa. Nada reclama disso: compila, sobe, responde
// 200, e o teste de HTTP passa porque a rota está certa.
//
// A regra: todo estado booleano que decide se um painel aparece precisa de algum jeito de
// virar `true` no mesmo arquivo.
const semGatilho = [];
for (const tela of telas) {
  const texto = fs.readFileSync(tela, "utf8");
  const curto = path.relative(RAIZ, tela).replace(/\\/g, "/");

  for (const achado of texto.matchAll(/const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState\(false\)/g)) {
    const [, estado, setter] = achado;

    // Só interessa o estado que comanda alguma coisa na tela: `{estado && <Algo`. Um booleano
    // usado só em lógica (um `enviando`, um `carregando`) não é um painel.
    const comanda = new RegExp(`\\{\\s*${estado}\\s*&&\\s*[\\(\\s]*<`).test(texto);
    if (!comanda) continue;

    // Vale como gatilho QUALQUER chamada ao setter cujo argumento não seja literalmente
    // `false`, mais o setter entregue a um filho — que é livre para chamá-lo.
    //
    // A primeira versão desta regra exigia o literal `setX(true)` e acusou a lista de quadros,
    // onde o painel de arquivados é aberto por `setVendoArquivados(Boolean(d.mostrando…))`.
    // O botão estava lá e funcionava. Um verificador que grita onde não há defeito é pior que
    // nenhum: ensina a ignorar o resultado.
    const chamadas = [...texto.matchAll(new RegExp(`${setter}\\s*\\(([^)]*)`, "g"))]
      .map((c) => c[1].trim());
    const abre =
      chamadas.some((arg) => arg !== "false") ||
      new RegExp(`[=\\{\\(,]\\s*${setter}\\s*[\\}\\),]`).test(texto);

    if (!abre) semGatilho.push(`${curto}: ${estado} — só existe ${setter}(false); nada o abre`);
  }
}

if (semGatilho.length) {
  falhas += 1;
  console.log(`\n  FALHOU ${semGatilho.length} painel(éis) que a tela nunca abre:`);
  semGatilho.forEach((s) => console.log(`         ${s}`));
} else {
  console.log("  ok     todo painel tem algo que o abre");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
