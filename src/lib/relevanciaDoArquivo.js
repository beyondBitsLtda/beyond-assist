// Liga o arquivo que você está editando ao que já existe no Beyond Bits: cards do Trello,
// tarefas da Delp, chamados do Sentinela e pensamentos.
//
// A ideia é você abrir `src/lib/gemini.js` e a Lisa já saber que existe um card chamado
// "revisar rodízio de chaves do Gemini" — sem você perguntar.
//
// O casamento é por TEXTO, não por significado, e isso é escolha, não preguiça. Busca por
// significado exigiria um embedding a cada troca de arquivo, e foi exatamente esse tipo de
// consumo que esgotou a cota diária das 35 chaves em 15/09/2026 e fez a Lisa levar 98 segundos
// para responder. Casar texto custa zero e responde na hora. Se um dia ficar raso demais, o
// caminho é acrescentar o vetorial COM orçamento próprio, não trocar este.
//
// Tudo aqui é função pura — sem rede, sem banco. Quem busca os itens é a rota.

/** Pedaços de caminho que aparecem em todo projeto e não dizem nada sobre o assunto. */
const RUIDO = new Set([
  "src", "lib", "app", "api", "components", "pages", "utils", "helpers", "hooks", "styles",
  "public", "assets", "scripts", "test", "tests", "spec", "dist", "build", "node_modules",
  "index", "main", "route", "page", "layout", "config", "types", "js", "ts", "jsx", "tsx",
  "mjs", "cjs", "json", "css", "scss", "html", "md", "com", "para", "the", "and", "que",
]);

/** Tira acento e baixa a caixa — o mesmo tratamento dos dois lados da comparação. */
function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Ponte entre o idioma do CÓDIGO e o idioma dos CARDS.
 *
 * Esta é a limitação que a medição expôs, e que nenhuma quantidade de ajuste no algoritmo
 * resolveria: o código é escrito em inglês e os cards são escritos em português. O arquivo
 * `browserVoice.js` dá os termos "browser" e "voice"; o card que fala dele se chama "ajustar a
 * voz da Lisa que cai pro navegador". Não há uma letra em comum.
 *
 * A lista é curta de propósito. Cada par acrescentado é uma chance a mais de acerto e também
 * de falso positivo — "key" casando com "chave" é ótimo, mas um dicionário inteiro traria
 * palavras genéricas que casam com tudo. Só entram aqui os termos que realmente nomeiam
 * assuntos deste projeto.
 */
const TRADUCOES = {
  voice: "voz", browser: "navegador", screen: "tela", key: "chave", keys: "chaves",
  file: "arquivo", files: "arquivos", user: "usuario", users: "usuarios", search: "busca",
  speech: "fala", speak: "fala", health: "saude", task: "tarefa", tasks: "tarefas",
  note: "nota", notes: "notas", board: "quadro", boards: "quadros", deploy: "deploy",
  code: "codigo", chat: "conversa", auth: "login", login: "login", clock: "relogio",
  radio: "radio", listen: "escuta", command: "comando", commands: "comandos",
};

/**
 * Os termos que descrevem um arquivo.
 *
 * Vem do CAMINHO, e não do conteúdo: o caminho é estável, curto e já carrega o assunto
 * (`gemini`, `escutaPorPalavra`, `browserVoice`). Ler o conteúdo traria centenas de palavras
 * genéricas — `const`, `return`, `function` — que casariam com tudo e com nada.
 *
 * Separa camelCase e kebab-case porque é assim que os nomes são escritos no código e NÃO é
 * assim que são escritos num card: ninguém abre um card chamado "geminiKeyHealth", abre
 * "saúde das chaves do Gemini".
 */
export function termosDoArquivo(caminho, conteudo = "") {
  // A separação de camelCase precisa acontecer ANTES de baixar a caixa — depois do toLowerCase
  // não há mais maiúscula para encontrar. Por isso o corte é feito no caminho ORIGINAL e a
  // normalização vem depois, e não o contrário.
  const termos = String(caminho || "")
    // O hifen vai no FIM da classe de proposito. No meio, "\\-_" vira um INTERVALO de
    // "\\" ate "_" e o hifen deixa de ser separador — foi assim que "gemini-keys" chegou
    // inteiro do outro lado, sem casar com nenhum card que falasse de "chaves".
    .split(/[/\\_.()[\]\s-]+/)
    .flatMap((parte) => parte.split(/(?<=[a-z0-9])(?=[A-Z])/))
    .map(normalizar);

  const uteis = [...new Set(termos)].filter((t) => t.length >= 3 && !RUIDO.has(t) && !/^\d+$/.test(t));

  // Cada termo entra também traduzido, quando há tradução. Os dois valem: o card pode estar
  // escrito de qualquer um dos lados.
  const comTraducao = uteis.flatMap((t) => (TRADUCOES[t] ? [t, TRADUCOES[t]] : [t]));
  return [...new Set([...comTraducao, ...termosDoConteudo(conteudo)])];
}

/**
 * Os termos que o PRÓPRIO ARQUIVO declara sobre si.
 *
 * Eu tinha escrito aqui que ler o conteúdo traria palavras genéricas demais. Isso é verdade
 * para o CORPO — `const`, `return`, `function` casam com tudo e com nada — e é falso para o
 * CABEÇALHO, que é justamente onde o arquivo diz do que trata.
 *
 * O caso que me mostrou isso foi real: `cronograma/index.html` dá só o termo "cronograma", e o
 * que aquele arquivo É está escrito no título dele — "Painel SEO · Montador de Móveis". O card
 * que falava dele dizia "montador de móveis". Sem ler o título, nada casava, e a Lisa pedia o
 * caminho do arquivo de volta para o usuário.
 *
 * Só entram lugares onde uma pessoa escreve o ASSUNTO. O corpo do código continua de fora.
 */
export function termosDoConteudo(conteudo, limite = 4000) {
  const texto = String(conteudo || "").slice(0, limite);
  if (!texto.trim()) return [];

  const fontes = [];
  const pegar = (re) => {
    let m;
    while ((m = re.exec(texto)) !== null) fontes.push(m[1] || "");
  };

  pegar(/<title[^>]*>([^<]{3,120})<\/title>/gi);
  pegar(/<h1[^>]*>([^<]{3,120})<\/h1>/gi);
  pegar(/^#\s+(.{3,120})$/gm);
  pegar(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{3,200})["']/gi);

  // O comentário do TOPO do arquivo. Neste projeto é onde mora a explicação do que a coisa faz,
  // e costuma nomear o assunto melhor que qualquer outro lugar.
  const bloco = /^\s*\/\*\*?([\s\S]{10,600}?)\*\//.exec(texto);
  if (bloco) fontes.push(bloco[1]);
  const barras = /^\s*((?:\/\/[^\n]*\n){1,8})/.exec(texto);
  if (barras) fontes.push(barras[1]);

  const palavras = fontes
    .join(" ")
    .replace(/[*/]/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizar)
    .filter((t) => t.length >= 4 && !RUIDO.has(t));

  // Teto para o cabeçalho não afogar os termos do caminho, que continuam sendo os mais
  // confiáveis: o caminho é escolhido com cuidado, o título às vezes é copiado de outro arquivo.
  return [...new Set(palavras)].slice(0, 12);
}

/**
 * Quanto um item tem a ver com esses termos.
 *
 * Título pesa o triplo da descrição: um card que traz a palavra no TÍTULO é sobre aquilo; um
 * que a menciona no meio da descrição pode só estar citando de passagem.
 */
export function pontuar(termos, item) {
  if (!termos.length) return 0;
  const titulo = normalizar(item?.title || item?.titulo || "");
  const corpo = normalizar(item?.description || item?.desc || item?.body || item?.content || "");
  if (!titulo && !corpo) return 0;

  let pontos = 0;
  for (const termo of termos) {
    if (titulo.includes(termo)) pontos += 3;
    else if (corpo.includes(termo)) pontos += 1;
  }
  return pontos;
}

/**
 * O que já foi entregue não é contexto.
 *
 * Medido com os dados reais em 19/09/2026: abrir um arquivo chamado "Painel SEO" trouxe quatro
 * tarefas da Delp casadas pela palavra "painel", e as QUATRO estavam concluídas. Tecnicamente
 * relacionadas, praticamente ruído — ninguém precisa ser lembrado do que já acabou enquanto
 * escreve código.
 *
 * Mesmo padrão que o resto do app usa (ver DONE_PATTERN em pendingWork.js), para "concluído"
 * significar a mesma coisa em todo lugar.
 */
const CONCLUIDO = /conclu|feito|pronto|finaliz|done|entregue|arquivad/i;

function estaConcluido(item) {
  return CONCLUIDO.test(item?.status || "") || CONCLUIDO.test(item?.list || "");
}

/**
 * Os itens que valem mostrar, do mais para o menos relacionado.
 *
 * O piso é a decisão mais importante deste arquivo. Sem ele, todo arquivo aberto traria alguma
 * coisa — e um painel que sempre mostra algo, relacionado ou não, ensina a pessoa a ignorá-lo
 * em uma semana. Um termo casando no título (3 pontos) é o mínimo para valer a interrupção.
 */
export function itensRelevantes(termos, itens, { max = 4, piso = 3 } = {}) {
  if (!termos.length || !Array.isArray(itens)) return [];
  return itens
    .filter((item) => !estaConcluido(item))
    .map((item) => ({ item, pontos: pontuar(termos, item) }))
    .filter((x) => x.pontos >= piso)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, max)
    .map((x) => x.item);
}

/**
 * Monta o bloco de texto que vai junto da conversa.
 *
 * Devolve string vazia quando não há nada relevante, e quem chama não deve inventar um
 * "(nada encontrado)": silêncio é informação, ruído não é.
 */
export function blocoDeContexto(grupos) {
  const linhas = [];
  for (const { rotulo, itens } of grupos || []) {
    if (!itens?.length) continue;
    linhas.push(`${rotulo}:`);
    for (const i of itens) {
      const extra = i.due ? ` (prazo: ${i.due})` : i.status ? ` [${i.status}]` : "";
      linhas.push(`  - ${i.title || i.titulo}${extra}`);
    }
  }
  if (!linhas.length) return "";
  return `[do Beyond Bits, relacionado ao arquivo aberto]\n${linhas.join("\n")}`;
}
