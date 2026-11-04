// O Modo Bootcamp (04/11/2026): um reality show de programação num escritório de TI futurista. Até 8
// competidores (humanos e personagens da Lisa), cada um na sua baia, 3 jurados virtuais que lançam o desafio da
// rodada e avaliam no fim dela, e dois formatos: mata-mata (confronto direto, quem perde sai) ou pontos corridos
// (todos jogam todas as rodadas e a nota acumula).
//
// Puro (sem rede nem banco): os formatos, o fluxo do exercício, os personagens, os jurados, a conferência dos
// testes, a simulação dos personagens e o resultado de cada rodada. O banco mora em src/lib/bootcamp.js e a IA
// dos jurados em src/lib/iaBootcamp.js. Testado em scripts/dominio-check.mjs.

import { EXECUCAO } from "./execucao.js";
import { PERSONAGENS } from "./personagens.js";

export const BOOTCAMP = {
  minParticipantes: 2,
  maxParticipantes: 8,
  formatos: ["mata-mata", "pontos-corridos"],
  // minutos por desafio; null = sem limite de tempo (o tempo é opcional na criação do torneio)
  tempos: [null, 15, 30, 45, 60, 90],
  rodadasDosPontosCorridos: [2, 3, 4, 5],
  testes: { min: 3, max: 6, visiveis: 2 },
  limites: { nome: 60, plano: 2000, codigo: 20_000, caminho: 200, entrada: 2000, saida: 4000, enunciado: 2500 },
  minimoDoPlano: 15,
};

export const FORMATOS = {
  "mata-mata": { nome: "Mata-mata", descricao: "Confronto direto a cada rodada: quem tirar a nota menor no par sai do torneio." },
  "pontos-corridos": { nome: "Pontos corridos", descricao: "Todo mundo faz todas as rodadas; a nota de cada uma soma, e quem tiver mais no fim leva." },
};

// ------------------------------------------------------------------ linguagens
// O Bootcamp confere os testes no servidor, num compilador on-line (Wandbox): entrada pelo stdin, resposta pelo
// stdout, então o mesmo desafio vale para qualquer linguagem. JavaScript roda no Node do Wandbox (no exercício
// do dia ele roda no navegador). SQL fica de fora: não lê stdin.
const EXTENSOES = {
  javascript: "js", typescript: "ts", python: "py", c: "c", cpp: "cpp", java: "java", csharp: "cs", php: "php",
  go: "go", rust: "rs", ruby: "rb", swift: "swift", shell: "sh",
};
export const LINGUAGENS_DO_BOOTCAMP = Object.fromEntries([
  ["javascript", { rotulo: "JavaScript (Node 20)", compilador: "nodejs-20.17.0", extensao: "js" }],
  ...Object.entries(EXECUCAO)
    .filter(([, e]) => e.onde === "servidor")
    .map(([chave, e]) => [chave, { rotulo: e.rotulo, compilador: e.compilador, extensao: EXTENSOES[chave] || "txt" }]),
]);
export const ORDEM_DAS_LINGUAGENS = Object.keys(LINGUAGENS_DO_BOOTCAMP);

const APELIDOS = {
  js: "javascript", node: "javascript", nodejs: "javascript", "node.js": "javascript", py: "python", python3: "python",
  "c++": "cpp", "c#": "csharp", cs: "csharp", ts: "typescript", golang: "go", rs: "rust", rb: "ruby", bash: "shell", sh: "shell",
};

/** "Python 3" → "python"; "C++" → "cpp"; o que o Bootcamp não roda → "". */
export function chaveDaLinguagem(nome) {
  const n = String(nome || "").toLowerCase().trim().replace(/\s*\(.*\)$/, "").replace(/\s*\d+(\.\d+)*$/, "").trim();
  const chave = LINGUAGENS_DO_BOOTCAMP[n] ? n : APELIDOS[n] || "";
  return LINGUAGENS_DO_BOOTCAMP[chave] ? chave : "";
}

/** O caminho sugerido do arquivo da solução no repositório: bootcamp/rodada-1/solucao.py */
export function caminhoPadrao(numero, linguagem) {
  const ext = LINGUAGENS_DO_BOOTCAMP[chaveDaLinguagem(linguagem)]?.extensao || "txt";
  return `bootcamp/rodada-${Math.max(1, Number(numero) || 1)}/solucao.${ext}`;
}

/** O código inicial do editor em cada linguagem: já lê a entrada (stdin) e imprime (stdout). */
export const MODELOS_DE_CODIGO = {
  javascript: 'const entrada = require("fs").readFileSync(0, "utf8");\nconst linhas = entrada.trim().split("\\n");\n\n// a sua solução aqui\nconsole.log(linhas[0]);\n',
  typescript: 'declare const require: any;\nconst entrada: string = require("fs").readFileSync(0, "utf8");\nconst linhas = entrada.trim().split("\\n");\n\n// a sua solução aqui\nconsole.log(linhas[0]);\n',
  python: 'import sys\n\nlinhas = sys.stdin.read().strip().split("\\n")\n\n# a sua solução aqui\nprint(linhas[0])\n',
  c: '#include <stdio.h>\n\nint main(void) {\n    char linha[1024];\n    /* a sua solução aqui: leia com scanf ou fgets */\n    if (fgets(linha, sizeof linha, stdin)) printf("%s", linha);\n    return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    string linha;\n    // a sua solução aqui\n    getline(cin, linha);\n    cout << linha << "\\n";\n    return 0;\n}\n',
  java: 'import java.util.*;\n\nclass Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // a sua solução aqui\n        System.out.println(sc.nextLine());\n    }\n}\n',
  csharp: 'using System;\n\nclass Programa {\n    static void Main() {\n        var linha = Console.ReadLine();\n        // a sua solução aqui\n        Console.WriteLine(linha);\n    }\n}\n',
  php: '<?php\n$linhas = explode("\\n", trim(stream_get_contents(STDIN)));\n// a sua solução aqui\necho $linhas[0], "\\n";\n',
  go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tleitor := bufio.NewScanner(os.Stdin)\n\t// a sua solução aqui\n\tif leitor.Scan() {\n\t\tfmt.Println(leitor.Text())\n\t}\n}\n',
  rust: 'use std::io::{self, Read};\n\nfn main() {\n    let mut entrada = String::new();\n    io::stdin().read_to_string(&mut entrada).unwrap();\n    // a sua solução aqui\n    println!("{}", entrada.lines().next().unwrap_or(""));\n}\n',
  ruby: 'linhas = STDIN.read.strip.split("\\n")\n# a sua solução aqui\nputs linhas[0]\n',
  swift: 'let linha = readLine() ?? ""\n// a sua solução aqui\nprint(linha)\n',
  shell: 'read -r linha\n# a sua solução aqui\necho "$linha"\n',
};

// ------------------------------------------------------------------ os 3 jurados
// Personagens originais. Cada um avalia um critério; as skins são do Neuro e nenhum competidor usa as mesmas.
export const JURADOS = [
  {
    id: "kernel", nome: "Jurado Kernel", emoji: "⚙️", personagem: "robo",
    criterio: "Desempenho técnico", foco: "se a solução está correta, passa nos testes (inclusive os ocultos) e é eficiente",
    estilo: "exigente e direto, fala de números e de complexidade",
  },
  {
    id: "vetor", nome: "Jurada Vetor", emoji: "📐", personagem: "mago",
    criterio: "Arquitetura", foco: "a organização do código, os nomes, a legibilidade e o planejamento feito antes de codar",
    estilo: "elegante e caprichosa, elogia código limpo e cobra funções bem divididas",
  },
  {
    id: "sintaxe", nome: "Jurada Sintaxe", emoji: "📜", personagem: "astronauta",
    criterio: "Conformidade com as regras", foco: "se a entrega segue o enunciado, os requisitos, a linguagem estipulada e o formato da saída",
    estilo: "rigorosa e bem-humorada, não deixa passar um detalhe do enunciado",
  },
];
export const IDS_DOS_JURADOS = JURADOS.map((j) => j.id);
const SKINS_DOS_JURADOS = new Set(JURADOS.map((j) => j.personagem));

// ------------------------------------------------------------------ os personagens da Lisa
// Os competidores controlados pelo modelo da Lisa: skin, nome e personalidade únicos. `habilidade` (0–1) é a
// chance de cada teste passar num desafio fácil; `ritmo` multiplica o tempo que levam (menor = mais rápido).
export const NPCS_DO_BOOTCAMP = [
  { id: "lisa", nome: "Lisa", skin: "lisa", habilidade: 0.84, ritmo: 1.0, personalidade: "A tutora do Proof jogando de igual para igual: calma e metódica, planeja antes de escrever uma linha.", bordao: "Primeiro eu entendo o problema; depois eu codo." },
  { id: "byte-ninja", nome: "Byte Ninja", skin: "ninja", habilidade: 0.74, ritmo: 0.7, personalidade: "Silencioso e rapidíssimo; entrega soluções curtas, às vezes curtas demais.", bordao: "Menos linhas, menos bugs." },
  { id: "capita-stack", nome: "Capitã Stack", skin: "pirata", habilidade: 0.79, ritmo: 1.15, personalidade: "Caçadora de bugs: testa cada caso de borda antes de entregar.", bordao: "Bug à vista! Todos aos testes!" },
  { id: "raposa-regex", nome: "Raposa Regex", skin: "raposao", habilidade: 0.71, ritmo: 0.9, personalidade: "Astuta e criativa; resolve tudo com expressão regular, mesmo quando não devia.", bordao: "Isso aí cabe numa regex." },
  { id: "cogu-commit", nome: "Cogu Commit", skin: "cogumelo", habilidade: 0.67, ritmo: 1.25, personalidade: "Tranquilo e organizado: commits pequenos, mensagens caprichadas e nenhuma pressa.", bordao: "Um commit de cada vez." },
  { id: "mergulho-profundo", nome: "Mergulho Profundo", skin: "mergulhador", habilidade: 0.81, ritmo: 1.35, personalidade: "Analisa o problema a fundo; demora para começar, mas raramente erra.", bordao: "Antes de nadar, eu olho o fundo." },
  { id: "yeti-legado", nome: "Yeti Legado", skin: "yeti", habilidade: 0.69, ritmo: 1.1, personalidade: "Veterano de sistemas antigos: conservador, prefere o laço for clássico a qualquer novidade.", bordao: "Funciona desde 1998, não mexe." },
  { id: "magma-hotfix", nome: "Magma Hotfix", skin: "magma", habilidade: 0.6, ritmo: 0.6, personalidade: "Impulsivo e explosivo: entrega primeiro e conserta depois.", bordao: "Sobe pra produção que eu arrumo lá!" },
  { id: "zorg-compilador", nome: "Zorg Compilador", skin: "alienigena", habilidade: 0.77, ritmo: 1.0, personalidade: "Veio de outro planeta otimizar o seu código; fala de complexidade o tempo todo.", bordao: "O(n²)? No meu planeta isso é crime." },
  { id: "abacatinho-agil", nome: "Abacatinho Ágil", skin: "abacato", habilidade: 0.65, ritmo: 0.95, personalidade: "Fã de metodologias ágeis: quebra tudo em tarefinhas e comemora cada uma.", bordao: "Mais uma tarefa pro Concluído!" },
];
export const npcPorId = (id) => NPCS_DO_BOOTCAMP.find((n) => n.id === id) || null;

// skins para humanos que repetiram a de outro humano (a skin de cada competidor é única no torneio)
const SKINS_DE_RESERVA = ["neuro", "ninja", "pirata", "raposao", "cogumelo", "mergulhador", "yeti", "magma", "alienigena", "abacato", "lisa"];

// ------------------------------------------------------------------ o fluxo do exercício
// As etapas do fluxograma "Fluxo de Desenvolvimento do Exercício". Entre "testes" e "revisao" fica a decisão
// "Passou nos testes?": não → volta para o código (correção); sim → pode enviar para a revisão dos jurados.
export const ETAPAS_DO_FLUXO = [
  { id: "leitura", titulo: "Início: Recebimento e Leitura do Enunciado", curto: "Enunciado" },
  { id: "analise", titulo: "Análise de Requisitos e Planejamento", curto: "Análise" },
  { id: "ambiente", titulo: "Configuração do Ambiente de Desenvolvimento", curto: "Ambiente" },
  { id: "codigo", titulo: "Implementação da Solução / Código", curto: "Código" },
  { id: "testes", titulo: "Execução de Testes Unitários e Validação", curto: "Testes" },
  { id: "revisao", titulo: "Revisão", curto: "Revisão" },
  { id: "fim", titulo: "Fim", curto: "Fim" },
];
export const ORDEM_DO_FLUXO = ETAPAS_DO_FLUXO.map((e) => e.id);
const indice = (etapa) => ORDEM_DO_FLUXO.indexOf(etapa);

/**
 * Um passo no fluxo. `acao`: "ler" | "planejar" | "ambiente" | "testar" | "enviar" | "avaliar".
 * `ctx`: { plano, modo, linguagem, repoValido, passou }. Devolve { ok, etapa, motivo }.
 *
 * Voltar atrás é permitido onde faz sentido: rever o plano ou trocar o ambiente antes do envio. Trocar o ambiente
 * (modo ou linguagem) volta para o código, porque os testes feitos antes já não valem.
 */
export function avancarNoFluxo(etapa, acao, ctx = {}) {
  const i = indice(etapa);
  if (i < 0) return { ok: false, etapa, motivo: "etapa desconhecida" };
  const enviada = i >= indice("revisao");
  const nega = (motivo) => ({ ok: false, etapa, motivo });

  if (acao === "avaliar") return { ok: true, etapa: "fim" };
  if (enviada) return nega("a entrega já foi para os jurados");

  switch (acao) {
    case "ler":
      return { ok: true, etapa: i === 0 ? "analise" : etapa };
    case "planejar": {
      if (i < indice("analise")) return nega("leia o enunciado primeiro");
      if (String(ctx.plano || "").trim().length < BOOTCAMP.minimoDoPlano) return nega(`escreva o plano (pelo menos ${BOOTCAMP.minimoDoPlano} caracteres): os requisitos e como você vai resolver`);
      return { ok: true, etapa: etapa === "analise" ? "ambiente" : etapa };
    }
    case "ambiente": {
      if (i < indice("ambiente")) return nega("faça a análise e o planejamento primeiro");
      if (!["editor", "github"].includes(ctx.modo)) return nega("escolha como vai entregar: no editor da tela ou pelo GitHub");
      if (!chaveDaLinguagem(ctx.linguagem)) return nega("escolha uma linguagem que o Bootcamp roda");
      if (ctx.modo === "github" && !ctx.repoValido) return nega("cole o link de um repositório público do GitHub");
      return { ok: true, etapa: "codigo" };
    }
    case "testar":
      if (i < indice("codigo")) return nega("configure o ambiente primeiro");
      // a decisão do fluxograma: passou → fica em "testes", pronto para a revisão; não passou → volta ao código
      return { ok: true, etapa: ctx.passou ? "testes" : "codigo" };
    case "enviar":
      if (etapa !== "testes" || !ctx.passou) return nega("a entrega só vai para a revisão depois de passar nos testes");
      return { ok: true, etapa: "revisao" };
    default:
      return nega("ação desconhecida");
  }
}

// ------------------------------------------------------------------ configuração do torneio

const limpar = (t, max) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const ehUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));

/**
 * Confere o que veio da tela de criação. Devolve { ok, motivo, config }:
 *   config = { nome, formato, tempoMin, linguagens: { modo: "livre"|"jurados", permitidas: [] }, total,
 *              rodadasPontos, npcs: [ids escolhidos], convidados: [usuarioIds] }
 * Nas linguagens: "livre" = cada competidor escolhe a sua entre as permitidas; "jurados" = os jurados estipulam
 * uma das permitidas em cada desafio. Permitidas vazias = todas as que o Bootcamp roda.
 */
export function validarConfiguracao(bruto = {}) {
  const nome = limpar(bruto.nome, BOOTCAMP.limites.nome);
  if (nome.length < 2) return { ok: false, motivo: "dê um nome ao torneio" };
  const formato = BOOTCAMP.formatos.includes(bruto.formato) ? bruto.formato : null;
  if (!formato) return { ok: false, motivo: "escolha o formato: mata-mata ou pontos corridos" };

  const usarTempo = Boolean(bruto.usarTempo);
  const tempoMin = usarTempo ? Number(bruto.tempoMin) : null;
  if (usarTempo && !BOOTCAMP.tempos.includes(tempoMin)) return { ok: false, motivo: `escolha o tempo por desafio: ${BOOTCAMP.tempos.filter(Boolean).join(", ")} minutos` };

  const modo = bruto.linguagens?.modo === "jurados" ? "jurados" : "livre";
  const lista = Array.isArray(bruto.linguagens?.permitidas) ? bruto.linguagens.permitidas : [];
  const permitidas = [...new Set(lista.map(chaveDaLinguagem).filter(Boolean))];
  if (lista.length && !permitidas.length) return { ok: false, motivo: "nenhuma das linguagens escolhidas roda no Bootcamp" };

  const convidados = [...new Set((Array.isArray(bruto.convidados) ? bruto.convidados : []).filter(ehUuid))];
  const total = Number(bruto.total) || BOOTCAMP.maxParticipantes;
  if (!Number.isInteger(total) || total < BOOTCAMP.minParticipantes || total > BOOTCAMP.maxParticipantes) {
    return { ok: false, motivo: `o torneio tem de ${BOOTCAMP.minParticipantes} a ${BOOTCAMP.maxParticipantes} participantes` };
  }
  if (1 + convidados.length > total) return { ok: false, motivo: `com você e ${convidados.length} convidado(s), o torneio precisa de pelo menos ${1 + convidados.length} vagas` };

  const npcs = [...new Set((Array.isArray(bruto.npcs) ? bruto.npcs : []).filter((id) => npcPorId(id)))];
  if (npcs.length > total - 1 - convidados.length) return { ok: false, motivo: "personagens demais para as vagas que sobram" };

  const rodadasPontos = formato === "pontos-corridos" ? Number(bruto.rodadas) || 3 : null;
  if (formato === "pontos-corridos" && !BOOTCAMP.rodadasDosPontosCorridos.includes(rodadasPontos)) {
    return { ok: false, motivo: `nos pontos corridos, escolha de ${BOOTCAMP.rodadasDosPontosCorridos[0]} a ${BOOTCAMP.rodadasDosPontosCorridos.at(-1)} rodadas` };
  }
  return { ok: true, config: { nome, formato, tempoMin, linguagens: { modo, permitidas }, total, rodadasPontos, npcs, convidados } };
}

/** Quantas rodadas o torneio tem: no mata-mata, até sobrar um (com folga para número ímpar); nos pontos corridos, as escolhidas. */
export function totalDeRodadas(formato, participantes, rodadasPontos = 3) {
  if (formato === "mata-mata") return Math.max(1, Math.ceil(Math.log2(Math.max(2, participantes))));
  return rodadasPontos;
}

/** A dificuldade (1 a 3) sobe com as rodadas: a primeira é fácil e a última é a mais difícil. */
export function dificuldadeDaRodada(numero, total) {
  if (total <= 1) return 2;
  return Math.min(3, Math.max(1, 1 + Math.round(((numero - 1) * 2) / (total - 1))));
}

const embaralhar = (lista, s) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(s() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Os personagens que ainda cabem, sem repetir a skin de nenhum humano. */
export function npcsDisponiveis(skinsUsadas = []) {
  const usadas = new Set(skinsUsadas);
  return NPCS_DO_BOOTCAMP.filter((n) => !usadas.has(n.skin));
}

/**
 * Monta os participantes do torneio, cada um com skin única: os humanos ({ usuarioId, nome, personagem }, o
 * organizador primeiro) vestem o personagem que já usam no Proof (se outro humano já veste, ganham um da
 * reserva); os personagens escolhidos entram em seguida; as vagas que sobram são preenchidas por sorteio. As
 * baias (0–7) são sorteadas, e é a baia que desempata a primeira chave do mata-mata.
 */
export function montarParticipantes({ humanos, npcs = [], total, s }) {
  const usadas = new Set();
  const lista = [];
  for (const h of humanos.slice(0, BOOTCAMP.maxParticipantes)) {
    const quer = PERSONAGENS[h.personagem] && !PERSONAGENS[h.personagem].chefao ? h.personagem : "neuro";
    const skin = !usadas.has(quer) ? quer : SKINS_DE_RESERVA.find((k) => !usadas.has(k)) || quer;
    usadas.add(skin);
    lista.push({ id: `h:${h.usuarioId}`, tipo: "humano", usuarioId: h.usuarioId, nome: limpar(h.nome, 40) || "Estudante", skin, personalidade: "" });
  }
  const escolhidos = npcs.map(npcPorId).filter((n) => n && !usadas.has(n.skin));
  const sobra = embaralhar(NPCS_DO_BOOTCAMP.filter((n) => !escolhidos.includes(n)), s);
  for (const n of [...escolhidos, ...sobra]) {
    if (lista.length >= total) break;
    if (usadas.has(n.skin)) continue;
    usadas.add(n.skin);
    lista.push({ id: `n:${n.id}`, tipo: "npc", npcId: n.id, nome: n.nome, skin: n.skin, personalidade: n.personalidade, bordao: n.bordao });
  }
  const baias = embaralhar(lista.map((_, i) => i), s);
  return lista.map((p, i) => ({ ...p, baia: baias[i], eliminado: false, eliminadoNa: null, pontos: 0 }));
}

/** Nenhum competidor veste a skin de um jurado? (Os humanos podem: é a skin que já usam no Proof.) */
export const skinDeJurado = (skin) => SKINS_DOS_JURADOS.has(skin);

// ------------------------------------------------------------------ rodadas e confrontos

/** Os ativos na ordem de semente: mais pontos primeiro; empate, a baia menor. */
export function ordemDeSemente(participantes) {
  return participantes.filter((p) => !p.eliminado).sort((a, b) => (b.pontos - a.pontos) || (a.baia - b.baia));
}

/**
 * Os confrontos do mata-mata: o 1º contra o último, o 2º contra o penúltimo... Com número ímpar, o 1º passa
 * direto (folga: `b` = null), mas faz o desafio do mesmo jeito, pelos pontos.
 */
export function confrontosDaRodada(participantes) {
  const ordem = ordemDeSemente(participantes).map((p) => p.id);
  const pares = [];
  if (ordem.length % 2 === 1) pares.push({ a: ordem.shift(), b: null });
  while (ordem.length >= 2) pares.push({ a: ordem.shift(), b: ordem.pop() });
  return pares;
}

export function prazoDaRodada(abertaEm, tempoMin) {
  if (!tempoMin) return null;
  return new Date(new Date(abertaEm).getTime() + tempoMin * 60_000).toISOString();
}
export const prazoPassou = (prazo, agora = Date.now()) => Boolean(prazo) && new Date(prazo).getTime() < agora;

// ------------------------------------------------------------------ o desafio e os testes

/** A saída como os jurados comparam: sem \r, sem espaço no fim de cada linha e sem linhas vazias no fim. */
export function normalizarSaida(texto) {
  return String(texto ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}
export const conferirCaso = (esperada, obtida) => normalizarSaida(esperada) === normalizarSaida(obtida);

/** { total, passados, passou, fracao } de uma lista de resultados [{ ok }]. */
export function resumoDosTestes(resultados) {
  const lista = Array.isArray(resultados) ? resultados : [];
  const passados = lista.filter((r) => r?.ok).length;
  return { total: lista.length, passados, passou: lista.length > 0 && passados === lista.length, fracao: lista.length ? passados / lista.length : 0 };
}

/**
 * Confere o desafio que os jurados (a IA) mandaram. Devolve { ok, motivo, desafio } com:
 *   { titulo, enunciado, formatoEntrada, formatoSaida, requisitos[], linguagem (só no modo "jurados"),
 *     dificuldade, falas: { kernel, vetor, sintaxe }, testes: [{ entrada, saida, oculto }], solucao }
 * Os 2 primeiros testes são exemplos visíveis; os outros ficam ocultos (só o servidor vê).
 */
export function validarDesafio(bruto, { linguagens = { modo: "livre", permitidas: [] }, dificuldade = 1 } = {}) {
  const titulo = limpar(bruto?.titulo, 80);
  const enunciado = String(bruto?.enunciado ?? "").trim().slice(0, BOOTCAMP.limites.enunciado);
  if (titulo.length < 3) return { ok: false, motivo: "desafio sem título" };
  if (enunciado.length < 20) return { ok: false, motivo: "desafio sem enunciado" };

  const vistos = new Set();
  const testes = (Array.isArray(bruto?.testes) ? bruto.testes : [])
    .map((t) => ({ entrada: String(t?.entrada ?? "").replace(/\r\n?/g, "\n").slice(0, BOOTCAMP.limites.entrada), saida: normalizarSaida(t?.saida).slice(0, BOOTCAMP.limites.saida) }))
    .filter((t) => t.saida && !vistos.has(t.entrada) && vistos.add(t.entrada))
    .slice(0, BOOTCAMP.testes.max)
    .map((t, i) => ({ ...t, oculto: i >= BOOTCAMP.testes.visiveis }));
  if (testes.length < BOOTCAMP.testes.min) return { ok: false, motivo: `o desafio precisa de pelo menos ${BOOTCAMP.testes.min} testes` };

  let linguagem = null;
  if (linguagens.modo === "jurados") {
    const pedida = chaveDaLinguagem(bruto?.linguagem);
    const lista = linguagens.permitidas?.length ? linguagens.permitidas : ORDEM_DAS_LINGUAGENS;
    linguagem = lista.includes(pedida) ? pedida : lista[0];
  }
  const falas = Object.fromEntries(IDS_DOS_JURADOS.map((j) => [j, limpar(bruto?.falas?.[j], 220)]));
  return {
    ok: true,
    desafio: {
      titulo,
      enunciado,
      formatoEntrada: limpar(bruto?.formatoEntrada, 400),
      formatoSaida: limpar(bruto?.formatoSaida, 400),
      requisitos: (Array.isArray(bruto?.requisitos) ? bruto.requisitos : []).map((r) => limpar(r, 200)).filter(Boolean).slice(0, 6),
      linguagem,
      dificuldade: [1, 2, 3].includes(Number(bruto?.dificuldade)) ? Number(bruto.dificuldade) : dificuldade,
      falas,
      testes,
      solucao: bruto?.solucao ? { linguagem: chaveDaLinguagem(bruto.solucao.linguagem) || "python", codigo: String(bruto.solucao.codigo || "").slice(0, BOOTCAMP.limites.codigo) } : null,
      origem: bruto?.origem === "reserva" ? "reserva" : "jurados",
    },
  };
}

/** O desafio para a tela: os testes ocultos sem a entrada nem a resposta, e sem a solução de referência. */
export function desafioParaTela(d) {
  if (!d) return null;
  return {
    titulo: d.titulo, enunciado: d.enunciado, formatoEntrada: d.formatoEntrada, formatoSaida: d.formatoSaida,
    requisitos: d.requisitos || [], linguagem: d.linguagem || null, dificuldade: d.dificuldade, falas: d.falas || {}, origem: d.origem,
    exemplos: (d.testes || []).filter((t) => !t.oculto).map((t) => ({ entrada: t.entrada, saida: t.saida })),
    ocultos: (d.testes || []).filter((t) => t.oculto).length,
  };
}

/** O resultado dos testes para a tela: os ocultos dizem só se passaram. */
export function testesParaTela(resultados) {
  return (Array.isArray(resultados) ? resultados : []).map((r, i) => (r.oculto
    ? { n: i + 1, oculto: true, ok: Boolean(r.ok) }
    : { n: i + 1, oculto: false, ok: Boolean(r.ok), entrada: r.entrada, esperada: r.esperada, obtida: r.obtida, erro: r.erro || "" }));
}

// Os desafios de reserva: valem quando a IA dos jurados não responde. Cada um traz a solução em JavaScript
// (`resolver`), que o dominio-check roda contra os próprios testes: um gabarito errado não chega à tela.
export const DESAFIOS_DE_RESERVA = [
  {
    id: "soma-dos-pares", dificuldade: 1, titulo: "A soma dos pares",
    enunciado: "Leia um número N e, na linha seguinte, N números inteiros separados por espaço. Imprima a soma dos números pares.",
    formatoEntrada: "1ª linha: N. 2ª linha: N inteiros.", formatoSaida: "Um inteiro: a soma dos pares.",
    requisitos: ["Números negativos também podem ser pares.", "Se não houver pares, imprima 0."],
    testes: [["5\n1 2 3 4 5\n", "6"], ["3\n10 20 30\n", "60"], ["4\n1 3 5 7\n", "0"], ["6\n-2 -4 3 8 0 11\n", "2"], ["1\n100\n", "100"]],
    resolver: (e) => String(e.trim().split("\n")[1].trim().split(/\s+/).map(Number).filter((n) => n % 2 === 0).reduce((a, b) => a + b, 0)),
  },
  {
    id: "palindromo", dificuldade: 1, titulo: "Palíndromo ou não?",
    enunciado: "Leia uma palavra formada só por letras minúsculas. Imprima SIM se ela é um palíndromo (igual de trás para frente) e NAO caso contrário.",
    formatoEntrada: "Uma linha com a palavra.", formatoSaida: "SIM ou NAO.",
    requisitos: ["A resposta é em maiúsculas e sem acento."],
    testes: [["arara\n", "SIM"], ["proof\n", "NAO"], ["a\n", "SIM"], ["abba\n", "SIM"], ["abca\n", "NAO"]],
    resolver: (e) => { const p = e.trim(); return p === [...p].reverse().join("") ? "SIM" : "NAO"; },
  },
  {
    id: "fizzbuzz", dificuldade: 1, titulo: "FizzBuzz do escritório",
    enunciado: "Leia N. Para cada i de 1 até N, imprima uma linha: FizzBuzz se i é múltiplo de 3 e de 5, Fizz se é só de 3, Buzz se é só de 5, ou o próprio i.",
    formatoEntrada: "Um inteiro N (1 ≤ N ≤ 100).", formatoSaida: "N linhas.",
    requisitos: ["Uma resposta por linha, na ordem."],
    testes: [["5\n", "1\n2\nFizz\n4\nBuzz"], ["15\n", "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz"], ["1\n", "1"], ["3\n", "1\n2\nFizz"]],
    resolver: (e) => Array.from({ length: Number(e.trim()) }, (_, k) => { const i = k + 1; return i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i); }).join("\n"),
  },
  {
    id: "contar-vogais", dificuldade: 1, titulo: "Caçando vogais",
    enunciado: "Leia uma linha de texto com letras minúsculas sem acento e espaços. Imprima quantas vogais (a, e, i, o, u) ela tem.",
    formatoEntrada: "Uma linha de texto.", formatoSaida: "Um inteiro.",
    requisitos: ["O y não conta como vogal."],
    testes: [["proof beyond\n", "4"], ["aeiou\n", "5"], ["xyz\n", "0"], ["lisa joga bootcamp\n", "7"]],
    resolver: (e) => String((e.match(/[aeiou]/g) || []).length),
  },
  {
    id: "maior-sequencia", dificuldade: 2, titulo: "A maior subida",
    enunciado: "Leia N e, na linha seguinte, N inteiros. Imprima o tamanho da maior sequência de números seguidos em que cada um é maior que o anterior.",
    formatoEntrada: "1ª linha: N. 2ª linha: N inteiros.", formatoSaida: "Um inteiro.",
    requisitos: ["Um número sozinho já é uma sequência de tamanho 1.", "Números iguais quebram a subida."],
    testes: [["6\n1 2 3 1 2 1\n", "3"], ["5\n5 4 3 2 1\n", "1"], ["5\n1 2 3 4 5\n", "5"], ["7\n3 4 1 2 3 4 0\n", "4"], ["1\n42\n", "1"], ["4\n2 2 2 2\n", "1"]],
    resolver: (e) => { const v = e.trim().split("\n")[1].trim().split(/\s+/).map(Number); let m = 1, c = 1; for (let i = 1; i < v.length; i++) { c = v[i] > v[i - 1] ? c + 1 : 1; m = Math.max(m, c); } return String(m); },
  },
  {
    id: "inverter-palavras", dificuldade: 2, titulo: "De trás para frente",
    enunciado: "Leia uma linha com palavras separadas por um espaço. Imprima as mesmas palavras na ordem inversa, separadas por um espaço.",
    formatoEntrada: "Uma linha.", formatoSaida: "Uma linha.",
    requisitos: ["Inverta a ordem das palavras, não as letras."],
    testes: [["ola mundo\n", "mundo ola"], ["a b c d\n", "d c b a"], ["bootcamp\n", "bootcamp"], ["lisa joga proof beyond\n", "beyond proof joga lisa"]],
    resolver: (e) => e.trim().split(/\s+/).reverse().join(" "),
  },
  {
    id: "anagramas", dificuldade: 2, titulo: "Anagrama secreto",
    enunciado: "Leia duas palavras em minúsculas, uma por linha. Imprima SIM se uma é anagrama da outra (as mesmas letras, nas mesmas quantidades) e NAO caso contrário.",
    formatoEntrada: "Duas linhas, uma palavra em cada.", formatoSaida: "SIM ou NAO.",
    requisitos: ["As quantidades de cada letra precisam bater."],
    testes: [["amor\nroma\n", "SIM"], ["lisa\nsala\n", "NAO"], ["abc\ncba\n", "SIM"], ["aab\nabb\n", "NAO"], ["proof\nfoorp\n", "SIM"]],
    resolver: (e) => { const [a, b] = e.trim().split("\n").map((p) => [...p.trim()].sort().join("")); return a === b ? "SIM" : "NAO"; },
  },
  {
    id: "cifra-de-cesar", dificuldade: 2, titulo: "A cifra do jurado",
    enunciado: "Leia K na primeira linha e, na segunda, um texto em minúsculas sem acento. Desloque cada letra K posições para a frente no alfabeto (depois do z volta para o a) e mantenha os espaços. Imprima o texto cifrado.",
    formatoEntrada: "1ª linha: K (0 ≤ K ≤ 25). 2ª linha: o texto.", formatoSaida: "Uma linha.",
    requisitos: ["Espaços ficam onde estão."],
    testes: [["3\nabc xyz\n", "def abc"], ["1\nlisa\n", "mjtb"], ["13\nproof\n", "cebbs"], ["0\nbeyond\n", "beyond"], ["25\nb a\n", "a z"]],
    resolver: (e) => { const [k, t] = e.replace(/\n$/, "").split("\n"); return [...t].map((c) => (c === " " ? c : String.fromCharCode(((c.charCodeAt(0) - 97 + Number(k)) % 26) + 97))).join(""); },
  },
  {
    id: "parenteses", dificuldade: 3, titulo: "Chaves, colchetes e parênteses",
    enunciado: "Leia uma linha formada só pelos caracteres ( ) [ ] { }. Imprima VALIDO se cada um que abre fecha na ordem certa e INVALIDO caso contrário.",
    formatoEntrada: "Uma linha (1 a 1000 caracteres).", formatoSaida: "VALIDO ou INVALIDO.",
    requisitos: ["Pense numa pilha.", "Sobrou algum aberto no fim? É INVALIDO."],
    testes: [["([]{})\n", "VALIDO"], ["([)]\n", "INVALIDO"], ["((\n", "INVALIDO"], ["{[()()]}\n", "VALIDO"], ["}\n", "INVALIDO"]],
    resolver: (e) => { const par = { ")": "(", "]": "[", "}": "{" }; const p = []; for (const c of e.trim()) { if ("([{".includes(c)) p.push(c); else if (p.pop() !== par[c]) return "INVALIDO"; } return p.length ? "INVALIDO" : "VALIDO"; },
  },
  {
    id: "primos-ate-n", dificuldade: 3, titulo: "Quantos primos?",
    enunciado: "Leia N. Imprima quantos números primos existem de 1 até N. Os testes ocultos usam N grande: uma solução lenta demais não termina a tempo.",
    formatoEntrada: "Um inteiro N (2 ≤ N ≤ 100000).", formatoSaida: "Um inteiro.",
    requisitos: ["1 não é primo.", "Pense no crivo de Eratóstenes."],
    testes: [["10\n", "4"], ["2\n", "1"], ["100\n", "25"], ["1000\n", "168"], ["100000\n", "9592"]],
    resolver: (e) => { const n = Number(e.trim()); const c = new Uint8Array(n + 1); let t = 0; for (let i = 2; i <= n; i++) { if (!c[i]) { t++; for (let j = i * i; j <= n; j += i) c[j] = 1; } } return String(t); },
  },
];

/** Um desafio de reserva da dificuldade (ou perto dela), sem repetir os já usados no torneio. */
export function desafioDeReserva({ dificuldade = 1, usados = [], linguagens, s = Math.random } = {}) {
  const livres = DESAFIOS_DE_RESERVA.filter((d) => !usados.includes(d.titulo));
  const base = livres.length ? livres : DESAFIOS_DE_RESERVA;
  const daDificuldade = base.filter((d) => d.dificuldade === dificuldade);
  const lista = daDificuldade.length ? daDificuldade : base;
  const d = lista[Math.floor(s() * lista.length)];
  const permitidas = linguagens?.permitidas?.length ? linguagens.permitidas : ORDEM_DAS_LINGUAGENS;
  return validarDesafio({
    ...d,
    origem: "reserva",
    linguagem: permitidas[Math.floor(s() * permitidas.length)],
    testes: d.testes.map(([entrada, saida]) => ({ entrada, saida })),
    falas: {
      kernel: "Desafio clássico, mas os testes ocultos não perdoam.",
      vetor: "Quero ver um código que eu consiga ler sem esforço.",
      sintaxe: "Leiam o formato da saída com atenção: um espaço a mais já é erro.",
    },
  }, { linguagens, dificuldade: d.dificuldade }).desafio;
}

// ------------------------------------------------------------------ os personagens jogando

const arred = (n) => Math.round(n * 10) / 10;
const entre = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Como um personagem da Lisa se sai no desafio: quantos testes passam (a chance cai com a dificuldade e é um
 * pouco menor nos ocultos) e quantos minutos ele leva. Com tempo-limite, quem estoura entrega pela metade.
 * `s`: o sorteio da rodada para esse personagem (sempre o mesmo para a mesma rodada).
 */
export function simularNpc({ npc, dificuldade = 1, testes = [], tempoMin = null, s }) {
  const base = entre(npc.habilidade - 0.12 * (dificuldade - 1), 0.3, 0.97);
  const ok = testes.map((t) => s() < (t.oculto ? base - 0.06 : base + 0.04));
  let minutos = Math.round((10 + 7 * dificuldade) * npc.ritmo * (0.75 + s() * 0.5));
  let estourou = false;
  if (tempoMin && minutos > tempoMin) {
    estourou = true;
    minutos = tempoMin;
    for (let i = ok.length - 1, cortar = Math.ceil(ok.filter(Boolean).length / 2); i >= 0 && cortar > 0; i--) if (ok[i]) { ok[i] = false; cortar--; }
  }
  const passados = ok.filter(Boolean).length;
  return { passados, total: testes.length, passou: testes.length > 0 && passados === testes.length, minutos, estourou, sorteio: s() };
}

/** Em que etapa do fluxo o personagem está, pelo tempo que passou desde a abertura da rodada. */
export function etapaDoNpc(sim, minutosPassados) {
  const f = sim.minutos ? minutosPassados / sim.minutos : 1;
  if (f >= 1) return "revisao";
  if (f < 0.1) return "leitura";
  if (f < 0.22) return "analise";
  if (f < 0.32) return "ambiente";
  if (f < 0.78) return "codigo";
  return "testes";
}

// ------------------------------------------------------------------ as notas dos jurados

/** O teto do Jurado Kernel pela fração de testes que passaram: nenhum teste certo, no máximo 3. */
export const tetoDoKernel = (fracao) => arred(3 + 7 * entre(fracao, 0, 1));

/** A nota da rodada (0–100): a média das 3 notas dos jurados, vezes 10. */
export function notaDaRodada(notas) {
  const v = IDS_DOS_JURADOS.map((j) => entre(Number(notas?.[j]) || 0, 0, 10));
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10);
}

/** As notas de um personagem: saem da simulação, com a personalidade dele puxando a Jurada Vetor. */
export function notasDoNpc(npc, sim) {
  const f = sim.total ? sim.passados / sim.total : 0;
  const ruido = (sim.sorteio ?? 0.5) - 0.5;
  return {
    kernel: arred(entre((2 + 8 * f) * (0.9 + 0.1 * npc.habilidade) + ruido, 0, tetoDoKernel(f))),
    vetor: arred(entre(4 + 5 * npc.habilidade + ruido * 2 - (npc.ritmo < 0.75 ? 1 : 0), 0, 10)),
    sintaxe: arred(entre(4.5 + 4.5 * f + ruido - (sim.estourou ? 1.5 : 0), 0, 10)),
  };
}

/**
 * A avaliação sem a IA (ou para quem a IA deixou de fora): pelos testes, pelo plano e pela regra da linguagem.
 * `entrega`: { enviou, fracao, plano, linguagemOk, testou }.
 */
export function avaliacaoAutomatica({ enviou = false, testou = false, fracao = 0, plano = "", linguagemOk = true }) {
  if (!testou) {
    const vazio = "Sem entrega nesta rodada.";
    return { notas: { kernel: 0, vetor: 0, sintaxe: 0 }, feedback: { kernel: vazio, vetor: vazio, sintaxe: vazio } };
  }
  const temPlano = String(plano || "").trim().length >= BOOTCAMP.minimoDoPlano;
  // tudo certo, com plano e enviado a tempo, dá 97: um humano perfeito não perde para a simulação dos personagens
  const notas = {
    kernel: tetoDoKernel(fracao),
    vetor: arred((temPlano ? 7 : 4.5) + 2 * fracao),
    sintaxe: arred(entre((enviou ? 6 : 3.5) + 4 * fracao - (linguagemOk ? 0 : 3), 0, 10)),
  };
  const pct = Math.round(fracao * 100);
  return {
    notas,
    feedback: {
      kernel: pct === 100 ? "Passou em todos os testes, inclusive os ocultos." : `Passou em ${pct}% dos testes: falta cobrir os casos que quebraram.`,
      vetor: temPlano ? "O planejamento ajudou: dá para ver a ideia antes do código." : "Faltou um plano: comece pelos requisitos antes de codar.",
      sintaxe: !linguagemOk ? "A linguagem não foi a que os jurados estipularam." : enviou ? "Entrega dentro das regras da rodada." : "A entrega não foi enviada para a revisão a tempo.",
    },
  };
}

/**
 * Confere a avaliação que a IA mandou para os humanos. `apelidos`: Map apelido ("p1") → { id, fracao, testou }.
 * Nota fora de 0–10 é cortada e o Kernel respeita o teto dos testes; quem a IA esqueceu fica de fora (a
 * avaliação automática cobre). Devolve Map id → { notas, feedback }.
 */
export function validarAvaliacao(bruto, apelidos) {
  const saida = new Map();
  for (const a of Array.isArray(bruto?.avaliacoes) ? bruto.avaliacoes : []) {
    const alvo = apelidos.get(String(a?.participante || "").trim());
    if (!alvo || saida.has(alvo.id) || !alvo.testou) continue;
    const nota = (v) => arred(entre(Number(v) || 0, 0, 10));
    saida.set(alvo.id, {
      notas: { kernel: Math.min(nota(a.notaKernel), tetoDoKernel(alvo.fracao)), vetor: nota(a.notaVetor), sintaxe: nota(a.notaSintaxe) },
      feedback: { kernel: limpar(a.feedbackKernel, 400), vetor: limpar(a.feedbackVetor, 400), sintaxe: limpar(a.feedbackSintaxe, 400) },
    });
  }
  return saida;
}

// ------------------------------------------------------------------ o resultado da rodada

/**
 * Aplica as notas da rodada. `notas`: Map id → { nota (0–100), kernel }. Devolve
 *   { participantes, eliminados: [ids], avancaram: [ids], campeao: id|null, encerrado }
 * Mata-mata: em cada confronto, quem tem a nota maior segue (empate: o Kernel; depois, a semente). Pontos
 * corridos: a nota soma; na última rodada, quem tem mais pontos é o campeão. Nos dois formatos a nota soma nos
 * pontos (é o que desempata a semente da rodada seguinte).
 */
export function aplicarResultado({ formato, participantes, confrontos = [], notas, numero, total }) {
  const nota = (id) => notas.get(id)?.nota ?? 0;
  const kernel = (id) => notas.get(id)?.kernel ?? 0;
  const lista = participantes.map((p) => (p.eliminado ? { ...p } : { ...p, pontos: p.pontos + nota(p.id) }));
  const eliminados = [];
  const avancaram = [];

  if (formato === "mata-mata") {
    for (const { a, b } of confrontos) {
      if (!b) { avancaram.push(a); continue; }
      const venceA = nota(a) !== nota(b) ? nota(a) > nota(b) : kernel(a) !== kernel(b) ? kernel(a) > kernel(b) : true;
      avancaram.push(venceA ? a : b);
      eliminados.push(venceA ? b : a);
    }
    for (const p of lista) if (eliminados.includes(p.id)) { p.eliminado = true; p.eliminadoNa = numero; }
    const vivos = lista.filter((p) => !p.eliminado);
    const encerrado = vivos.length <= 1 || numero >= total;
    const campeao = encerrado ? (ordemDeSemente(lista)[0]?.id || null) : null;
    return { participantes: lista, eliminados, avancaram, campeao, encerrado };
  }

  for (const p of lista) if (!p.eliminado) avancaram.push(p.id);
  const encerrado = numero >= total;
  return { participantes: lista, eliminados, avancaram, campeao: encerrado ? (ordemDeSemente(lista)[0]?.id || null) : null, encerrado };
}

/** A classificação: os ativos por pontos; depois, os eliminados (quem saiu por último primeiro). */
export function classificacao(participantes) {
  return [...participantes].sort((a, b) =>
    (Number(a.eliminado) - Number(b.eliminado))
    || ((b.eliminadoNa || 0) - (a.eliminadoNa || 0))
    || (b.pontos - a.pontos)
    || (a.baia - b.baia));
}

/** Quem pode chamar os jurados: o organizador sempre (encerra a rodada); os outros, quando todos enviaram ou o tempo acabou. */
export function podeChamarJurados({ souDono, todosEnviaram, tempoAcabou }) {
  if (souDono || todosEnviaram || tempoAcabou) return { ok: true };
  return { ok: false, motivo: "os jurados entram quando todos os humanos enviarem, quando o tempo acabar ou quando o organizador encerrar a rodada" };
}
