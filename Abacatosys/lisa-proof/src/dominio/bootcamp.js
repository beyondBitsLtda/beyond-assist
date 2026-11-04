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
  formatos: ["temporada", "mata-mata", "pontos-corridos"],
  // na temporada: quantos saem em cada episódio (1 = temporada completa; 2 = temporada rápida)
  eliminadosPorEpisodio: [1, 2],
  // a prova em equipe do meio da temporada: times sorteados, o vencedor da última prova escolhe um membro, ou sem equipe
  provasDeEquipe: ["sorteio", "capitao", "nao"],
  // minutos por desafio; null = sem limite de tempo (o tempo é opcional na criação do torneio)
  tempos: [null, 15, 30, 45, 60, 90],
  rodadasDosPontosCorridos: [2, 3, 4, 5],
  testes: { min: 3, max: 6, visiveis: 2 },
  limites: { nome: 60, plano: 2000, codigo: 20_000, caminho: 200, entrada: 2000, saida: 4000, enunciado: 2500 },
  minimoDoPlano: 15,
};

export const FORMATOS = {
  temporada: {
    nome: "Temporada (reality)",
    descricao: "Como num reality de cozinha: cada episódio tem uma prova que salva metade (ou uma prova em equipe) e uma prova de eliminação para quem não se salvou; os dois últimos disputam a grande final.",
  },
  "mata-mata": { nome: "Mata-mata", descricao: "Modo rápido: confronto direto a cada rodada, e quem tirar a nota menor no par sai do torneio." },
  "pontos-corridos": { nome: "Pontos corridos", descricao: "Modo rápido: todo mundo faz todas as rodadas; a nota de cada uma soma, e quem tiver mais no fim leva." },
};

// ------------------------------------------------------------------ as provas da temporada
export const TIPOS_DE_PROVA = {
  imunidade: { nome: "Prova de Imunidade", emoji: "🛡️", descricao: "Não elimina ninguém: a metade com as melhores notas fica salva da prova de eliminação." },
  equipe: { nome: "Prova em Equipe", emoji: "🤝", descricao: "Dois times: a nota do time é a média dos integrantes, e o time vencedor fica salvo da prova de eliminação." },
  eliminacao: { nome: "Prova de Eliminação", emoji: "🔥", descricao: "Só quem não se salvou joga, e quem tirar a menor nota deixa o escritório." },
  final: { nome: "Grande Final", emoji: "🏆", descricao: "Os dois últimos numa arena especial, com todos os outros competidores na arquibancada. Quem vencer é o campeão." },
  rodada: { nome: "Rodada", emoji: "⚔️", descricao: "Todos os competidores ainda na disputa." },
};

// Toda prova tem um vencedor, e ele ganha uma insígnia (no mata-mata e nos pontos corridos, a de "melhor da rodada")
export const INSIGNIAS = {
  imunidade: { nome: "Imunidade", emoji: "🛡️", descricao: "Venceu a prova que salva metade." },
  equipe: { nome: "Trabalho em equipe", emoji: "🤝", descricao: "Estava no time que venceu a prova em equipe." },
  eliminacao: { nome: "Volta por cima", emoji: "🔥", descricao: "Foi o melhor na prova de eliminação." },
  final: { nome: "Campeão do Bootcamp", emoji: "🏆", descricao: "Venceu a grande final." },
  rodada: { nome: "Melhor da rodada", emoji: "⭐", descricao: "Teve a maior nota da rodada." },
};

export const EQUIPES = [
  { id: "azul", nome: "Time Azul", cor: "#2563EB", emoji: "🔵" },
  { id: "laranja", nome: "Time Laranja", cor: "#EA580C", emoji: "🟠" },
];

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
// Personagens originais, inspirados nos ARQUÉTIPOS de uma bancada de reality de cozinha (o francês ranzinza, a
// perfeccionista implacável e o durão tatuado), nunca em pessoas reais: nem nome, nem rosto, nem bordão de
// ninguém. Cada um avalia um critério e tem o seu desenho (src/componentes/bootcamp/Jurados.js). As falas de
// reserva valem quando a IA não responde; o deboche é sempre sobre o código, nunca sobre a pessoa.
export const JURADOS = [
  {
    id: "kernel", nome: "Chef Kernel", emoji: "🥖", arquetipo: "o francês ranzinza",
    criterio: "Desempenho técnico", foco: "se a solução está correta, passa nos testes (inclusive os ocultos) e é eficiente",
    estilo: "dramático e ranzinza, com expressões em francês; sofre em voz alta com laço dentro de laço e trata memória desperdiçada como manteiga jogada fora",
    elogios: [
      "Oh là là! Linear, limpo e rápido. Isso é alta gastronomia computacional.",
      "Passou nos testes ocultos sem suar. Je suis impressionné, e eu nunca fico impressionado.",
      "Isso roda mais rápido que garçom fugindo de cliente chato. Magnifique!",
      "Nenhum byte desperdiçado. Finalmente alguém que respeita a manteiga.",
    ],
    broncas: [
      "Mon Dieu! Laço dentro de laço: é um suflê que murchou antes de sair do forno.",
      "Isso não é código, é um croissant amassado no fundo da mochila.",
      "Você alocou memória como quem joga manteiga no lixo. Eu sinto dor física.",
      "O teste oculto estourou o tempo. O forno apitou e o prato não estava pronto, chéri.",
      "Esse if aninhado tem mais andares que a Torre Eiffel. Desce daí!",
    ],
  },
  {
    id: "vetor", nome: "Chef Vetor", emoji: "🔪", arquetipo: "a perfeccionista implacável",
    criterio: "Arquitetura", foco: "a organização do código, os nomes, a legibilidade e o planejamento feito antes de codar",
    estilo: "elegante, fala baixo e corta fundo; ama função pequena e nome claro, e não perdoa gambiarra disfarçada",
    elogios: [
      "Nomes claros, funções pequenas, nada sobrando. É assim que se empratar código.",
      "Dá para ler isso tomando um café, sem esforço nenhum. Elegante.",
      "O planejamento aparece no código. Isso é raro, e eu valorizo.",
      "Cada coisa no seu lugar. Até o meu armário de facas tem inveja.",
    ],
    broncas: [
      "Uma variável chamada x2_final_agora_vai. Eu preciso de um minuto.",
      "Uma função fazendo tudo ao mesmo tempo. Isso não é arquitetura, é a gaveta da bagunça.",
      "O plano dizia uma coisa e o código fez outra. Você leu o próprio plano?",
      "Bonito por fora, um labirinto por dentro. Parece apartamento decorado.",
      "Copiou e colou o mesmo bloco três vezes. Repetição não é tempero.",
    ],
  },
  {
    id: "sintaxe", nome: "Chef Sintaxe", emoji: "🤘", arquetipo: "o durão tatuado",
    criterio: "Conformidade com as regras", foco: "se a entrega segue o enunciado, os requisitos, a linguagem estipulada e o formato da saída",
    estilo: "durão de poucas palavras e muito sarcasmo; regra é regra, e detalhe é o que separa amador de profissional",
    elogios: [
      "Seguiu o enunciado à risca. Sem firula. Respeito.",
      "Formato da saída perfeito. Nada para reclamar, e eu adoro reclamar.",
      "Entregou no prazo e do jeito pedido. Isso é profissional.",
    ],
    broncas: [
      "Pediram SIM. Você imprimiu 'Sim'. Volta para o fim da fila.",
      "Espaço sobrando no fim da linha. Detalhe? Detalhe é o que separa amador de profissional.",
      "Leu o enunciado ou só olhou as figuras?",
      "No meu restaurante, prato atrasado vai direto para o lixo.",
      "A regra estava escrita. Em português. Com letra grande.",
    ],
  },
];
export const IDS_DOS_JURADOS = JURADOS.map((j) => j.id);
export const juradoPorId = (id) => JURADOS.find((j) => j.id === id) || null;

// ------------------------------------------------------------------ o nível do torneio contra a CPU
// Muda os personagens da Lisa (habilidade e ritmo) e a faixa de dificuldade dos desafios (da 1ª à última rodada).
export const NIVEIS_DO_TORNEIO = {
  facil: { nome: "Fácil", emoji: "🌱", descricao: "Personagens mais tranquilos e desafios leves.", habilidade: -0.15, ritmo: 1.25, dificuldade: [1, 2] },
  medio: { nome: "Médio", emoji: "⚡", descricao: "Personagens no ritmo normal; os desafios vão do fácil ao difícil.", habilidade: 0, ritmo: 1, dificuldade: [1, 3] },
  dificil: { nome: "Difícil", emoji: "🔥", descricao: "Personagens afiados e desafios que já começam no médio.", habilidade: 0.08, ritmo: 0.85, dificuldade: [2, 3] },
  lendario: { nome: "Lendário", emoji: "👑", descricao: "Os personagens quase não erram, e todo desafio é difícil.", habilidade: 0.14, ritmo: 0.7, dificuldade: [3, 3] },
};
export const ORDEM_DOS_NIVEIS = ["facil", "medio", "dificil", "lendario"];
export const nivelValido = (nivel) => (NIVEIS_DO_TORNEIO[nivel] ? nivel : "medio");

/** O personagem no nível do torneio: mais (ou menos) habilidoso e mais (ou menos) rápido. */
export function npcNoNivel(npc, nivel = "medio") {
  const n = NIVEIS_DO_TORNEIO[nivelValido(nivel)];
  return { ...npc, habilidade: Math.min(0.97, Math.max(0.3, npc.habilidade + n.habilidade)), ritmo: npc.ritmo * n.ritmo };
}

// ------------------------------------------------------------------ os cenários do escritório em 3D
export const CENARIOS = {
  neon: { nome: "Escritório Neon", emoji: "💚", descricao: "O estúdio escuro com faixas de neon lima." },
  datacenter: { nome: "Data Center", emoji: "🗄️", descricao: "Corredores de servidores piscando sob luz azul fria." },
  orbital: { nome: "Estação Orbital", emoji: "🛰️", descricao: "Um laboratório em órbita, com a Terra e as estrelas nas janelas." },
  loft: { nome: "Loft da Startup", emoji: "🌇", descricao: "Tijolinho, madeira, plantas e o pôr do sol da cidade no janelão." },
  cyber: { nome: "Cidade Cyberpunk", emoji: "🌃", descricao: "Noite de chuva, letreiros magenta e ciano e o chão molhado." },
};
export const ORDEM_DOS_CENARIOS = ["neon", "datacenter", "orbital", "loft", "cyber"];
export const cenarioValido = (cenario) => (CENARIOS[cenario] ? cenario : "neon");

// ------------------------------------------------------------------ os personagens da Lisa
// As áreas dos desafios (cada desafio tem uma) e as especialidades dos personagens: quando o desafio é da área de
// um personagem, ele joga melhor.
export const ESPECIALIDADES = {
  algoritmos: { nome: "Algoritmos", emoji: "🧮" },
  strings: { nome: "Textos e strings", emoji: "🔤" },
  matematica: { nome: "Matemática", emoji: "➗" },
  estruturas: { nome: "Estruturas de dados", emoji: "🧱" },
  logica: { nome: "Lógica", emoji: "🧠" },
  performance: { nome: "Performance", emoji: "⚡" },
  regex: { nome: "Expressões regulares", emoji: "🔍" },
  testes: { nome: "Testes e casos de borda", emoji: "🧪" },
};
// as áreas que um desafio pode ter (regex e testes são especialidades que ajudam em qualquer área: ver afinidade)
export const AREAS_DOS_DESAFIOS = ["algoritmos", "strings", "matematica", "estruturas", "logica", "performance"];
export const STATUS = {
  logica: "Lógica", velocidade: "Velocidade", testes: "Testes", arquitetura: "Arquitetura", criatividade: "Criatividade",
};
export const ORDEM_DOS_STATUS = Object.keys(STATUS);

// Os competidores controlados pelo modelo da Lisa: skin, nome, personalidade, status (1 a 10) e duas
// especialidades. `habilidade` (0–1) é a chance de cada teste passar num desafio fácil; `ritmo` multiplica o
// tempo que levam (menor = mais rápido), e acompanha a velocidade.
export const NPCS_DO_BOOTCAMP = [
  { id: "lisa", nome: "Lisa", skin: "lisa", habilidade: 0.84, ritmo: 1.0, personalidade: "A tutora do Proof jogando de igual para igual: calma e metódica, planeja antes de escrever uma linha.", bordao: "Primeiro eu entendo o problema; depois eu codo.",
    status: { logica: 8, velocidade: 6, testes: 8, arquitetura: 9, criatividade: 6 }, especialidades: ["algoritmos", "estruturas"] },
  { id: "byte-ninja", nome: "Byte Ninja", skin: "ninja", habilidade: 0.74, ritmo: 0.7, personalidade: "Silencioso e rapidíssimo; entrega soluções curtas, às vezes curtas demais.", bordao: "Menos linhas, menos bugs.",
    status: { logica: 7, velocidade: 10, testes: 4, arquitetura: 5, criatividade: 7 }, especialidades: ["strings", "performance"] },
  { id: "capita-stack", nome: "Capitã Stack", skin: "pirata", habilidade: 0.79, ritmo: 1.15, personalidade: "Caçadora de bugs: testa cada caso de borda antes de entregar.", bordao: "Bug à vista! Todos aos testes!",
    status: { logica: 7, velocidade: 4, testes: 10, arquitetura: 6, criatividade: 5 }, especialidades: ["testes", "logica"] },
  { id: "raposa-regex", nome: "Raposa Regex", skin: "raposao", habilidade: 0.71, ritmo: 0.9, personalidade: "Astuta e criativa; resolve tudo com expressão regular, mesmo quando não devia.", bordao: "Isso aí cabe numa regex.",
    status: { logica: 6, velocidade: 7, testes: 5, arquitetura: 5, criatividade: 10 }, especialidades: ["regex", "strings"] },
  { id: "cogu-commit", nome: "Cogu Commit", skin: "cogumelo", habilidade: 0.67, ritmo: 1.25, personalidade: "Tranquilo e organizado: commits pequenos, mensagens caprichadas e nenhuma pressa.", bordao: "Um commit de cada vez.",
    status: { logica: 6, velocidade: 3, testes: 7, arquitetura: 9, criatividade: 5 }, especialidades: ["estruturas", "logica"] },
  { id: "mergulho-profundo", nome: "Mergulho Profundo", skin: "mergulhador", habilidade: 0.81, ritmo: 1.35, personalidade: "Analisa o problema a fundo; demora para começar, mas raramente erra.", bordao: "Antes de nadar, eu olho o fundo.",
    status: { logica: 9, velocidade: 3, testes: 8, arquitetura: 8, criatividade: 6 }, especialidades: ["algoritmos", "matematica"] },
  { id: "yeti-legado", nome: "Yeti Legado", skin: "yeti", habilidade: 0.69, ritmo: 1.1, personalidade: "Veterano de sistemas antigos: conservador, prefere o laço for clássico a qualquer novidade.", bordao: "Funciona desde 1998, não mexe.",
    status: { logica: 7, velocidade: 5, testes: 6, arquitetura: 6, criatividade: 3 }, especialidades: ["matematica", "logica"] },
  { id: "magma-hotfix", nome: "Magma Hotfix", skin: "magma", habilidade: 0.6, ritmo: 0.6, personalidade: "Impulsivo e explosivo: entrega primeiro e conserta depois.", bordao: "Sobe pra produção que eu arrumo lá!",
    status: { logica: 5, velocidade: 10, testes: 2, arquitetura: 3, criatividade: 8 }, especialidades: ["performance", "strings"] },
  { id: "zorg-compilador", nome: "Zorg Compilador", skin: "alienigena", habilidade: 0.77, ritmo: 1.0, personalidade: "Veio de outro planeta otimizar o seu código; fala de complexidade o tempo todo.", bordao: "O(n²)? No meu planeta isso é crime.",
    status: { logica: 8, velocidade: 6, testes: 6, arquitetura: 7, criatividade: 7 }, especialidades: ["performance", "matematica"] },
  { id: "abacatinho-agil", nome: "Abacatinho Ágil", skin: "abacato", habilidade: 0.65, ritmo: 0.95, personalidade: "Fã de metodologias ágeis: quebra tudo em tarefinhas e comemora cada uma.", bordao: "Mais uma tarefa pro Concluído!",
    status: { logica: 6, velocidade: 7, testes: 6, arquitetura: 7, criatividade: 6 }, especialidades: ["estruturas", "testes"] },
];
export const npcPorId = (id) => NPCS_DO_BOOTCAMP.find((n) => n.id === id) || null;

/** O quanto o personagem domina a área do desafio: 1 se é especialidade dele, 0,5 se é vizinha (regex e textos), 0 se não. */
export function afinidade(npc, area) {
  const esp = npc?.especialidades || [];
  if (!area) return 0;
  if (esp.includes(area)) return 1;
  if (area === "strings" && esp.includes("regex")) return 0.5;
  return 0;
}

/** A força média do competidor pelos status (1–10): o capitão da CPU escolhe o mais forte. */
export const forcaDoNpc = (npc) => (npc?.status ? ORDEM_DOS_STATUS.reduce((a, k) => a + (npc.status[k] || 0), 0) / ORDEM_DOS_STATUS.length : 5);

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
  if (bruto.nivel && !NIVEIS_DO_TORNEIO[bruto.nivel]) return { ok: false, motivo: `escolha o nível: ${ORDEM_DOS_NIVEIS.map((n) => NIVEIS_DO_TORNEIO[n].nome).join(", ")}` };
  if (bruto.cenario && !CENARIOS[bruto.cenario]) return { ok: false, motivo: "cenário desconhecido" };
  const opcoes = { nivel: nivelValido(bruto.nivel), cenario: cenarioValido(bruto.cenario) };
  if (formato === "temporada") {
    const eliminados = Number(bruto.eliminadosPorEpisodio) || 1;
    if (!BOOTCAMP.eliminadosPorEpisodio.includes(eliminados)) return { ok: false, motivo: "escolha quantos saem por episódio: 1 ou 2" };
    const equipe = bruto.provaDeEquipe || "sorteio";
    if (!BOOTCAMP.provasDeEquipe.includes(equipe)) return { ok: false, motivo: "escolha como montar as equipes" };
    opcoes.eliminadosPorEpisodio = eliminados;
    opcoes.provaDeEquipe = equipe;
  }
  return { ok: true, config: { nome, formato, tempoMin, linguagens: { modo, permitidas }, total, rodadasPontos, npcs, convidados, opcoes } };
}

/**
 * Quantas rodadas (provas) o torneio tem: no mata-mata, até sobrar um (com folga para número ímpar); nos pontos
 * corridos, as escolhidas; na temporada, as provas do plano (planoDaTemporada).
 */
export function totalDeRodadas(formato, participantes, rodadasPontos = 3, opcoes = {}) {
  if (formato === "temporada") return planoDaTemporada(participantes, opcoes).length;
  if (formato === "mata-mata") return Math.max(1, Math.ceil(Math.log2(Math.max(2, participantes))));
  return rodadasPontos;
}

/** Quantos saem num episódio com `ativos` competidores, sendo `grupo` o tamanho de quem joga a eliminação. */
function quantosSaem(ativos, grupo, eliminadosPorEpisodio) {
  return Math.max(1, Math.min(eliminadosPorEpisodio, ativos - 2, grupo - 1));
}

/**
 * O plano da temporada: cada episódio tem a prova de imunidade (que salva metade) — ou, no episódio do meio, a
 * prova em equipe (o time vencedor fica salvo) — e a prova de eliminação de quem não se salvou; quando sobram dois,
 * a grande final. Devolve [{ numero, tipo, episodio, ativos, sai? }].
 *
 * Na prova em equipe, o time menor tem floor(ativos/2): é ele que limita quantos podem sair (sempre sobra alguém
 * do time que perdeu). A prova em equipe só acontece com 4 ou mais na disputa.
 */
export function planoDaTemporada(total, { eliminadosPorEpisodio = 1, provaDeEquipe = "sorteio" } = {}) {
  const montar = (comEquipeNo) => {
    const episodios = [];
    let ativos = total;
    while (ativos > 2) {
      const equipe = episodios.length === comEquipeNo && ativos >= 4;
      const grupo = equipe ? Math.floor(ativos / 2) : ativos - Math.floor(ativos / 2);
      const sai = quantosSaem(ativos, grupo, eliminadosPorEpisodio);
      episodios.push({ ativos, sai, equipe });
      ativos -= sai;
    }
    return episodios;
  };
  let episodios = montar(-1);
  if (provaDeEquipe !== "nao") {
    // o episódio do meio, entre os que ainda têm 4 ou mais competidores
    const candidatos = episodios.map((e, i) => (e.ativos >= 4 ? i : -1)).filter((i) => i >= 0);
    // (arredondado para cima: com dois candidatos, a equipe fica no segundo, nunca abrindo a temporada)
    if (candidatos.length) episodios = montar(candidatos[Math.ceil((candidatos.length - 1) / 2)]);
  }
  const provas = [];
  episodios.forEach((e, i) => {
    provas.push({ tipo: e.equipe ? "equipe" : "imunidade", episodio: i + 1, ativos: e.ativos });
    provas.push({ tipo: "eliminacao", episodio: i + 1, ativos: e.ativos, sai: e.sai });
  });
  provas.push({ tipo: "final", episodio: episodios.length + 1, ativos: Math.min(2, total) });
  return provas.map((p, i) => ({ numero: i + 1, ...p }));
}

/** A prova `numero` do torneio: na temporada, a do plano; nos modos rápidos, uma rodada com todos. */
export function provaDoTorneio(formato, numero, total, opcoes = {}) {
  if (formato !== "temporada") return { numero, tipo: "rodada", episodio: numero };
  return planoDaTemporada(total, opcoes)[numero - 1] || null;
}

const sorteados = (lista, s) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(s() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Os dois times da prova em equipe. `capitao`: o vencedor da última prova (no modo "capitao" ele escolhe um
 * membro, `escolhido`); o resto é sorteado. Devolve [{ id, nome, membros: [ids], capitao }], com tamanhos que
 * diferem no máximo em um.
 */
export function formarEquipes(ids, { modo = "sorteio", capitao = null, escolhido = null, s }) {
  const tamanhoA = Math.ceil(ids.length / 2);
  let a = [];
  let resto = [...ids];
  if (modo === "capitao" && capitao && ids.includes(capitao)) {
    a.push(capitao);
    resto = resto.filter((id) => id !== capitao);
    if (escolhido && resto.includes(escolhido)) { a.push(escolhido); resto = resto.filter((id) => id !== escolhido); }
  }
  resto = sorteados(resto, s);
  while (a.length < tamanhoA) a.push(resto.shift());
  return [
    { ...EQUIPES[0], membros: a, capitao: modo === "capitao" ? capitao : null },
    { ...EQUIPES[1], membros: resto, capitao: null },
  ];
}

/** O capitão da CPU escolhe o membro mais forte pelos status (empate: o primeiro da lista). */
export function escolhaDoCapitaoNpc(disponiveis, participantes) {
  const porId = new Map(participantes.map((p) => [p.id, p]));
  return [...disponiveis].sort((x, y) => forcaDoNpc(npcPorId(porId.get(y)?.npcId)) - forcaDoNpc(npcPorId(porId.get(x)?.npcId)))[0] || null;
}

/**
 * Quem joga a prova: na imunidade, na equipe e nos modos rápidos, todos os que estão na disputa; na eliminação, só
 * quem não ficou salvo na prova anterior (`salvos`); na final, os dois que sobraram.
 */
export function competidoresDaProva(tipo, participantes, salvos = []) {
  const vivos = participantes.filter((p) => !p.eliminado).map((p) => p.id);
  if (tipo === "eliminacao") return vivos.filter((id) => !salvos.includes(id));
  return vivos;
}

const ordenarPorNota = (ids, notas) => [...ids].sort((a, b) => ((notas.get(b)?.nota ?? 0) - (notas.get(a)?.nota ?? 0)) || ((notas.get(b)?.kernel ?? 0) - (notas.get(a)?.kernel ?? 0)) || String(a).localeCompare(String(b)));

const darInsignia = (p, tipo, numero) => ({ ...p, insignias: [...(p.insignias || []), { tipo, numero }] });

/**
 * O resultado de uma prova da temporada. `prova`: { tipo, sai, competidores, equipes }. `notas`: Map id → { nota,
 * kernel }. Devolve { participantes, salvos, eliminados, vencedores, equipes (com a nota), campeao, encerrado }:
 *   imunidade  a metade de cima (floor) fica salva; o primeiro ganha a insígnia de Imunidade
 *   equipe     a nota do time é a média dos integrantes; o time vencedor fica salvo e todos ganham a insígnia
 *   eliminacao os `sai` de menor nota deixam o torneio; o primeiro ganha a insígnia de Volta por cima
 *   final      quem tiver a nota maior é o campeão e ganha a insígnia de Campeão
 */
export function aplicarResultadoDaProva({ prova, participantes, notas, numero }) {
  const ids = prova.competidores || [];
  const ranking = ordenarPorNota(ids, notas);
  let lista = participantes.map((p) => (ids.includes(p.id) ? { ...p, pontos: p.pontos + (notas.get(p.id)?.nota ?? 0) } : { ...p }));
  const daLista = (fn) => { lista = lista.map(fn); };
  let salvos = [];
  let eliminados = [];
  let vencedores = [];
  let equipes = null;
  let campeao = null;

  if (prova.tipo === "imunidade") {
    salvos = ranking.slice(0, Math.floor(ids.length / 2));
    vencedores = ranking.slice(0, 1);
  } else if (prova.tipo === "equipe") {
    equipes = (prova.equipes || []).map((e) => {
      const ns = e.membros.map((id) => notas.get(id)?.nota ?? 0);
      return { ...e, nota: ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0 };
    });
    const [primeira, segunda] = [...equipes].sort((a, b) => (b.nota - a.nota) || (b.membros.length - a.membros.length));
    salvos = primeira ? [...primeira.membros] : [];
    vencedores = [...salvos];
    if (primeira) primeira.venceu = true;
    if (segunda) segunda.venceu = false;
  } else if (prova.tipo === "eliminacao") {
    const sai = Math.max(1, Math.min(prova.sai || 1, ranking.length - 1));
    eliminados = ranking.slice(-sai);
    vencedores = ranking.slice(0, 1);
  } else if (prova.tipo === "final") {
    vencedores = ranking.slice(0, 1);
    campeao = vencedores[0] || null;
    eliminados = ranking.slice(1);
  }

  const tipoDaInsignia = prova.tipo === "final" ? "final" : prova.tipo;
  daLista((p) => (vencedores.includes(p.id) ? darInsignia(p, tipoDaInsignia, numero) : p));
  daLista((p) => (eliminados.includes(p.id) && prova.tipo !== "final" ? { ...p, eliminado: true, eliminadoNa: numero } : p));
  const encerrado = prova.tipo === "final";
  return { participantes: lista, salvos, eliminados: prova.tipo === "final" ? [] : eliminados, vencedores, equipes, campeao, encerrado, vice: prova.tipo === "final" ? eliminados[0] || null : null };
}

/**
 * A dificuldade (1 a 3) sobe com as rodadas, dentro da faixa do nível: no médio, a primeira é fácil e a última é a
 * mais difícil; no fácil vai de 1 a 2; no difícil, de 2 a 3; no lendário, é sempre 3.
 */
export function dificuldadeDaRodada(numero, total, nivel = "medio") {
  const [min, max] = NIVEIS_DO_TORNEIO[nivelValido(nivel)].dificuldade;
  if (total <= 1) return Math.round((min + max) / 2);
  return Math.min(max, Math.max(min, min + Math.round(((numero - 1) * (max - min)) / (total - 1))));
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
      // a área do desafio: é nela que pesam as especialidades dos personagens
      area: AREAS_DOS_DESAFIOS.includes(bruto?.area) ? bruto.area : "logica",
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
    area: d.area || "logica",
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
    id: "soma-dos-pares", dificuldade: 1, area: "matematica", titulo: "A soma dos pares",
    enunciado: "Leia um número N e, na linha seguinte, N números inteiros separados por espaço. Imprima a soma dos números pares.",
    formatoEntrada: "1ª linha: N. 2ª linha: N inteiros.", formatoSaida: "Um inteiro: a soma dos pares.",
    requisitos: ["Números negativos também podem ser pares.", "Se não houver pares, imprima 0."],
    testes: [["5\n1 2 3 4 5\n", "6"], ["3\n10 20 30\n", "60"], ["4\n1 3 5 7\n", "0"], ["6\n-2 -4 3 8 0 11\n", "2"], ["1\n100\n", "100"]],
    resolver: (e) => String(e.trim().split("\n")[1].trim().split(/\s+/).map(Number).filter((n) => n % 2 === 0).reduce((a, b) => a + b, 0)),
  },
  {
    id: "palindromo", dificuldade: 1, area: "strings", titulo: "Palíndromo ou não?",
    enunciado: "Leia uma palavra formada só por letras minúsculas. Imprima SIM se ela é um palíndromo (igual de trás para frente) e NAO caso contrário.",
    formatoEntrada: "Uma linha com a palavra.", formatoSaida: "SIM ou NAO.",
    requisitos: ["A resposta é em maiúsculas e sem acento."],
    testes: [["arara\n", "SIM"], ["proof\n", "NAO"], ["a\n", "SIM"], ["abba\n", "SIM"], ["abca\n", "NAO"]],
    resolver: (e) => { const p = e.trim(); return p === [...p].reverse().join("") ? "SIM" : "NAO"; },
  },
  {
    id: "fizzbuzz", dificuldade: 1, area: "logica", titulo: "FizzBuzz do escritório",
    enunciado: "Leia N. Para cada i de 1 até N, imprima uma linha: FizzBuzz se i é múltiplo de 3 e de 5, Fizz se é só de 3, Buzz se é só de 5, ou o próprio i.",
    formatoEntrada: "Um inteiro N (1 ≤ N ≤ 100).", formatoSaida: "N linhas.",
    requisitos: ["Uma resposta por linha, na ordem."],
    testes: [["5\n", "1\n2\nFizz\n4\nBuzz"], ["15\n", "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz"], ["1\n", "1"], ["3\n", "1\n2\nFizz"]],
    resolver: (e) => Array.from({ length: Number(e.trim()) }, (_, k) => { const i = k + 1; return i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i); }).join("\n"),
  },
  {
    id: "contar-vogais", dificuldade: 1, area: "strings", titulo: "Caçando vogais",
    enunciado: "Leia uma linha de texto com letras minúsculas sem acento e espaços. Imprima quantas vogais (a, e, i, o, u) ela tem.",
    formatoEntrada: "Uma linha de texto.", formatoSaida: "Um inteiro.",
    requisitos: ["O y não conta como vogal."],
    testes: [["proof beyond\n", "4"], ["aeiou\n", "5"], ["xyz\n", "0"], ["lisa joga bootcamp\n", "7"]],
    resolver: (e) => String((e.match(/[aeiou]/g) || []).length),
  },
  {
    id: "maior-sequencia", dificuldade: 2, area: "algoritmos", titulo: "A maior subida",
    enunciado: "Leia N e, na linha seguinte, N inteiros. Imprima o tamanho da maior sequência de números seguidos em que cada um é maior que o anterior.",
    formatoEntrada: "1ª linha: N. 2ª linha: N inteiros.", formatoSaida: "Um inteiro.",
    requisitos: ["Um número sozinho já é uma sequência de tamanho 1.", "Números iguais quebram a subida."],
    testes: [["6\n1 2 3 1 2 1\n", "3"], ["5\n5 4 3 2 1\n", "1"], ["5\n1 2 3 4 5\n", "5"], ["7\n3 4 1 2 3 4 0\n", "4"], ["1\n42\n", "1"], ["4\n2 2 2 2\n", "1"]],
    resolver: (e) => { const v = e.trim().split("\n")[1].trim().split(/\s+/).map(Number); let m = 1, c = 1; for (let i = 1; i < v.length; i++) { c = v[i] > v[i - 1] ? c + 1 : 1; m = Math.max(m, c); } return String(m); },
  },
  {
    id: "inverter-palavras", dificuldade: 2, area: "strings", titulo: "De trás para frente",
    enunciado: "Leia uma linha com palavras separadas por um espaço. Imprima as mesmas palavras na ordem inversa, separadas por um espaço.",
    formatoEntrada: "Uma linha.", formatoSaida: "Uma linha.",
    requisitos: ["Inverta a ordem das palavras, não as letras."],
    testes: [["ola mundo\n", "mundo ola"], ["a b c d\n", "d c b a"], ["bootcamp\n", "bootcamp"], ["lisa joga proof beyond\n", "beyond proof joga lisa"]],
    resolver: (e) => e.trim().split(/\s+/).reverse().join(" "),
  },
  {
    id: "anagramas", dificuldade: 2, area: "strings", titulo: "Anagrama secreto",
    enunciado: "Leia duas palavras em minúsculas, uma por linha. Imprima SIM se uma é anagrama da outra (as mesmas letras, nas mesmas quantidades) e NAO caso contrário.",
    formatoEntrada: "Duas linhas, uma palavra em cada.", formatoSaida: "SIM ou NAO.",
    requisitos: ["As quantidades de cada letra precisam bater."],
    testes: [["amor\nroma\n", "SIM"], ["lisa\nsala\n", "NAO"], ["abc\ncba\n", "SIM"], ["aab\nabb\n", "NAO"], ["proof\nfoorp\n", "SIM"]],
    resolver: (e) => { const [a, b] = e.trim().split("\n").map((p) => [...p.trim()].sort().join("")); return a === b ? "SIM" : "NAO"; },
  },
  {
    id: "cifra-de-cesar", dificuldade: 2, area: "strings", titulo: "A cifra do jurado",
    enunciado: "Leia K na primeira linha e, na segunda, um texto em minúsculas sem acento. Desloque cada letra K posições para a frente no alfabeto (depois do z volta para o a) e mantenha os espaços. Imprima o texto cifrado.",
    formatoEntrada: "1ª linha: K (0 ≤ K ≤ 25). 2ª linha: o texto.", formatoSaida: "Uma linha.",
    requisitos: ["Espaços ficam onde estão."],
    testes: [["3\nabc xyz\n", "def abc"], ["1\nlisa\n", "mjtb"], ["13\nproof\n", "cebbs"], ["0\nbeyond\n", "beyond"], ["25\nb a\n", "a z"]],
    resolver: (e) => { const [k, t] = e.replace(/\n$/, "").split("\n"); return [...t].map((c) => (c === " " ? c : String.fromCharCode(((c.charCodeAt(0) - 97 + Number(k)) % 26) + 97))).join(""); },
  },
  {
    id: "parenteses", dificuldade: 3, area: "estruturas", titulo: "Chaves, colchetes e parênteses",
    enunciado: "Leia uma linha formada só pelos caracteres ( ) [ ] { }. Imprima VALIDO se cada um que abre fecha na ordem certa e INVALIDO caso contrário.",
    formatoEntrada: "Uma linha (1 a 1000 caracteres).", formatoSaida: "VALIDO ou INVALIDO.",
    requisitos: ["Pense numa pilha.", "Sobrou algum aberto no fim? É INVALIDO."],
    testes: [["([]{})\n", "VALIDO"], ["([)]\n", "INVALIDO"], ["((\n", "INVALIDO"], ["{[()()]}\n", "VALIDO"], ["}\n", "INVALIDO"]],
    resolver: (e) => { const par = { ")": "(", "]": "[", "}": "{" }; const p = []; for (const c of e.trim()) { if ("([{".includes(c)) p.push(c); else if (p.pop() !== par[c]) return "INVALIDO"; } return p.length ? "INVALIDO" : "VALIDO"; },
  },
  {
    id: "primos-ate-n", dificuldade: 3, area: "performance", titulo: "Quantos primos?",
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
 * `s`: o sorteio da rodada para esse personagem (sempre o mesmo para a mesma rodada). `area`: a área do desafio —
 * na especialidade dele, a chance sobe; o status de testes pesa nos testes ocultos (os casos de borda).
 */
export function simularNpc({ npc, dificuldade = 1, testes = [], tempoMin = null, s, area = null }) {
  const base = entre(npc.habilidade - 0.12 * (dificuldade - 1) + 0.08 * afinidade(npc, area), 0.3, 0.97);
  const borda = ((npc.status?.testes ?? 5) - 5) * 0.012;
  const ok = testes.map((t) => s() < (t.oculto ? base - 0.06 + borda : base + 0.04));
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

/** As notas de um personagem: saem da simulação; o status de arquitetura dele puxa a Chef Vetor. */
export function notasDoNpc(npc, sim) {
  const f = sim.total ? sim.passados / sim.total : 0;
  const ruido = (sim.sorteio ?? 0.5) - 0.5;
  const arquitetura = npc.status?.arquitetura ?? Math.round(npc.habilidade * 10);
  return {
    kernel: arred(entre((2 + 8 * f) * (0.9 + 0.1 * npc.habilidade) + ruido, 0, tetoDoKernel(f))),
    vetor: arred(entre(3.2 + 0.4 * arquitetura + 2.5 * npc.habilidade + ruido * 2 - (npc.ritmo < 0.75 ? 1 : 0), 0, 10)),
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
 * Confere a avaliação que a IA mandou para os humanos. `apelidos`: Map apelido ("p1") → { id, fracao, testou,
 * codigo }. Nota fora de 0–10 é cortada e o Kernel respeita o teto dos testes; quem a IA esqueceu fica de fora
 * (a avaliação automática cobre). O code review vem por número de linha e o trecho sai do código de verdade
 * (validarReview). Devolve Map id → { notas, feedback, review }.
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
      review: validarReview(a.review, alvo.codigo || ""),
      // para a despedida, se ele sair nesta rodada
      pontosFortes: validarPontos(a.pontosFortes),
      pontosFracos: validarPontos(a.pontosFracos),
      despedida: validarDespedida(a.despedida),
    });
  }
  return saida;
}

// ------------------------------------------------------------------ o code review ao vivo

export const REVIEW = { maxItens: 4, maxLinhas: 8, fala: 240 };

/** O código com o número de cada linha ("1| ..."), para a IA apontar os trechos sem copiar nada. */
export function numerarLinhas(codigo, max = 400) {
  return String(codigo ?? "").replace(/\r\n?/g, "\n").split("\n").slice(0, max).map((l, i) => `${i + 1}| ${l}`).join("\n");
}

/** O trecho das linhas ini–fim (1 em diante), no máximo REVIEW.maxLinhas; null se não sobra nada. */
export function trechoDoCodigo(codigo, ini, fim) {
  const linhas = String(codigo ?? "").replace(/\r\n?/g, "\n").split("\n");
  let a = Math.trunc(Number(ini));
  let b = Math.trunc(Number(fim));
  if (!Number.isFinite(a) || a < 1 || a > linhas.length) return null;
  if (!Number.isFinite(b) || b < a) b = a;
  b = Math.min(b, linhas.length, a + REVIEW.maxLinhas - 1);
  const texto = linhas.slice(a - 1, b).join("\n").replace(/\s+$/, "");
  return texto.trim() ? { linhaInicio: a, linhaFim: b, trecho: texto } : null;
}

/**
 * Confere os itens de code review: o jurado existe, o tipo é elogio ou bronca, a fala não é vazia e as linhas
 * apontam para o código de verdade. No máximo REVIEW.maxItens, sem repetir o mesmo trecho com o mesmo jurado.
 */
export function validarReview(bruto, codigo) {
  const vistos = new Set();
  const itens = [];
  for (const r of Array.isArray(bruto) ? bruto : []) {
    if (itens.length >= REVIEW.maxItens) break;
    const jurado = juradoPorId(String(r?.jurado || "").trim().toLowerCase());
    const tipo = r?.tipo === "elogio" || r?.tipo === "bronca" ? r.tipo : null;
    const fala = limpar(r?.fala, REVIEW.fala);
    const trecho = trechoDoCodigo(codigo, r?.linhaInicio, r?.linhaFim);
    if (!jurado || !tipo || !fala || !trecho) continue;
    const chave = `${jurado.id}:${trecho.linhaInicio}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push({ jurado: jurado.id, tipo, fala, ...trecho });
  }
  return itens;
}

const sortear = (lista, s) => lista[Math.floor(s() * lista.length) % lista.length];

/** As linhas que chamam a atenção de cada jurado: laço (Kernel), o bloco mais comprido (Vetor) e a saída (Sintaxe). */
function linhasDeInteresse(codigo) {
  const linhas = String(codigo ?? "").replace(/\r\n?/g, "\n").split("\n");
  const achar = (re) => linhas.findIndex((l) => re.test(l)) + 1;
  const laco = achar(/\b(for|while|forEach|map|reduce|loop)\b/);
  const saida = achar(/\b(print|println|printf|puts|echo|console\.log|cout|Console\.Write|fmt\.Print|System\.out)/);
  const cheias = linhas.map((l, i) => [i + 1, l.trim().length]).filter(([, n]) => n > 0);
  const maisLonga = cheias.sort((a, b) => b[1] - a[1])[0]?.[0] || 1;
  return { laco: laco || maisLonga, maisLonga, saida: saida || linhas.length };
}

/**
 * O code review sem a IA: um item por jurado, no trecho que interessa a ele, com uma fala do banco dele. Elogio
 * quando o critério foi bem (testes, tamanho, regras) e bronca quando não. `s`: o sorteio (preso à rodada).
 */
export function reviewAutomatica({ codigo, fracao = 0, enviou = false, linguagemOk = true, temPlano = false, s }) {
  if (!String(codigo ?? "").trim()) return [];
  const { laco, maisLonga, saida } = linhasDeInteresse(codigo);
  const bomKernel = fracao >= 1;
  const bomVetor = temPlano && fracao >= 0.8;
  const bomSintaxe = enviou && linguagemOk && fracao >= 1;
  const item = (id, bom, linha) => {
    const j = juradoPorId(id);
    const t = trechoDoCodigo(codigo, Math.max(1, linha - 1), linha + 2);
    return t ? { jurado: id, tipo: bom ? "elogio" : "bronca", fala: sortear(bom ? j.elogios : j.broncas, s), ...t } : null;
  };
  return [item("kernel", bomKernel, laco), item("vetor", bomVetor, maisLonga), item("sintaxe", bomSintaxe, saida)].filter(Boolean);
}

// Um trecho "do jeito" de cada personagem da Lisa: eles jogam pela simulação, então o review mostra um pedaço
// típico do estilo deles — o bom quando a rodada foi bem, o ruim quando foi mal.
export const TRECHOS_DOS_NPCS = {
  lisa: {
    bom: "function resolver(linhas) {\n  const n = Number(linhas[0]);\n  return somar(lerNumeros(linhas[1]).slice(0, n));\n}",
    ruim: "// TODO: tratar a entrada vazia\nconst n = Number(linhas[0]);",
  },
  "byte-ninja": {
    bom: "print(sum(x for x in map(int, input().split()) if x % 2 == 0))",
    ruim: "a=input().split();print(a and a[::-1]or 0)",
  },
  "capita-stack": {
    bom: "assert resolver('1\\n-2') == '-2'\nassert resolver('3\\n1 3 5') == '0'",
    ruim: "if (n === 0) return 0; // e se for negativo? deixa pra lá",
  },
  "raposa-regex": {
    bom: "const vogais = texto.match(/[aeiou]/g) ?? [];\nconsole.log(vogais.length);",
    ruim: "const ok = /^(?:\\(\\)|\\[\\]|\\{\\})*$/.test(s); // confia",
  },
  "cogu-commit": {
    bom: "git commit -m \"feat: lê a entrada\"\ngit commit -m \"feat: resolve o caso de borda\"",
    ruim: "git commit -m \"ajustes\"\ngit commit -m \"ajustes 2\"\ngit commit -m \"agora vai\"",
  },
  "mergulho-profundo": {
    bom: "// invariante: soma guarda os pares já lidos\nfor (const x of numeros) if (x % 2 === 0) soma += x;",
    ruim: "// 40 linhas de análise do problema...\n// (o código ficou para a próxima rodada)",
  },
  "yeti-legado": {
    bom: "for (int i = 0; i < n; i++) {\n    if (v[i] % 2 == 0) soma += v[i];\n}",
    ruim: "goto fim; /* funciona desde 1998, não mexe */",
  },
  "magma-hotfix": {
    bom: "console.log(resolver(entrada)); // de primeira, passou!",
    ruim: "try { resolver(); } catch (e) { /* depois eu vejo */ }",
  },
  "zorg-compilador": {
    bom: "const crivo = new Uint8Array(n + 1); // O(n log log n), como no meu planeta",
    ruim: "const cache = new Map();\nconst cacheDoCache = new Map(); // otimização prematura nível galáctico",
  },
  "abacatinho-agil": {
    bom: "// tarefa 1: ler ✅\n// tarefa 2: resolver ✅\n// tarefa 3: imprimir ✅",
    ruim: "// sprint 1: planejar o planejamento do plano",
  },
};

/** O review de um personagem: o trecho típico dele (bom ou ruim) e a fala de um jurado do banco. */
export function reviewDoNpc(npcId, sim, s) {
  const t = TRECHOS_DOS_NPCS[npcId];
  if (!t) return [];
  const bom = sim.passou;
  const j = sortear(JURADOS, s);
  const trecho = bom ? t.bom : t.ruim;
  return [{ jurado: j.id, tipo: bom ? "elogio" : "bronca", fala: sortear(bom ? j.elogios : j.broncas, s), linhaInicio: 1, linhaFim: trecho.split("\n").length, trecho }];
}

// ------------------------------------------------------------------ as emoções na avaliação ao vivo
// Quatro emoções de 0 a 100, que mudam a cada passo da cena: começa aflito; elogio alegra; bronca irrita e
// entristece; a nota e o resultado fecham. A que estiver mais alta manda no humor do avatar e no medidor.
export const EMOCOES = {
  aflicao: { nome: "Aflição", emoji: "😰", humor: "aflito" },
  felicidade: { nome: "Felicidade", emoji: "😄", humor: "feliz" },
  raiva: { nome: "Raiva", emoji: "😠", humor: "bravo" },
  tristeza: { nome: "Tristeza", emoji: "😢", humor: "triste" },
};
export const ORDEM_DAS_EMOCOES = ["aflicao", "felicidade", "raiva", "tristeza"];

export const emocaoInicial = () => ({ aflicao: 60, felicidade: 10, raiva: 5, tristeza: 10 });

/** A emoção depois de um passo da cena: { tipo: "elogio"|"bronca"|"nota"|"resultado", nota?, resultado?, campeao? }. */
export function reagirNaCena(estado, evento) {
  const e = { ...estado };
  const somar = (k, v) => { e[k] = Math.round(entre(e[k] + v, 0, 100)); };
  // um elogio já tira a aflição do topo; duas broncas seguidas já deixam a raiva na frente
  if (evento.tipo === "elogio") { somar("felicidade", 30); somar("aflicao", -25); somar("raiva", -5); somar("tristeza", -5); }
  if (evento.tipo === "bronca") { somar("raiva", 28); somar("tristeza", 12); somar("felicidade", -10); }
  if (evento.tipo === "nota") {
    const n = Number(evento.nota) || 0;
    if (n >= 85) { somar("felicidade", 35); somar("aflicao", -40); }
    else if (n >= 60) { somar("felicidade", 15); somar("aflicao", -25); }
    else { somar("tristeza", 25); somar("aflicao", -10); somar("raiva", 5); }
  }
  if (evento.tipo === "resultado") {
    if (evento.campeao) { e.felicidade = 100; somar("aflicao", -100); somar("tristeza", -100); somar("raiva", -100); }
    else if (evento.resultado === "eliminado") { e.tristeza = Math.max(e.tristeza, 85); somar("felicidade", -30); somar("aflicao", -30); }
    // passou de fase: alívio e alegria (com nota alta, vira festa)
    else { somar("felicidade", 40); somar("aflicao", -50); }
  }
  return e;
}

export function emocaoDominante(estado) {
  return ORDEM_DAS_EMOCOES.reduce((a, b) => ((estado[b] ?? 0) > (estado[a] ?? 0) ? b : a), ORDEM_DAS_EMOCOES[0]);
}

/** O humor do Neuro para a emoção que manda: muito feliz vira comemoração. */
export function humorDaEmocao(estado) {
  const d = emocaoDominante(estado);
  if (d === "felicidade" && estado.felicidade >= 85) return "comemorando";
  return EMOCOES[d].humor;
}

// ------------------------------------------------------------------ a despedida de quem sai
// A apresentadora do programa: personagem original. Quando um humano é eliminado, ele deixa a bancada, vai até a
// porta de saída e ela faz a entrevista de despedida; depois a cena corta para a ficha dele (notas, pontos fortes e
// pontos fracos).
export const APRESENTADORA = {
  id: "apresentadora", nome: "Clara Compila", emoji: "🎤",
  estilo: "a apresentadora do programa: acolhedora, curiosa e bem-humorada, faz perguntas curtas e deixa a pessoa sair de cabeça erguida",
};

export const DESPEDIDA = { perguntas: 3, texto: 260, pontos: 3, ponto: 160 };

/** Confere a entrevista que a IA mandou: de 2 a 3 perguntas com resposta, cada uma cortada. Senão, []. */
export function validarDespedida(bruto) {
  const itens = (Array.isArray(bruto) ? bruto : [])
    .map((q) => ({ pergunta: limpar(q?.pergunta, DESPEDIDA.texto), resposta: limpar(q?.resposta, DESPEDIDA.texto) }))
    .filter((q) => q.pergunta && q.resposta)
    .slice(0, DESPEDIDA.perguntas);
  return itens.length >= 2 ? itens : [];
}

/** Confere uma lista de pontos (fortes ou fracos): de 1 a 3 frases curtas, sem repetir. */
export function validarPontos(bruto) {
  return [...new Set((Array.isArray(bruto) ? bruto : []).map((p) => limpar(p, DESPEDIDA.ponto)).filter(Boolean))].slice(0, DESPEDIDA.pontos);
}

const NOME_DO_CRITERIO = { kernel: "desempenho técnico", vetor: "arquitetura", sintaxe: "regras e formato" };

/**
 * Os pontos fortes e fracos sem a IA: pelas notas de cada jurado, pelos testes, pelo plano e pelo envio. Sempre
 * sai pelo menos um de cada.
 */
export function pontosAutomaticos({ notas = {}, testes = { passados: 0, total: 0 }, enviou = false, temPlano = false, linguagemOk = true }) {
  const fortes = [];
  const fracos = [];
  const passouTudo = testes.total > 0 && testes.passados === testes.total;
  if (passouTudo) fortes.push(`Passou em todos os ${testes.total} testes, inclusive os ocultos.`);
  else if (testes.total && !testes.passados) fracos.push(`Nenhum dos ${testes.total} testes passou: a solução não chegou a funcionar.`);
  else if (testes.total) fracos.push(`Passou em ${testes.passados} de ${testes.total} testes: os casos de borda ficaram de fora.`);
  else fracos.push("Não chegou a rodar os testes nesta rodada.");
  for (const id of IDS_DOS_JURADOS) {
    const n = Number(notas[id]) || 0;
    if (n >= 7.5) fortes.push(`${NOME_DO_CRITERIO[id][0].toUpperCase() + NOME_DO_CRITERIO[id].slice(1)} elogiado: ${juradoPorId(id).nome} deu ${n}.`);
    else if (n < 6) fracos.push(`${NOME_DO_CRITERIO[id][0].toUpperCase() + NOME_DO_CRITERIO[id].slice(1)} abaixo do esperado: ${juradoPorId(id).nome} deu ${n}.`);
  }
  if (temPlano) fortes.push("Planejou antes de codar.");
  else fracos.push("Faltou o planejamento antes do código.");
  if (!enviou) fracos.push("Não enviou para a revisão dentro do prazo.");
  if (!linguagemOk) fracos.push("Não usou a linguagem que os jurados estipularam.");
  if (!fortes.length) fortes.push("Não desistiu: chegou até a bancada e encarou os jurados.");
  return { fortes: fortes.slice(0, DESPEDIDA.pontos), fracos: fracos.slice(0, DESPEDIDA.pontos) };
}

const RECADOS = [
  "Leiam o enunciado duas vezes e testem os casos de borda antes de enviar!",
  "Planejem antes de codar: o plano salva o código.",
  "Não tenham medo dos testes ocultos: tenham medo de não testar.",
  "Nomes claros e funções pequenas. A Chef Vetor está de olho!",
];

/** A entrevista de despedida sem a IA: três perguntas da apresentadora com respostas pelo desempenho. */
export function despedidaAutomatica({ nome, notas = {}, testes = { passados: 0, total: 0 }, s = Math.random }) {
  const pior = IDS_DOS_JURADOS.reduce((a, b) => ((Number(notas[b]) || 0) < (Number(notas[a]) || 0) ? b : a), IDS_DOS_JURADOS[0]);
  const primeiro = String(nome || "").split(/\s+/)[0] || "competidor";
  return [
    {
      pergunta: `${primeiro}, chegou a hora de dizer tchau ao escritório. Como você está saindo daqui?`,
      resposta: testes.total
        ? `Triste, mas de cabeça erguida: saio com ${testes.passados} de ${testes.total} testes passando e muita coisa aprendida.`
        : "Triste, mas de cabeça erguida: aprendi que testar cedo faz toda a diferença.",
    },
    {
      pergunta: "O que mais pesou na avaliação dos jurados?",
      resposta: `O ${juradoPorId(pior).nome} pegou pesado com o meu ${NOME_DO_CRITERIO[pior]}. Justo: é exatamente o que eu vou estudar agora.`,
    },
    { pergunta: "Um recado para quem fica na disputa?", resposta: sortear(RECADOS, s) },
  ];
}

/**
 * O roteiro da avaliação ao vivo: um passo por competidor, do melhor prato ao pior (a tensão fica para o fim),
 * cada um com o code review, a nota e o resultado. O humano eliminado ganha a despedida: a entrevista com a
 * apresentadora e a ficha (notas, testes, pontos fortes e fracos). `avaliacao.participantes` vem de chamarJurados.
 */
export function roteiroDaAvaliacao(avaliacao) {
  const lista = Array.isArray(avaliacao?.participantes) ? [...avaliacao.participantes] : [];
  return lista
    .sort((a, b) => (b.nota - a.nota) || String(a.id).localeCompare(String(b.id)))
    .map((a) => ({
      id: a.id, nome: a.nome, tipo: a.tipo, nota: a.nota, resultado: a.resultado, fala: a.fala || "",
      campeao: Boolean(avaliacao.campeao && avaliacao.campeao === a.id),
      review: Array.isArray(a.review) ? a.review : [],
      notas: a.notas || {}, testes: a.testes || { passados: 0, total: 0 }, insignia: a.insignia || null,
      despedir: a.tipo === "humano" && a.resultado === "eliminado",
      despedida: Array.isArray(a.despedida) ? a.despedida : [],
      pontosFortes: Array.isArray(a.pontosFortes) ? a.pontosFortes : [],
      pontosFracos: Array.isArray(a.pontosFracos) ? a.pontosFracos : [],
    }));
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
  // toda rodada tem um vencedor: a maior nota ganha a insígnia de "melhor da rodada"
  const melhor = ordenarPorNota(participantes.filter((p) => !p.eliminado).map((p) => p.id), notas)[0];
  const lista = participantes.map((p) => (p.eliminado ? { ...p } : (p.id === melhor ? darInsignia : (x) => x)({ ...p, pontos: p.pontos + nota(p.id) }, "rodada", numero)));
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
    return { participantes: lista, eliminados, avancaram, campeao, encerrado, vencedores: melhor ? [melhor] : [] };
  }

  for (const p of lista) if (!p.eliminado) avancaram.push(p.id);
  const encerrado = numero >= total;
  return { participantes: lista, eliminados, avancaram, campeao: encerrado ? (ordemDeSemente(lista)[0]?.id || null) : null, encerrado, vencedores: melhor ? [melhor] : [] };
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
