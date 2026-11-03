// A ARENA LÚDICA DE PROGRAMAÇÃO (03/11/2026, BEYOND-0023): três jogos no lugar dos exercícios parados.
//
//   MASMORRA   uma masmorra 2D em pixel art: portas, armadilhas e inimigos são BUGS. Encostou num, abre o
//              terminal com o código quebrado (sintaxe, lógica ou desempenho); consertou (os testes passam),
//              o caminho abre. Cada andar tem dois bugs e a escada no fim.
//   MASCOTE    um mascote numa grade, controlado pela função `decidir(ver)` que a pessoa escreve: ele vê o que
//              tem na frente e dos lados e faz o que ela mandar. Bug de lógica = ele bate na parede ou cai na água.
//   PARSONS    os blocos de um algoritmo embaralhados: pôr na ordem e com o recuo certo, sem digitar nada.
//
// Puro: o conteúdo, o simulador do mascote, o "arnês" que roda os testes (o mesmo no navegador e no servidor)
// e a conferência dos quebra-cabeças. O servidor confere de verdade antes de pagar (src/lib/arena.js): o
// Parsons aqui mesmo; a masmorra e o mascote rodando o arnês no Wandbox (Node), nunca no nosso servidor.
// Testado em scripts/dominio-check.mjs (inclusive: todo bug quebra e toda solução de referência passa).

export const JOGOS_DA_ARENA = {
  masmorra: { nome: "Masmorra da Depuração", emoji: "🗝️", recompensa: 30, descricao: "Portas, armadilhas e inimigos são bugs. Conserte o código para abrir caminho até a escada." },
  mascote: { nome: "Mascote Programável", emoji: "🐣", recompensa: 25, descricao: "Escreva a função que decide o que o mascote faz: ele precisa comer tudo sem bater na parede nem cair na água." },
  parsons: { nome: "Quebra-cabeças de Parsons", emoji: "🧩", recompensa: 15, descricao: "Os blocos de um algoritmo vieram embaralhados: ponha na ordem e com o recuo certo." },
};
export const ORDEM_DOS_JOGOS = ["masmorra", "mascote", "parsons"];
/** O tempo de cada teste: passou disso, o código é lento demais (os bugs de desempenho). */
export const LIMITE_DO_TESTE_MS = 1500;

// ---------------------------------------------------------------- a masmorra

/**
 * Os bugs: `codigo` é o quebrado (o que a pessoa recebe); `testes` é o que a porta pede (`args` → `esperado`;
 * `{ $gerar: "sequencia", n }` vira uma lista grande, para os de desempenho). `obstaculo`: o desenho no mapa.
 */
export const BUGS = {
  "somar-lista": {
    obstaculo: "porta", tipo: "sintaxe", nome: "A Porta do Total Perdido", funcao: "somar",
    enunciado: "`somar(lista)` devolve a soma dos números da lista. A porta não abre: o JavaScript reclama de alguma coisa.",
    codigo: "function somar(lista) {\n  let total = 0;\n  for (let i = 0; i < lista.length; i++) {\n    total += lista[i];\n  }\n  return totl;\n}",
    testes: [{ args: [[1, 2, 3]], esperado: 6 }, { args: [[]], esperado: 0 }, { args: [[10, -4]], esperado: 6 }],
    dica: "Leia o nome de cada variável com calma: existe alguma que nunca foi criada?",
  },
  "maior-numero": {
    obstaculo: "inimigo", tipo: "logica", nome: "O Goblin dos Negativos", funcao: "maior",
    enunciado: "`maior(lista)` devolve o maior número da lista. Funciona com positivos… e erra quando todos são negativos.",
    codigo: "function maior(lista) {\n  let m = 0;\n  for (const n of lista) {\n    if (n > m) m = n;\n  }\n  return m;\n}",
    testes: [{ args: [[3, 9, 2]], esperado: 9 }, { args: [[-5, -2, -9]], esperado: -2 }, { args: [[7]], esperado: 7 }],
    dica: "Com que valor `m` começa? Se todos forem menores que ele…",
  },
  "contagem-regressiva": {
    obstaculo: "armadilha", tipo: "logica", nome: "A Armadilha do Zero", funcao: "contagem",
    enunciado: "`contagem(n)` devolve a contagem regressiva de n até 0, com o 0 incluído. Falta alguém no fim.",
    codigo: "function contagem(n) {\n  const passos = [];\n  for (let i = n; i > 0; i--) {\n    passos.push(i);\n  }\n  return passos;\n}",
    testes: [{ args: [3], esperado: [3, 2, 1, 0] }, { args: [0], esperado: [0] }, { args: [1], esperado: [1, 0] }],
    dica: "Olhe a condição do `for`: o laço para antes ou depois do zero?",
  },
  "eh-par": {
    obstaculo: "porta", tipo: "sintaxe", nome: "A Porta do Igual", funcao: "ehPar",
    enunciado: "`ehPar(n)` diz se o número é par (true) ou ímpar (false). O código nem roda.",
    codigo: "function ehPar(n) {\n  return n % 2 = 0;\n}",
    testes: [{ args: [4], esperado: true }, { args: [7], esperado: false }, { args: [0], esperado: true }],
    dica: "Um `=` atribui; para comparar, é outro operador.",
  },
  "media-notas": {
    obstaculo: "inimigo", tipo: "logica", nome: "O Esqueleto da Precedência", funcao: "media",
    enunciado: "`media(notas)` devolve a média das notas. A conta sai sempre um pouco errada.",
    codigo: "function media(notas) {\n  let soma = 0;\n  for (const n of notas) soma += n;\n  return soma / notas.length - 1;\n}",
    testes: [{ args: [[8, 6, 10]], esperado: 8 }, { args: [[5]], esperado: 5 }, { args: [[7, 8]], esperado: 7.5 }],
    dica: "O que o `- 1` está fazendo ali? A média é só a soma dividida pela quantidade.",
  },
  palindromo: {
    obstaculo: "armadilha", tipo: "logica", nome: "O Espelho Enganador", funcao: "palindromo",
    enunciado: "`palindromo(palavra)` diz se a palavra é igual de trás para frente, sem ligar para maiúsculas.",
    codigo: "function palindromo(palavra) {\n  const invertida = palavra.split(\"\").reverse().join(\"\");\n  return palavra === invertida.toUpperCase();\n}",
    testes: [{ args: ["Ana"], esperado: true }, { args: ["arara"], esperado: true }, { args: ["casa"], esperado: false }],
    dica: "Para comparar sem ligar para maiúsculas, deixe as DUAS palavras do mesmo jeito.",
  },
  "fibonacci-lento": {
    obstaculo: "inimigo", tipo: "desempenho", nome: "O Dragão Exponencial", funcao: "fib",
    enunciado: "`fib(n)` devolve o n-ésimo número de Fibonacci. Está certo… mas para n = 70 o mundo acaba antes.",
    codigo: "function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}",
    testes: [{ args: [10], esperado: 55 }, { args: [1], esperado: 1 }, { args: [70], esperado: 190392490709135 }],
    dica: "A recursão recalcula as mesmas coisas milhões de vezes. Guarde o que já calculou, ou vá somando num laço.",
  },
  "tem-repetido": {
    obstaculo: "porta", tipo: "desempenho", nome: "A Porta Quadrática", funcao: "temRepetido",
    enunciado: "`temRepetido(lista)` diz se algum valor aparece duas vezes. Com 30 mil itens, a porta não aguenta esperar.",
    codigo: "function temRepetido(lista) {\n  for (let i = 0; i < lista.length; i++) {\n    for (let j = 0; j < lista.length; j++) {\n      if (i !== j && lista[i] === lista[j]) return true;\n    }\n  }\n  return false;\n}",
    testes: [{ args: [[1, 2, 3, 2]], esperado: true }, { args: [[4, 5, 6]], esperado: false }, { args: [{ $gerar: "sequencia", n: 30000 }], esperado: false }],
    dica: "Dois laços um dentro do outro = n². Um `Set` lembra o que já apareceu numa passada só.",
  },
};

/** As soluções de referência (só os testes usam: provam que todo bug tem conserto). */
export const SOLUCOES_DOS_BUGS = {
  "somar-lista": "function somar(lista) {\n  let total = 0;\n  for (let i = 0; i < lista.length; i++) total += lista[i];\n  return total;\n}",
  "maior-numero": "function maior(lista) {\n  let m = lista[0];\n  for (const n of lista) if (n > m) m = n;\n  return m;\n}",
  "contagem-regressiva": "function contagem(n) {\n  const passos = [];\n  for (let i = n; i >= 0; i--) passos.push(i);\n  return passos;\n}",
  "eh-par": "function ehPar(n) {\n  return n % 2 === 0;\n}",
  "media-notas": "function media(notas) {\n  let soma = 0;\n  for (const n of notas) soma += n;\n  return soma / notas.length;\n}",
  palindromo: "function palindromo(palavra) {\n  const p = palavra.toLowerCase();\n  return p === p.split(\"\").reverse().join(\"\");\n}",
  "fibonacci-lento": "function fib(n) {\n  let a = 0, b = 1;\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;\n}",
  "tem-repetido": "function temRepetido(lista) {\n  return new Set(lista).size !== lista.length;\n}",
};

/**
 * O mapa de cada andar (o mesmo corredor em zigue-zague, com cores diferentes): `#` parede, `.` chão, `H` onde o
 * herói começa, `A` e `B` os dois bugs (nessa ordem no caminho), `S` a escada. Os dois bugs fecham o corredor.
 */
const CORREDOR = [
  "###########",
  "#H....A...#",
  "#########.#",
  "#...B.....#",
  "#.#########",
  "#........S#",
  "###########",
];
export const ANDARES_DA_MASMORRA = [
  { id: "andar-1", nome: "Andar 1 · As Celas de Pedra", paleta: "pedra", bugs: ["somar-lista", "maior-numero"], mapa: CORREDOR },
  { id: "andar-2", nome: "Andar 2 · O Porão Musgoso", paleta: "musgo", bugs: ["contagem-regressiva", "eh-par"], mapa: CORREDOR },
  { id: "andar-3", nome: "Andar 3 · A Cripta Roxa", paleta: "cripta", bugs: ["media-notas", "palindromo"], mapa: CORREDOR },
  { id: "andar-4", nome: "Andar 4 · O Covil de Lava", paleta: "lava", bugs: ["fibonacci-lento", "tem-repetido"], mapa: CORREDOR },
];
export const andarPorId = (id) => ANDARES_DA_MASMORRA.find((a) => a.id === id) || null;

/**
 * O arnês dos testes de um bug: o código da pessoa e, depois, os testes, que imprimem uma linha
 * `ARENA:<senha>:<json>` com o resultado de cada um. A senha muda a cada conferência do servidor (a linha não
 * dá para ser impressa pelo código da pessoa por acaso). Roda igual no navegador e no Node.
 */
export function arnesDoBug(bugId, codigo, senha = "local", limiteMs = LIMITE_DO_TESTE_MS) {
  const bug = BUGS[bugId];
  return `${String(codigo ?? "")}
;(function () {
  const gerar = (a) => (a && typeof a === "object" && !Array.isArray(a) && a.$gerar === "sequencia" ? Array.from({ length: a.n }, (_, i) => i * 3 + 1) : a);
  const testes = ${JSON.stringify(bug.testes)};
  const resultados = [];
  let fn = null;
  try { fn = ${bug.funcao}; } catch (e) { fn = null; }
  for (const t of testes) {
    if (typeof fn !== "function") { resultados.push({ ok: false, erro: "a função ${bug.funcao} sumiu do código", ms: 0 }); continue; }
    const args = t.args.map((a) => gerar(JSON.parse(JSON.stringify(a))));
    const ini = Date.now();
    let obtido = null, erro = null;
    try { obtido = fn(...args); } catch (e) { erro = String((e && e.message) || e); }
    const ms = Date.now() - ini;
    const igual = JSON.stringify(obtido) === JSON.stringify(t.esperado);
    resultados.push({ ok: !erro && igual && ms <= ${limiteMs}, erro, obtido: erro ? null : obtido === undefined ? "undefined" : obtido, ms, lento: ms > ${limiteMs} });
  }
  console.log("ARENA:${senha}:" + JSON.stringify(resultados));
})();`;
}

/** Lê o resultado do arnês na saída (as linhas do console): null = não chegou a rodar os testes. */
export function lerArnes(saida, senha = "local") {
  const marca = `ARENA:${senha}:`;
  const linha = String(saida ?? "").split("\n").reverse().find((l) => l.startsWith(marca));
  if (!linha) return null;
  try { return JSON.parse(linha.slice(marca.length)); } catch { return null; }
}

/** Os testes de um bug, para a tela (a lista grande vira um texto curto). */
export const testesParaTela = (bugId) => BUGS[bugId].testes.map((t) => ({
  entrada: t.args.map((a) => (a && a.$gerar ? `[${a.n.toLocaleString("pt-BR")} números diferentes]` : JSON.stringify(a))).join(", "),
  esperado: JSON.stringify(t.esperado),
}));

// ---------------------------------------------------------------- o mascote programável

/** O começo de todo nível: a função que a pessoa escreve. */
export const CODIGO_INICIAL_DO_MASCOTE = `// O mascote vê três casas: ver.frente, ver.esquerda e ver.direita.
// Cada uma pode ser "livre", "parede", "agua" ou "comida".
// Também dá para ler ver.passos (quantos já deu) e ver.comidas (quantas já comeu).
// Devolva UMA ação: "andar", "virar-esquerda", "virar-direita" ou "comer"
// (para comer, a comida precisa estar bem na frente).
function decidir(ver) {
  return "andar";
}`;

/**
 * Os níveis: `mapa` (`#` parede, `~` água, `C` comida, `.` livre), onde o mascote começa e para onde olha
 * (N, L, S, O), e quantos passos ele tem. Comer tudo vence; bater na parede ou cair na água perde.
 */
export const NIVEIS_DO_MASCOTE = [
  { id: "nivel-1", nome: "Primeiros passos", ideia: "decisão (if)", inicio: { x: 1, y: 1, dir: "L" }, maxPassos: 20,
    mapa: ["#######", "#....C#", "#######"],
    dica: "Ande até a comida ficar na frente; aí, coma. Um `if (ver.frente === \"comida\")` resolve." },
  { id: "nivel-2", nome: "A curva", ideia: "condições em sequência", inicio: { x: 1, y: 1, dir: "L" }, maxPassos: 30,
    mapa: ["#######", "#....##", "####.##", "####.##", "####C##", "#######"],
    dica: "Na frente tem parede? Vire. Senão, ande. E não esqueça de comer quando a comida aparecer." },
  { id: "nivel-3", nome: "Três lanches", ideia: "repetir a mesma regra", inicio: { x: 1, y: 1, dir: "L" }, maxPassos: 60,
    mapa: ["#########", "#..C....#", "#######.#", "#C..C...#", "#########"],
    dica: "A mesma regra serve para o caminho inteiro: comer, andar, virar quando trancar." },
  { id: "nivel-4", nome: "Cuidado com a água", ideia: "olhar os lados antes de virar", inicio: { x: 1, y: 1, dir: "L" }, maxPassos: 60,
    mapa: ["#########", "#....~~~#", "####.####", "####....#", "#######C#", "#########"],
    dica: "Água na frente também tranca. E na hora de virar, olhe qual lado está livre (ver.direita, ver.esquerda)." },
  { id: "nivel-5", nome: "A ilha das frutas", ideia: "prioridades (else if)", inicio: { x: 1, y: 1, dir: "L" }, maxPassos: 120,
    mapa: ["##########", "#.....C..#", "#.######.#", "#C#....#.#", "#.#.##.#.#", "#...#C...#", "##########"],
    dica: "Comida do lado também conta: vire para ela. Depois: em frente se der, senão o lado livre." },
];
export const nivelPorId = (id) => NIVEIS_DO_MASCOTE.find((n) => n.id === id) || null;

/**
 * O simulador do mascote. AUTOSSUFICIENTE (sem nada de fora): o texto dele vai inteiro para o arnês que roda
 * no navegador e no Node. Devolve se venceu, o motivo de ter perdido e o rastro de cada passo (a tela anima).
 */
export function simularMascote(nivel, decidir) {
  const mapa = nivel.mapa.map((l) => l.split(""));
  const PASSO = { N: [0, -1], L: [1, 0], S: [0, 1], O: [-1, 0] };
  const RODA = ["N", "L", "S", "O"];
  const ACOES = ["andar", "virar-esquerda", "virar-direita", "comer"];
  let x = nivel.inicio.x, y = nivel.inicio.y, dir = nivel.inicio.dir, comidas = 0;
  const total = mapa.reduce((s, l) => s + l.filter((c) => c === "C").length, 0);
  const rastro = [];
  const oQueTem = (cx, cy) => { const c = mapa[cy] && mapa[cy][cx]; return c === undefined || c === "#" ? "parede" : c === "~" ? "agua" : c === "C" ? "comida" : "livre"; };
  const adiante = (d) => [x + PASSO[d][0], y + PASSO[d][1]];
  const gira = (d, lado) => RODA[(RODA.indexOf(d) + (lado === "direita" ? 1 : 3)) % 4];
  const verEm = (d) => { const p = adiante(d); return oQueTem(p[0], p[1]); };
  const fim = (venceu, motivo, passos) => ({ venceu, motivo, comidas, total, passos, rastro });
  for (let passo = 0; passo < nivel.maxPassos; passo++) {
    const ver = Object.freeze({
      frente: verEm(dir), esquerda: verEm(gira(dir, "esquerda")), direita: verEm(gira(dir, "direita")),
      passos: passo, comidas,
    });
    let acao;
    try { acao = typeof decidir === "function" ? decidir(ver) : undefined; } catch (e) { return fim(false, "o código deu erro: " + String((e && e.message) || e), passo); }
    if (!ACOES.includes(acao)) return fim(false, "decidir() devolveu " + JSON.stringify(acao === undefined ? null : acao) + " — use \"andar\", \"virar-esquerda\", \"virar-direita\" ou \"comer\"", passo);
    if (acao === "virar-esquerda") dir = gira(dir, "esquerda");
    else if (acao === "virar-direita") dir = gira(dir, "direita");
    else if (acao === "andar") {
      const [nx, ny] = adiante(dir);
      const o = oQueTem(nx, ny);
      if (o === "parede") { rastro.push({ x, y, dir, acao, bateu: true }); return fim(false, "o mascote bateu na parede", passo + 1); }
      if (o === "agua") { rastro.push({ x: nx, y: ny, dir, acao, caiu: true }); return fim(false, "o mascote caiu na água", passo + 1); }
      if (o === "comida") { rastro.push({ x, y, dir, acao, bateu: true }); return fim(false, "a comida estava na frente: era hora de \"comer\", não de andar", passo + 1); }
      x = nx; y = ny;
    } else {
      const [nx, ny] = adiante(dir);
      if (oQueTem(nx, ny) !== "comida") { rastro.push({ x, y, dir, acao }); return fim(false, "ele tentou comer, mas não tinha comida na frente", passo + 1); }
      mapa[ny][nx] = ".";
      comidas++;
    }
    rastro.push({ x, y, dir, acao, comeu: acao === "comer" });
    if (comidas === total) return fim(true, "", passo + 1);
  }
  return fim(false, "acabaram os " + nivel.maxPassos + " passos antes de comer tudo", nivel.maxPassos);
}

/** O arnês do mascote: a função da pessoa, o simulador e o nível, imprimindo o resultado com a senha. */
export function arnesDoMascote(nivelId, codigo, senha = "local") {
  const nivel = nivelPorId(nivelId);
  return `${String(codigo ?? "")}
;(function () {
  const simular = (${simularMascote.toString()});
  let r;
  try { r = simular(${JSON.stringify(nivel)}, typeof decidir === "function" ? decidir : null); }
  catch (e) { r = { venceu: false, motivo: "o código deu erro: " + String((e && e.message) || e), rastro: [] }; }
  console.log("ARENA:${senha}:" + JSON.stringify(r));
})();`;
}

/** As soluções de referência do mascote (só os testes usam). */
export const SOLUCAO_DO_MASCOTE = `function decidir(ver) {
  if (ver.frente === "comida") return "comer";
  if (ver.esquerda === "comida") return "virar-esquerda";
  if (ver.direita === "comida") return "virar-direita";
  if (ver.frente === "livre") return "andar";
  if (ver.direita === "livre") return "virar-direita";
  return "virar-esquerda";
}`;

// ---------------------------------------------------------------- os quebra-cabeças de Parsons

/** Cada linha com o recuo dela (em níveis). A ordem aqui é a resposta. */
export const PUZZLES_DE_PARSONS = [
  { id: "soma-ate-n", linguagem: "python", titulo: "Somar de 1 até n", enunciado: "Monte a função que soma todos os números de 1 até n.",
    linhas: [["def soma(n):", 0], ["total = 0", 1], ["for i in range(1, n + 1):", 1], ["total += i", 2], ["return total", 1]] },
  { id: "contar-vogais", linguagem: "javascript", titulo: "Contar vogais", enunciado: "Monte a função que conta as vogais de um texto.",
    linhas: [["function contarVogais(texto) {", 0], ["let n = 0;", 1], ["for (const letra of texto.toLowerCase()) {", 1], ["if (\"aeiou\".includes(letra)) {", 2], ["n++;", 3], ["}", 2], ["}", 1], ["return n;", 1], ["}", 0]] },
  { id: "maior-da-lista", linguagem: "python", titulo: "O maior da lista", enunciado: "Monte a função que acha o maior número de uma lista.",
    linhas: [["def maior(lista):", 0], ["m = lista[0]", 1], ["for x in lista:", 1], ["if x > m:", 2], ["m = x", 3], ["return m", 1]] },
  { id: "fizzbuzz", linguagem: "javascript", titulo: "FizzBuzz", enunciado: "Múltiplo de 15 é \"FizzBuzz\", de 3 é \"Fizz\", de 5 é \"Buzz\"; o resto é o próprio número. A ordem dos testes importa!",
    linhas: [["function fizzbuzz(n) {", 0], ["if (n % 15 === 0) {", 1], ["return \"FizzBuzz\";", 2], ["} else if (n % 3 === 0) {", 1], ["return \"Fizz\";", 2], ["} else if (n % 5 === 0) {", 1], ["return \"Buzz\";", 2], ["}", 1], ["return String(n);", 1], ["}", 0]] },
  { id: "fatorial", linguagem: "python", titulo: "Fatorial recursivo", enunciado: "Monte o fatorial com recursão: o caso base primeiro.",
    linhas: [["def fatorial(n):", 0], ["if n <= 1:", 1], ["return 1", 2], ["return n * fatorial(n - 1)", 1]] },
  { id: "inverter-texto", linguagem: "javascript", titulo: "Inverter um texto", enunciado: "Monte a função que devolve o texto de trás para frente, letra por letra.",
    linhas: [["function inverter(texto) {", 0], ["let resultado = \"\";", 1], ["for (let i = texto.length - 1; i >= 0; i--) {", 1], ["resultado += texto[i];", 2], ["}", 1], ["return resultado;", 1], ["}", 0]] },
  { id: "busca-binaria", linguagem: "python", titulo: "Busca binária", enunciado: "Monte a busca binária numa lista ordenada: devolve a posição do alvo ou -1.",
    linhas: [["def busca(lista, alvo):", 0], ["ini, fim = 0, len(lista) - 1", 1], ["while ini <= fim:", 1], ["meio = (ini + fim) // 2", 2], ["if lista[meio] == alvo:", 2], ["return meio", 3], ["elif lista[meio] < alvo:", 2], ["ini = meio + 1", 3], ["else:", 2], ["fim = meio - 1", 3], ["return -1", 1]] },
  { id: "filtrar-pares", linguagem: "javascript", titulo: "Filtrar os pares", enunciado: "Monte a função que devolve só os números pares da lista, com filter.",
    linhas: [["function pares(lista) {", 0], ["const resultado = lista.filter((n) => {", 1], ["return n % 2 === 0;", 2], ["});", 1], ["return resultado;", 1], ["}", 0]] },
];
export const puzzlePorId = (id) => PUZZLES_DE_PARSONS.find((p) => p.id === id) || null;
export const RECUO_MAXIMO = 4;

/** Um sorteio pequeno e próprio (a mesma semente dá o mesmo embaralhado). */
function sorteador(semente) {
  let a = (semente >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sementeDoTexto = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Os blocos para a tela: embaralhados (nunca na ordem certa), sem o recuo — achar o recuo faz parte. */
export function blocosEmbaralhados(puzzleId, chave = "") {
  const p = puzzlePorId(puzzleId);
  const s = sorteador(sementeDoTexto(`${puzzleId}:${chave}`));
  const blocos = p.linhas.map(([texto], i) => ({ id: `b${i}`, texto }));
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    for (let i = blocos.length - 1; i > 0; i--) { const j = Math.floor(s() * (i + 1)); [blocos[i], blocos[j]] = [blocos[j], blocos[i]]; }
    if (blocos.some((b, i) => b.id !== `b${i}`)) break;
  }
  return blocos;
}

/**
 * Confere a resposta ([{ id, recuo }] na ordem montada). Linhas iguais (os "}") valem em qualquer das posições
 * delas: compara o TEXTO e o recuo de cada posição. Devolve se acertou e quantas linhas estão no lugar.
 */
export function conferirParsons(puzzleId, resposta) {
  const p = puzzlePorId(puzzleId);
  if (!p) return { ok: false, certas: 0, total: 0 };
  const textos = new Map(p.linhas.map(([texto], i) => [`b${i}`, texto]));
  const lista = Array.isArray(resposta) ? resposta : [];
  const ids = lista.map((r) => r?.id);
  const completa = lista.length === p.linhas.length && new Set(ids).size === ids.length && ids.every((id) => textos.has(id));
  let certas = 0;
  p.linhas.forEach(([texto, recuo], i) => {
    const r = lista[i];
    if (r && textos.get(r.id) === texto && Number(r.recuo) === recuo) certas++;
  });
  return { ok: completa && certas === p.linhas.length, certas, total: p.linhas.length };
}

// ---------------------------------------------------------------- progresso

/** As fases de cada jogo, na ordem em que liberam (a próxima abre quando a anterior é vencida). */
export const FASES_DA_ARENA = {
  masmorra: ANDARES_DA_MASMORRA.map((a) => a.id),
  mascote: NIVEIS_DO_MASCOTE.map((n) => n.id),
  parsons: PUZZLES_DE_PARSONS.map((p) => p.id),
};
export const faseExiste = (jogo, fase) => Boolean(FASES_DA_ARENA[jogo]?.includes(fase));

/** A fase está liberada? A primeira sempre; as outras, quando a anterior foi concluída. */
export function faseLiberada(jogo, fase, concluidas = new Set()) {
  const lista = FASES_DA_ARENA[jogo] || [];
  const i = lista.indexOf(fase);
  return i === 0 || (i > 0 && concluidas.has(`${jogo}:${lista[i - 1]}`));
}
