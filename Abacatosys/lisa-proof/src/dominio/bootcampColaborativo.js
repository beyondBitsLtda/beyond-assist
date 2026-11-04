// ------------------------------------------------------------------ a prova colaborativa do Bootcamp (1.5.0)
//
// O time divide o desafio em quatro partes, que se encaixam numa linha de montagem: cada parte é uma função que
// recebe o que a anterior devolveu (ler → … → formatar). Cada membro escreve a(s) sua(s) função(ões); a parte
// principal do time chama todas, na ordem, e imprime. Na bancada, os jurados juntam o código de todos num programa
// só e rodam os testes: o resultado é do time.
//
// Cada desafio traz o gabarito de cada parte em JavaScript e em Python (`referencia`) e uma versão com um erro
// típico (`comBug`): é o que um personagem da CPU entrega quando escorrega. Quando a pessoa roda os testes da
// própria parte, as outras entram com o gabarito — assim ela testa a sua função sem depender do time.
// O dominio-check roda os gabaritos contra os testes e confere que cada versão com bug quebra pelo menos um.
//
// Módulo puro (sem banco, sem rede); o bootcamp.js reexporta tudo.

export const LINGUAGENS_DA_COLABORATIVA = ["javascript", "python"];

const js = (...linhas) => linhas.join("\n");
const py = js;

export const DESAFIOS_COLABORATIVOS = [
  {
    id: "boletim-do-escritorio", dificuldade: 2, area: "estruturas", titulo: "O boletim do escritório",
    enunciado: "O RH recebe as notas de cada colaborador e precisa do boletim: a média de cada um e o destaque do time. O programa é uma linha de montagem com quatro partes (ler, limpar, calcular e formatar), e cada membro do time escreve uma delas.",
    formatoEntrada: "1ª linha: N, o número de colaboradores.\nDepois, N linhas: o nome e as notas (inteiros), separados por espaço.",
    formatoSaida: "Uma linha por colaborador, na ordem da entrada: \"nome: média\".\nNa última linha: \"Destaque: nome\".",
    requisitos: [
      "Só valem as notas de 0 a 100; as outras são descartadas.",
      "A média é inteira e truncada; sem nota válida, a média é 0.",
      "O destaque é a maior média; no empate, o primeiro da lista.",
    ],
    testes: [
      ["2\nana 80 90 70\nbeto 60 90\n", "ana: 80\nbeto: 75\nDestaque: ana"],
      ["3\ncaio 50 70\ndani 100 95 90\neva 30\n", "caio: 60\ndani: 95\neva: 30\nDestaque: dani"],
      ["2\nfabi 120 80 -5 90\ngui 101\n", "fabi: 85\ngui: 0\nDestaque: fabi"],
      ["2\nhelo 0 100\nivo 99 98\n", "helo: 50\nivo: 98\nDestaque: ivo"],
      ["3\njoao  70 80\nkaue 75\nlia 75 75\n", "joao: 75\nkaue: 75\nlia: 75\nDestaque: joao"],
    ],
    ordem: ["calcular", "limpar", "ler", "formatar"],
    partes: [
      { id: "ler", nome: "Leitura da entrada", parametro: "texto", descricao: "recebe o texto da entrada e devolve a lista de colaboradores: [[nome, [notas]], ...], com as notas como números inteiros." },
      { id: "limpar", nome: "Limpeza das notas", parametro: "lista", descricao: "recebe a lista de ler() e devolve a mesma lista só com as notas válidas (de 0 a 100)." },
      { id: "calcular", nome: "Cálculo das médias", parametro: "lista", descricao: "recebe a lista de limpar() e devolve [[nome, media], ...]: a média inteira (truncada) de cada um, ou 0 se não sobrou nota." },
      { id: "formatar", nome: "Formatação do boletim", parametro: "lista", descricao: "recebe a lista de calcular() e devolve o texto da saída: \"nome: media\" por linha e, no fim, \"Destaque: nome\" (a maior média; no empate, o primeiro)." },
    ],
    codigo: {
      javascript: {
        ler: {
          referencia: js(
            "function ler(texto) {",
            "  const linhas = texto.trim().split(/\\r?\\n/);",
            "  const n = Number(linhas[0]);",
            "  return linhas.slice(1, n + 1).map((linha) => {",
            "    const [nome, ...notas] = linha.trim().split(/\\s+/);",
            "    return [nome, notas.map(Number)];",
            "  });",
            "}"),
          comBug: js(
            "function ler(texto) {",
            "  const linhas = texto.trim().split(\"\\n\");",
            "  const n = Number(linhas[0]);",
            "  return linhas.slice(1, n + 1).map((linha) => {",
            "    const [nome, ...notas] = linha.split(\" \");",
            "    return [nome, notas.map(Number)];",
            "  });",
            "}"),
        },
        limpar: {
          referencia: js(
            "function limpar(lista) {",
            "  return lista.map(([nome, notas]) => [nome, notas.filter((x) => x >= 0 && x <= 100)]);",
            "}"),
          comBug: js(
            "function limpar(lista) {",
            "  return lista.map(([nome, notas]) => [nome, notas.filter((x) => x > 0 && x <= 100)]);",
            "}"),
        },
        calcular: {
          referencia: js(
            "function calcular(lista) {",
            "  return lista.map(([nome, notas]) => [nome, notas.length ? Math.trunc(notas.reduce((a, b) => a + b, 0) / notas.length) : 0]);",
            "}"),
          comBug: js(
            "function calcular(lista) {",
            "  return lista.map(([nome, notas]) => [nome, notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : 0]);",
            "}"),
        },
        formatar: {
          referencia: js(
            "function formatar(lista) {",
            "  let destaque = lista[0];",
            "  for (const item of lista) if (item[1] > destaque[1]) destaque = item;",
            "  return [...lista.map(([nome, media]) => `${nome}: ${media}`), `Destaque: ${destaque[0]}`].join(\"\\n\");",
            "}"),
          comBug: js(
            "function formatar(lista) {",
            "  let destaque = lista[0];",
            "  for (const item of lista) if (item[1] >= destaque[1]) destaque = item;",
            "  return [...lista.map(([nome, media]) => `${nome}: ${media}`), `Destaque: ${destaque[0]}`].join(\"\\n\");",
            "}"),
        },
      },
      python: {
        ler: {
          referencia: py(
            "def ler(texto):",
            "    linhas = texto.strip().split(\"\\n\")",
            "    n = int(linhas[0])",
            "    lista = []",
            "    for linha in linhas[1:n + 1]:",
            "        partes = linha.split()",
            "        lista.append([partes[0], [int(x) for x in partes[1:]]])",
            "    return lista"),
          comBug: py(
            "def ler(texto):",
            "    linhas = texto.strip().split(\"\\n\")",
            "    n = int(linhas[0])",
            "    lista = []",
            "    for linha in linhas[1:n + 1]:",
            "        partes = linha.split(\" \")",
            "        lista.append([partes[0], [int(x) for x in partes[1:]]])",
            "    return lista"),
        },
        limpar: {
          referencia: py(
            "def limpar(lista):",
            "    return [[nome, [x for x in notas if 0 <= x <= 100]] for nome, notas in lista]"),
          comBug: py(
            "def limpar(lista):",
            "    return [[nome, [x for x in notas if 0 < x <= 100]] for nome, notas in lista]"),
        },
        calcular: {
          referencia: py(
            "def calcular(lista):",
            "    return [[nome, (sum(notas) // len(notas)) if notas else 0] for nome, notas in lista]"),
          comBug: py(
            "def calcular(lista):",
            "    return [[nome, int(sum(notas) / len(notas) + 0.5) if notas else 0] for nome, notas in lista]"),
        },
        formatar: {
          referencia: py(
            "def formatar(lista):",
            "    destaque = lista[0]",
            "    for item in lista:",
            "        if item[1] > destaque[1]:",
            "            destaque = item",
            "    return \"\\n\".join([f\"{nome}: {media}\" for nome, media in lista] + [f\"Destaque: {destaque[0]}\"])"),
          comBug: py(
            "def formatar(lista):",
            "    destaque = lista[0]",
            "    for item in lista:",
            "        if item[1] >= destaque[1]:",
            "            destaque = item",
            "    return \"\\n\".join([f\"{nome}: {media}\" for nome, media in lista] + [f\"Destaque: {destaque[0]}\"])"),
        },
      },
    },
  },
  {
    id: "inventario-do-data-center", dificuldade: 2, area: "estruturas", titulo: "O inventário do data center",
    enunciado: "O data center anotou cada entrada e saída de peças, e a equipe precisa do inventário: quanto há de cada item. O programa é uma linha de montagem com quatro partes (ler, normalizar, somar e formatar), e cada membro do time escreve uma delas.",
    formatoEntrada: "1ª linha: N, o número de anotações.\nDepois, N linhas: o item e a quantidade (inteiro; negativo é retirada).",
    formatoSaida: "Os itens em ordem alfabética, um por linha: \"item: total\" (o nome em minúsculas).\nNa última linha: \"Total: X\".",
    requisitos: [
      "O mesmo item pode aparecer mais de uma vez, em maiúsculas ou minúsculas: vale o mesmo item.",
      "Só entram os itens com total maior que 0.",
      "O Total é a soma dos totais listados.",
    ],
    testes: [
      ["3\ncabo 5\nmouse 2\ncabo 3\n", "cabo: 8\nmouse: 2\nTotal: 10"],
      ["4\nssd 1\nhd 2\nram 4\nhd 1\n", "hd: 3\nram: 4\nssd: 1\nTotal: 8"],
      ["3\nCabo 2\ncabo 3\nCABO 1\n", "cabo: 6\nTotal: 6"],
      ["4\nfonte 3\nfonte -3\nteclado 2\nmonitor -1\n", "teclado: 2\nTotal: 2"],
      ["3\n  switch 4\nrack   1\nswitch 1\n", "rack: 1\nswitch: 5\nTotal: 6"],
    ],
    ordem: ["somar", "normalizar", "ler", "formatar"],
    partes: [
      { id: "ler", nome: "Leitura da entrada", parametro: "texto", descricao: "recebe o texto da entrada e devolve [[item, quantidade], ...], com a quantidade como número inteiro." },
      { id: "normalizar", nome: "Normalização dos nomes", parametro: "lista", descricao: "recebe a lista de ler() e devolve a mesma lista com o nome de cada item em minúsculas." },
      { id: "somar", nome: "Soma por item", parametro: "lista", descricao: "recebe a lista de normalizar() e devolve [[item, total], ...]: um por item, em ordem alfabética, só os de total maior que 0." },
      { id: "formatar", nome: "Formatação do inventário", parametro: "lista", descricao: "recebe a lista de somar() e devolve o texto da saída: \"item: total\" por linha e, no fim, \"Total: X\" (a soma dos totais)." },
    ],
    codigo: {
      javascript: {
        ler: {
          referencia: js(
            "function ler(texto) {",
            "  const linhas = texto.trim().split(/\\r?\\n/);",
            "  const n = Number(linhas[0]);",
            "  return linhas.slice(1, n + 1).map((linha) => {",
            "    const partes = linha.trim().split(/\\s+/);",
            "    return [partes[0], Number(partes[1])];",
            "  });",
            "}"),
          comBug: js(
            "function ler(texto) {",
            "  const linhas = texto.trim().split(\"\\n\");",
            "  const n = Number(linhas[0]);",
            "  return linhas.slice(1, n + 1).map((linha) => {",
            "    const partes = linha.split(\" \");",
            "    return [partes[0], Number(partes[1])];",
            "  });",
            "}"),
        },
        normalizar: {
          referencia: js(
            "function normalizar(lista) {",
            "  return lista.map(([item, quantidade]) => [item.trim().toLowerCase(), quantidade]);",
            "}"),
          comBug: js(
            "function normalizar(lista) {",
            "  return lista.map(([item, quantidade]) => [item.trim(), quantidade]);",
            "}"),
        },
        somar: {
          referencia: js(
            "function somar(lista) {",
            "  const totais = new Map();",
            "  for (const [item, quantidade] of lista) totais.set(item, (totais.get(item) || 0) + quantidade);",
            "  return [...totais].filter(([, total]) => total > 0).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));",
            "}"),
          comBug: js(
            "function somar(lista) {",
            "  const totais = new Map();",
            "  for (const [item, quantidade] of lista) totais.set(item, (totais.get(item) || 0) + quantidade);",
            "  return [...totais].filter(([, total]) => total >= 0).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));",
            "}"),
        },
        formatar: {
          referencia: js(
            "function formatar(lista) {",
            "  const total = lista.reduce((soma, [, t]) => soma + t, 0);",
            "  return [...lista.map(([item, t]) => `${item}: ${t}`), `Total: ${total}`].join(\"\\n\");",
            "}"),
          comBug: js(
            "function formatar(lista) {",
            "  const total = lista.reduce((soma, [, t]) => soma + t, 0);",
            "  const ordenada = [...lista].sort((a, b) => b[1] - a[1]);",
            "  return [...ordenada.map(([item, t]) => `${item}: ${t}`), `Total: ${total}`].join(\"\\n\");",
            "}"),
        },
      },
      python: {
        ler: {
          referencia: py(
            "def ler(texto):",
            "    linhas = texto.strip().split(\"\\n\")",
            "    n = int(linhas[0])",
            "    lista = []",
            "    for linha in linhas[1:n + 1]:",
            "        partes = linha.split()",
            "        lista.append([partes[0], int(partes[1])])",
            "    return lista"),
          comBug: py(
            "def ler(texto):",
            "    linhas = texto.strip().split(\"\\n\")",
            "    n = int(linhas[0])",
            "    lista = []",
            "    for linha in linhas[1:n + 1]:",
            "        partes = linha.split(\" \")",
            "        lista.append([partes[0], int(partes[1])])",
            "    return lista"),
        },
        normalizar: {
          referencia: py(
            "def normalizar(lista):",
            "    return [[item.strip().lower(), quantidade] for item, quantidade in lista]"),
          comBug: py(
            "def normalizar(lista):",
            "    return [[item.strip(), quantidade] for item, quantidade in lista]"),
        },
        somar: {
          referencia: py(
            "def somar(lista):",
            "    totais = {}",
            "    for item, quantidade in lista:",
            "        totais[item] = totais.get(item, 0) + quantidade",
            "    return sorted([[item, total] for item, total in totais.items() if total > 0])"),
          comBug: py(
            "def somar(lista):",
            "    totais = {}",
            "    for item, quantidade in lista:",
            "        totais[item] = totais.get(item, 0) + quantidade",
            "    return sorted([[item, total] for item, total in totais.items() if total >= 0])"),
        },
        formatar: {
          referencia: py(
            "def formatar(lista):",
            "    total = sum(t for _, t in lista)",
            "    return \"\\n\".join([f\"{item}: {t}\" for item, t in lista] + [f\"Total: {total}\"])"),
          comBug: py(
            "def formatar(lista):",
            "    total = sum(t for _, t in lista)",
            "    ordenada = sorted(lista, key=lambda x: -x[1])",
            "    return \"\\n\".join([f\"{item}: {t}\" for item, t in ordenada] + [f\"Total: {total}\"])"),
        },
      },
    },
  },
  {
    id: "ponto-do-escritorio", dificuldade: 2, area: "matematica", titulo: "O ponto do escritório",
    enunciado: "O relógio de ponto registrou cada entrada e saída, e o RH precisa das horas trabalhadas de cada pessoa. O programa é uma linha de montagem com quatro partes (ler, converter, somar e formatar), e cada membro do time escreve uma delas.",
    formatoEntrada: "1ª linha: N, o número de registros.\nDepois, N linhas: o nome, a entrada e a saída (HH:MM).",
    formatoSaida: "Uma linha por pessoa, na ordem em que apareceu primeiro: \"nome: XhYY\".\nNa última linha: \"Total: XhYY\".",
    requisitos: [
      "A saída é sempre depois da entrada, no mesmo dia.",
      "A mesma pessoa pode bater o ponto mais de uma vez: some os períodos.",
      "Os minutos sempre com dois dígitos (8h05, e não 8h5).",
    ],
    testes: [
      ["2\nana 08:00 12:30\nbeto 09:15 17:45\n", "ana: 4h30\nbeto: 8h30\nTotal: 13h00"],
      ["3\ncaio 08:00 10:00\ndani 13:00 18:20\ncaio 14:00 15:30\n", "caio: 3h30\ndani: 5h20\nTotal: 8h50"],
      ["1\neva 09:00 17:05\n", "eva: 8h05\nTotal: 8h05"],
      ["4\nfabi 07:10 07:50\ngui 08:00 08:45\nfabi 12:00 12:25\ngui 13:50 14:10\n", "fabi: 1h05\ngui: 1h05\nTotal: 2h10"],
      ["2\nhelo  06:00 06:59\nivo 23:00   23:30\n", "helo: 0h59\nivo: 0h30\nTotal: 1h29"],
    ],
    ordem: ["converter", "somar", "ler", "formatar"],
    partes: [
      { id: "ler", nome: "Leitura da entrada", parametro: "texto", descricao: "recebe o texto da entrada e devolve [[nome, entrada, saida], ...], com os horários como texto (\"HH:MM\")." },
      { id: "converter", nome: "Conversão em minutos", parametro: "lista", descricao: "recebe a lista de ler() e devolve [[nome, minutos], ...]: os minutos trabalhados em cada registro (saída menos entrada)." },
      { id: "somar", nome: "Soma por pessoa", parametro: "lista", descricao: "recebe a lista de converter() e devolve [[nome, minutos], ...]: um por pessoa, somado, na ordem em que cada uma apareceu primeiro." },
      { id: "formatar", nome: "Formatação das horas", parametro: "lista", descricao: "recebe a lista de somar() e devolve o texto da saída: \"nome: XhYY\" por linha e, no fim, \"Total: XhYY\" (minutos com dois dígitos)." },
    ],
    codigo: {
      javascript: {
        ler: {
          referencia: js(
            "function ler(texto) {",
            "  const linhas = texto.trim().split(/\\r?\\n/);",
            "  const n = Number(linhas[0]);",
            "  return linhas.slice(1, n + 1).map((linha) => linha.trim().split(/\\s+/));",
            "}"),
          comBug: js(
            "function ler(texto) {",
            "  const linhas = texto.trim().split(\"\\n\");",
            "  const n = Number(linhas[0]);",
            "  return linhas.slice(1, n + 1).map((linha) => linha.split(\" \"));",
            "}"),
        },
        converter: {
          referencia: js(
            "function converter(lista) {",
            "  const minutos = (h) => { const [hh, mm] = h.split(\":\").map(Number); return hh * 60 + mm; };",
            "  return lista.map(([nome, entrada, saida]) => [nome, minutos(saida) - minutos(entrada)]);",
            "}"),
          comBug: js(
            "function converter(lista) {",
            "  return lista.map(([nome, entrada, saida]) => {",
            "    const [h1, m1] = entrada.split(\":\").map(Number);",
            "    const [h2, m2] = saida.split(\":\").map(Number);",
            "    return [nome, (h2 - h1) * 60 + Math.abs(m2 - m1)];",
            "  });",
            "}"),
        },
        somar: {
          referencia: js(
            "function somar(lista) {",
            "  const totais = new Map();",
            "  for (const [nome, m] of lista) totais.set(nome, (totais.get(nome) || 0) + m);",
            "  return [...totais];",
            "}"),
          comBug: js(
            "function somar(lista) {",
            "  return lista.map(([nome, m]) => [nome, m]);",
            "}"),
        },
        formatar: {
          referencia: js(
            "function formatar(lista) {",
            "  const hm = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, \"0\")}`;",
            "  const total = lista.reduce((soma, [, m]) => soma + m, 0);",
            "  return [...lista.map(([nome, m]) => `${nome}: ${hm(m)}`), `Total: ${hm(total)}`].join(\"\\n\");",
            "}"),
          comBug: js(
            "function formatar(lista) {",
            "  const hm = (m) => `${Math.floor(m / 60)}h${m % 60}`;",
            "  const total = lista.reduce((soma, [, m]) => soma + m, 0);",
            "  return [...lista.map(([nome, m]) => `${nome}: ${hm(m)}`), `Total: ${hm(total)}`].join(\"\\n\");",
            "}"),
        },
      },
      python: {
        ler: {
          referencia: py(
            "def ler(texto):",
            "    linhas = texto.strip().split(\"\\n\")",
            "    n = int(linhas[0])",
            "    return [linha.split() for linha in linhas[1:n + 1]]"),
          comBug: py(
            "def ler(texto):",
            "    linhas = texto.strip().split(\"\\n\")",
            "    n = int(linhas[0])",
            "    return [linha.split(\" \") for linha in linhas[1:n + 1]]"),
        },
        converter: {
          referencia: py(
            "def converter(lista):",
            "    def minutos(h):",
            "        hh, mm = h.split(\":\")",
            "        return int(hh) * 60 + int(mm)",
            "    return [[nome, minutos(saida) - minutos(entrada)] for nome, entrada, saida in lista]"),
          comBug: py(
            "def converter(lista):",
            "    resultado = []",
            "    for nome, entrada, saida in lista:",
            "        h1, m1 = [int(x) for x in entrada.split(\":\")]",
            "        h2, m2 = [int(x) for x in saida.split(\":\")]",
            "        resultado.append([nome, (h2 - h1) * 60 + abs(m2 - m1)])",
            "    return resultado"),
        },
        somar: {
          referencia: py(
            "def somar(lista):",
            "    totais = {}",
            "    for nome, m in lista:",
            "        totais[nome] = totais.get(nome, 0) + m",
            "    return [[nome, m] for nome, m in totais.items()]"),
          comBug: py(
            "def somar(lista):",
            "    return [[nome, m] for nome, m in lista]"),
        },
        formatar: {
          referencia: py(
            "def formatar(lista):",
            "    def hm(m):",
            "        return f\"{m // 60}h{m % 60:02d}\"",
            "    total = sum(m for _, m in lista)",
            "    return \"\\n\".join([f\"{nome}: {hm(m)}\" for nome, m in lista] + [f\"Total: {hm(total)}\"])"),
          comBug: py(
            "def formatar(lista):",
            "    def hm(m):",
            "        return f\"{m // 60}h{m % 60}\"",
            "    total = sum(m for _, m in lista)",
            "    return \"\\n\".join([f\"{nome}: {hm(m)}\" for nome, m in lista] + [f\"Total: {hm(total)}\"])"),
        },
      },
    },
  },
];

/** A linguagem da prova colaborativa: o time inteiro escreve na mesma (JavaScript, se o torneio permitir; senão, Python). */
export function linguagemDaColaborativa(permitidas = []) {
  const lista = permitidas?.length ? permitidas : LINGUAGENS_DA_COLABORATIVA;
  return LINGUAGENS_DA_COLABORATIVA.find((l) => lista.includes(l)) || null;
}

/** A parte principal do time: lê a entrada, passa por todas as partes, na ordem, e imprime. */
export function principalDaColaborativa(partes, linguagem) {
  const cadeia = (entrada) => partes.reduce((dentro, p) => `${p.funcao || p.id}(${dentro})`, entrada);
  if (linguagem === "python") return `import sys\nprint(${cadeia("sys.stdin.read()")})`;
  return `console.log(${cadeia('require("fs").readFileSync(0, "utf8")')});`;
}

/** Um comentário quebrado em linhas de até `largura` caracteres (para caber no editor sem rolar para o lado). */
export function comentario(texto, linguagem, largura = 72) {
  const nota = linguagem === "python" ? "#" : "//";
  const linhas = [];
  let atual = "";
  for (const palavra of String(texto).split(/\s+/).filter(Boolean)) {
    if (atual && `${atual} ${palavra}`.length > largura) { linhas.push(atual); atual = palavra; } else atual = atual ? `${atual} ${palavra}` : palavra;
  }
  if (atual) linhas.push(atual);
  return linhas.map((l) => `${nota} ${l}`).join("\n");
}

/** O começo da função de uma parte, com o contrato no comentário: é o que entra no editor de quem ficou com ela. */
export function assinaturaDaParte(parte, linguagem) {
  const f = parte.funcao || parte.id;
  const contrato = comentario(`Parte "${parte.nome}": ${parte.descricao}`, linguagem);
  if (linguagem === "python") return `${contrato}\ndef ${f}(${parte.parametro}):\n    pass\n`;
  return `${contrato}\nfunction ${f}(${parte.parametro}) {\n  \n}\n`;
}

/** O que entra no editor de quem tem `minhas` partes: o aviso da prova e a assinatura de cada uma. */
export function modeloDasPartes(colaborativa, minhas = []) {
  const { linguagem, partes } = colaborativa;
  const minhasPartes = partes.filter((p) => minhas.includes(p.id));
  return [
    comentario(`Prova colaborativa: escreva só a(s) sua(s) função(ões). Não leia a entrada nem imprima nada: a parte principal do time chama ${partes.map((p) => `${p.funcao || p.id}()`).join(" → ")} e imprime o resultado.`, linguagem),
    "",
    ...minhasPartes.map((p) => assinaturaDaParte(p, linguagem)),
  ].join("\n");
}

/**
 * Divide as partes entre os membros do time, pela ordem de importância do desafio (`ordem`): a primeira parte vai
 * para o primeiro membro, a segunda para o segundo, e assim por diante, dando a volta. Quem chama passa os humanos
 * primeiro: assim uma pessoa sempre fica com uma parte (e com a mais central). Devolve { [membro]: [partes] }.
 */
export function dividirPartes(ordem = [], membros = []) {
  const saida = Object.fromEntries(membros.map((m) => [m, []]));
  if (!membros.length) return saida;
  ordem.forEach((parte, i) => saida[membros[i % membros.length]].push(parte));
  return saida;
}

/** O programa do time: o código de cada membro (na ordem do time) e, no fim, a parte principal. */
export function programaDoTime(colaborativa, blocos = []) {
  return [...blocos.map((b) => String(b || "").trim()).filter(Boolean), colaborativa.principal].join("\n\n");
}

/** O programa para testar só as minhas partes: as outras entram com o gabarito, e o meu código vem depois. */
export function programaDeTeste(colaborativa, minhas = [], meuCodigo = "") {
  const outras = colaborativa.partes.filter((p) => !minhas.includes(p.id)).map((p) => colaborativa.codigo[p.id]?.referencia || "");
  return programaDoTime(colaborativa, [...outras, meuCodigo]);
}

/** O código que um personagem da CPU entrega nas partes dele: o gabarito onde acertou, a versão com bug onde escorregou. */
export function codigoDoNpcNasPartes(colaborativa, partes = [], acertou = {}) {
  return partes.map((id) => colaborativa.codigo[id]?.[acertou[id] === false ? "comBug" : "referencia"] || "").join("\n\n");
}

/**
 * Um desafio colaborativo do banco, numa linguagem que o torneio permite, sem repetir os já usados. Devolve o
 * desafio "cru" (para o validarDesafio) com a parte `colaborativa`, ou null se o torneio não permite nenhuma das
 * linguagens da colaborativa (aí a prova em equipe volta a ser pela média).
 */
export function desafioColaborativo({ usados = [], permitidas = [], s = Math.random } = {}) {
  const linguagem = linguagemDaColaborativa(permitidas);
  if (!linguagem) return null;
  const livres = DESAFIOS_COLABORATIVOS.filter((d) => !usados.includes(d.titulo));
  const lista = livres.length ? livres : DESAFIOS_COLABORATIVOS;
  const d = lista[Math.floor(s() * lista.length)];
  const partes = d.partes.map((p) => ({ id: p.id, nome: p.nome, funcao: p.funcao || p.id, parametro: p.parametro, descricao: p.descricao }));
  return {
    titulo: d.titulo, enunciado: d.enunciado, formatoEntrada: d.formatoEntrada, formatoSaida: d.formatoSaida, requisitos: d.requisitos,
    dificuldade: d.dificuldade, area: d.area, origem: "reserva", linguagem,
    testes: d.testes.map(([entrada, saida]) => ({ entrada, saida })),
    falas: {
      kernel: "Quatro partes, um programa só: se uma engasgar, o time inteiro engasga.",
      vetor: "Respeitem o contrato de cada função: é ele que faz as partes se encaixarem.",
      sintaxe: "Ninguém imprime nada fora da parte principal. Ninguém.",
    },
    colaborativa: {
      id: d.id, linguagem, ordem: [...d.ordem], partes,
      principal: principalDaColaborativa(partes, linguagem),
      codigo: d.codigo[linguagem],
    },
  };
}

/** Confere a parte colaborativa de um desafio (a que vem do banco): partes, ordem, linguagem e o código de cada parte. */
export function validarColaborativa(c) {
  if (!c || !LINGUAGENS_DA_COLABORATIVA.includes(c.linguagem)) return null;
  const partes = (Array.isArray(c.partes) ? c.partes : []).filter((p) => p?.id && c.codigo?.[p.id]?.referencia);
  if (partes.length < 2) return null;
  const ids = partes.map((p) => p.id);
  const ordem = (Array.isArray(c.ordem) ? c.ordem : ids).filter((id) => ids.includes(id));
  return {
    id: String(c.id || ""), linguagem: c.linguagem, ordem: ordem.length === ids.length ? ordem : ids,
    partes: partes.map((p) => ({ id: p.id, nome: String(p.nome || p.id), funcao: String(p.funcao || p.id), parametro: String(p.parametro || "dados"), descricao: String(p.descricao || "") })),
    principal: principalDaColaborativa(partes, c.linguagem),
    codigo: Object.fromEntries(ids.map((id) => [id, { referencia: String(c.codigo[id].referencia), comBug: String(c.codigo[id].comBug || c.codigo[id].referencia) }])),
  };
}

/** A colaborativa para a tela: as partes, a ordem e a parte principal — nunca o gabarito nem as versões com bug. */
export function colaborativaParaTela(c) {
  if (!c) return null;
  return { linguagem: c.linguagem, partes: c.partes.map(({ id, nome, funcao, parametro, descricao }) => ({ id, nome, funcao, parametro, descricao })), principal: c.principal };
}
