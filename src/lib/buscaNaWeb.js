// A Lisa na internet (01/11/2026): "se eu pedir para ela procurar um site ou algo na internet, ela
// deveria conseguir". Ela não conseguia, e por dois motivos:
//
//   1. a busca do Google (grounding do Gemini) só ligava no escopo "Geral" do seletor;
//   2. e nem lá funcionava: medido em 01/11/2026, as 35 chaves do pool respondem 429 ("check your
//      plan and billing details") para `googleSearch` — a busca não entra no plano gratuito. Pior: o
//      429 punha a chave de castigo para o modelo de chat inteiro (classifyGeminiError em gemini.js),
//      e o chat caía para a resposta sem ferramenta, sem dizer nada.
//
// A leitura de páginas (`urlContext`) funciona nessas mesmas chaves. Então a pesquisa é feita aqui:
// o servidor busca no DuckDuckGo (sem chave; se falhar, a versão "lite" e depois o Google Notícias),
// os resultados entram no prompt, e o Gemini abre as páginas mais promissoras com o urlContext para
// responder com o conteúdo de verdade. Citar um site ou colar um link pula a busca e lê a página.
// Com uma chave paga, GEMINI_BUSCA_GOOGLE=1 volta a usar a busca do próprio Gemini.
//
// As fontes voltam como links embaixo da resposta (fontesDaBusca, FontesDaWeb.js) e não são lidas
// em voz alta. As funções de texto são puras; `pesquisarNaWeb` recebe o fetch (testes: web-check).

/** A busca do próprio Gemini (googleSearch) só com chave paga — ver o topo do arquivo. */
export const BUSCA_DO_GOOGLE = /^(1|true|sim)$/i.test(String(globalThis.process?.env?.GEMINI_BUSCA_GOOGLE || ""));

const URL_COMPLETA = /\bhttps?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/gi;
const DOMINIO = /(?<![@\w.-])(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|br|net|org|io|dev|app|gov|edu|ai|co|info|me|tv|news|blog|site|online|tech|xyz|pt|us|uk)(?:\.[a-z]{2})?(?:\/[^\s<>"'()]*[^\s<>"'().,;:!?])?/gi;

/** Os endereços citados no texto (link completo ou domínio solto: "beyond.dev.br"), sem repetir. */
export function enderecosDoTexto(texto, max = 5) {
  const t = String(texto || "");
  const achados = [];
  for (const m of t.matchAll(URL_COMPLETA)) achados.push(m[0]);
  const semLinks = t.replace(URL_COMPLETA, " ");
  for (const m of semLinks.matchAll(DOMINIO)) {
    // nome de arquivo não é site ("rotas.js", "page.tsx", "README.md")
    if (/\.(js|jsx|ts|tsx|mjs|cjs|json|md|css|html|py|sql|sh|txt|yml|yaml)$/i.test(m[0])) continue;
    achados.push(`https://${m[0]}`);
  }
  return [...new Set(achados.map((u) => u.replace(/\/+$/, "")))].slice(0, max);
}

// pedidos de internet: "pesquise", "procure na internet", "busque no google", "abra o site", "entra no site"
const PESQUISAR = /\b(pesquis\w*|googl\w*|guglar|gugla)\b/i;
const PROCURAR = /\b(procur\w*|busqu\w*|busc\w*|ach[ae]\w*|encontr\w*|ve[jr]\w*|olh[ae]\w*|consult\w*|naveg\w*|acess\w*|abr[ae]\w*|abrir|entr[ae]\w*|leia|ler|l[eê] o)\b/i;
const NA_INTERNET = /\b(internet|web|google|online|site|sites|p[aá]gina|link|links|na rede|not[ií]cias?|blog|wikip[eé]dia|youtube|reddit|stack ?overflow|documenta[cç][aã]o oficial)\b/i;
// "pesquise nas minhas notas", "procure o card" — é dos dados da pessoa, não da internet
const DADOS_DA_PESSOA = /\b(minhas? notas?|abacato|cards?|tarefas?|quadros?|brain|pensamentos?|sentinela|chamados?|reposit[oó]rio|meu c[oó]digo)\b/i;

/** A pergunta pede para olhar a internet (ou cita um site)? */
export function pedeInternet(pergunta) {
  const q = String(pergunta || "");
  if (enderecosDoTexto(q).length) return true;
  if (DADOS_DA_PESSOA.test(q) && !NA_INTERNET.test(q)) return false;
  if (PESQUISAR.test(q)) return true;
  return PROCURAR.test(q) && NA_INTERNET.test(q);
}

// "quer que eu pesquise?" — "sim": a resposta curta aceita a oferta da Lisa (ver rag.js)
const ACEITE = /^\s*(sim|pode|quero|claro|por favor|manda|ok|okay|beleza|isso|pesquis\w*|procur\w*|fa[zç]\w* isso|vai)\b/i;

/**
 * A pessoa aceitou a oferta de pesquisar? Devolve a pergunta anterior dela (o que pesquisar) ou
 * null. Só vale para uma resposta curta logo depois de a Lisa oferecer a pesquisa.
 */
export function aceitouPesquisar(pergunta, turnos = []) {
  const q = String(pergunta || "").trim();
  if (!ACEITE.test(q) || q.split(/\s+/).length > 5) return null;
  const lista = (turnos || []).filter(Boolean);
  const ultima = lista[lista.length - 1];
  if (ultima?.papel !== "lisa" || !/\b(pesquis\w*|procur\w* na (internet|web))\b/i.test(String(ultima.texto || "").slice(-400))) return null;
  const anterior = [...lista].reverse().find((t) => t.papel === "voce");
  return anterior ? String(anterior.texto).trim().slice(0, 300) || null : null;
}

// ---- o que pesquisar ----------------------------------------------------------------------

const PEDIDO = [
  /^\s*(oi|ei|olá|ola)?[\s,]*lisa[\s,:!]*/i,
  /\b(por favor|pfv|pf|pra mim|para mim|a[ií] pra mim|rapidinho)\b/gi,
  /\b(d[aá] (uma? )?(google|googlada|pesquisada|olhada|procurada|busca)( r[aá]pida)?)( (em|sobre|no|na|de))?\b/gi,
  /\b(voc[eê] )?(pode|consegue|poderia|daria para|d[aá] pra)\b/gi,
  /\b(na|no|pela|pelo|em|da|do) (internet|web|google|net|rede)\b/gi,
  /\b(pesquis\w*|procur\w*|busqu\w*|busc\w*|googl\w*|gugl\w*)\b/gi,
  /\b(online|a[ií])\b/gi,
  /^\s*(sobre|a respeito d[eoa]s?|o que (é|tem|diz) sobre)\s+/i,
  /^\s*(o|a|os|as|um|uma)\s+(?!que\b)/i,
];
const SO_PRONOME = /^(isso|isto|esse assunto|essa coisa|ele|ela|eles|elas|disso|nisso|sobre isso|mais|mais sobre isso)?$/i;

/**
 * A consulta para o buscador: a pergunta sem o pedido em volta ("Lisa, pesquisa pra mim o preço
 * do dólar" → "preço do dólar"). "pesquisa isso" usa a última fala da pessoa como assunto.
 */
export function consultaDaPergunta(pergunta, turnos = []) {
  const limpar = (texto) => {
    let t = ` ${String(texto || "").replace(/\s+/g, " ")} `;
    for (const r of PEDIDO) t = t.replace(r, " ").replace(/\s+/g, " ");
    return t.replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "").trim();
  };
  const consulta = limpar(pergunta);
  if (!SO_PRONOME.test(consulta)) return consulta.slice(0, 200);
  const anterior = [...(turnos || [])].reverse().find((t) => t?.papel === "voce" && String(t.texto || "").trim() !== String(pergunta || "").trim());
  const assunto = anterior ? limpar(anterior.texto).slice(0, 150) : "";
  return (assunto || String(pergunta || "").trim()).slice(0, 200);
}

// ---- ler o que o buscador devolveu ---------------------------------------------------------

function semEntidades(texto) {
  return String(texto || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    // acentos com nome (&oacute; &ccedil; &atilde;…): a letra mais o acento combinado
    .replace(/&([a-z])(acute|grave|tilde|circ|uml|cedil);/gi, (_, l, a) =>
      (l + { acute: "́", grave: "̀", tilde: "̃", circ: "̂", uml: "̈", cedil: "̧" }[a.toLowerCase()]).normalize("NFC"))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** O endereço de verdade atrás do redirecionamento do DuckDuckGo (//duckduckgo.com/l/?uddg=…). */
function enderecoDoResultado(href) {
  const h = semEntidades(href);
  try {
    const u = new URL(h.startsWith("//") ? `https:${h}` : h);
    const destino = u.searchParams.get("uddg");
    if (destino) return destino;
    if (/(^|\.)duckduckgo\.com$/i.test(u.hostname)) return null; // anúncio (y.js) e afins
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Os resultados da página HTML do DuckDuckGo — serve para a versão normal (result__a /
 * result__snippet) e para a "lite" (result-link / result-snippet). [{ titulo, url, trecho }]
 */
export function resultadosDoDuckDuckGo(html, max = 8) {
  const h = String(html || "");
  const titulos = [...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter((m) => /class=["'][^"']*\b(result__a|result-link)\b/i.test(m[1]))
    .map((m) => ({ pos: m.index, href: (m[1].match(/href=["']([^"']+)["']/i) || [])[1], titulo: semEntidades(m[2]) }));
  const trechos = [...h.matchAll(/class=["'][^"']*\b(?:result__snippet|result-snippet)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi)]
    .map((m) => ({ pos: m.index, texto: semEntidades(m[1]) }));
  const resultados = [];
  titulos.forEach((t, i) => {
    const url = enderecoDoResultado(t.href);
    if (!url || !/^https?:\/\//i.test(url) || !t.titulo) return;
    const fim = titulos[i + 1]?.pos ?? Infinity;
    const trecho = trechos.find((s) => s.pos > t.pos && s.pos < fim)?.texto || "";
    resultados.push({ titulo: t.titulo, url, trecho });
  });
  const vistos = new Set();
  return resultados.filter((r) => (vistos.has(r.url) ? false : vistos.add(r.url))).slice(0, max);
}

/** Os itens de um RSS (o Google Notícias, quando o DuckDuckGo não responde). */
export function resultadosDoRss(xml, max = 8) {
  const itens = [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const campo = (item, nome) => semEntidades((item.match(new RegExp(`<${nome}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${nome}>`, "i")) || [])[1] || "");
  return itens
    .map((item) => {
      const data = campo(item, "pubDate");
      const fonte = campo(item, "source");
      return {
        titulo: campo(item, "title"),
        url: campo(item, "link"),
        trecho: [fonte, data ? `publicado em ${data}` : ""].filter(Boolean).join(" · "),
      };
    })
    .filter((r) => r.titulo && /^https?:\/\//i.test(r.url))
    .slice(0, max);
}

// ---- pesquisar -----------------------------------------------------------------------------

const CABECALHOS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.6",
};

const BUSCADORES = [
  { nome: "DuckDuckGo", url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=br-pt`, ler: resultadosDoDuckDuckGo },
  { nome: "DuckDuckGo Lite", url: (q) => `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}&kl=br-pt`, ler: resultadosDoDuckDuckGo },
  { nome: "Google Notícias", url: (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`, ler: resultadosDoRss },
];

/**
 * Pesquisa `consulta` no primeiro buscador que responder com resultados.
 * Devolve { consulta, buscador, resultados, erros } — `resultados` vazio quando nenhum respondeu.
 */
export async function pesquisarNaWeb(consulta, { fetch: buscar = globalThis.fetch, max = 6, tempoMs = 6000, buscadores = BUSCADORES } = {}) {
  const erros = [];
  for (const b of buscadores) {
    try {
      const r = await buscar(b.url(consulta), { headers: CABECALHOS, signal: AbortSignal.timeout(tempoMs) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const resultados = b.ler(await r.text(), max);
      if (resultados.length) return { consulta, buscador: b.nome, resultados, erros };
      erros.push(`${b.nome}: nenhum resultado`);
    } catch (err) {
      erros.push(`${b.nome}: ${err?.message || err}`);
    }
  }
  return { consulta, buscador: null, resultados: [], erros };
}

// ---- ler as páginas ------------------------------------------------------------------------
//
// Medido em 01/11/2026: com o urlContext, o Gemini levou 26s e 54s para abrir as páginas da
// pesquisa (e uma delas falhou); lidas aqui, em paralelo, as três chegam em ~2s e a resposta sai
// em ~5s. O urlContext fica para o site que a pessoa citou (1,3s) e para quando a leitura daqui falha.

/** O texto legível de uma página HTML: sem script, estilo, menu e rodapé; o <main>/<article> se houver. */
export function textoDaPagina(html, limite = 6000) {
  let h = String(html || "").slice(0, 600_000);
  h = h.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const principal = h.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  if (principal && principal.replace(/<[^>]+>/g, "").trim().length > 400) h = principal;
  h = h.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  h = h.replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>|<br\s*\/?>/gi, "\n");
  const texto = semEntidades(h.replace(/\n/g, " ¶ ")).split("¶").map((l) => l.trim()).filter((l) => l.length > 1).join("\n");
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

const SITES_QUE_NAO_ABREM = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com|npmjs\.com|news\.google\.com)$/i;

/** Lê as primeiras páginas dos resultados, em paralelo: [{ titulo, url, texto }] das que abriram. */
export async function lerPaginas(resultados, { fetch: buscar = globalThis.fetch, max = 3, tempoMs = 4500, limite = 6000 } = {}) {
  const candidatas = (resultados || []).filter((r) => !SITES_QUE_NAO_ABREM.test(dominioDe(r.url))).slice(0, max + 1);
  const lidas = await Promise.all(candidatas.map(async (r) => {
    try {
      const resp = await buscar(r.url, { headers: { ...CABECALHOS, accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(tempoMs), redirect: "follow" });
      if (!resp.ok || !/html|text\/plain/i.test(resp.headers?.get?.("content-type") || "text/html")) return null;
      const texto = textoDaPagina(await resp.text(), limite);
      return texto.length >= 300 ? { titulo: r.titulo, url: r.url, texto } : null;
    } catch {
      return null;
    }
  }));
  return lidas.filter(Boolean).slice(0, max);
}

// ---- o que vai para o Gemini ---------------------------------------------------------------

/**
 * As ferramentas do Gemini para a pergunta. A busca do Google sai (as chaves de hoje não têm cota
 * para ela, ver o topo) a menos que `buscaDoGoogle`; a leitura de páginas entra quando a pessoa
 * pediu internet ou o escopo é o "Geral". undefined = nenhuma.
 */
export function ferramentasDaPergunta(pergunta, ferramentasDoEscopo, { buscaDoGoogle = BUSCA_DO_GOOGLE } = {}) {
  const doEscopo = ferramentasDoEscopo || [];
  const escopoComBusca = doEscopo.some((f) => f?.googleSearch);
  const lista = doEscopo.filter((f) => f && (buscaDoGoogle || !f.googleSearch));
  const tem = (nome) => lista.some((f) => f[nome]);
  const web = pedeInternet(pergunta);
  if (web && buscaDoGoogle && !tem("googleSearch")) lista.push({ googleSearch: {} });
  if ((web || escopoComBusca) && !tem("urlContext")) lista.push({ urlContext: {} });
  return lista.length ? lista : undefined;
}

function dataDeHoje(agora = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(agora);
}

/**
 * A nota do prompt quando a pessoa pediu internet: o texto das páginas lidas (ou, se nenhuma abriu,
 * os resultados para o Gemini abrir), os sites citados, e as regras — dizer de onde veio, não
 * inventar, não ler endereço em voz alta. null quando a pergunta não pede internet.
 */
export function notaDaWeb(pergunta, { pesquisa = null, paginas = [], buscaDoGoogle = BUSCA_DO_GOOGLE, agora = new Date() } = {}) {
  if (!pedeInternet(pergunta)) return null;
  const enderecos = enderecosDoTexto(pergunta);
  const linhas = [`A PESSOA PEDIU PARA OLHAR NA INTERNET (hoje é ${dataDeHoje(agora)}).`];
  if (enderecos.length) {
    linhas.push(`LEIA as páginas citadas com a ferramenta de contexto de URL antes de responder: ${enderecos.join(" , ")}`);
  }
  if (pesquisa?.resultados?.length && paginas.length) {
    linhas.push(
      `Pesquisei "${pesquisa.consulta}" (${pesquisa.buscador}) e li as primeiras páginas. Responda com o que está nelas, ` +
        "comparando as fontes quando discordarem e preferindo as oficiais e as mais recentes.",
      "PÁGINAS LIDAS:",
      ...paginas.map((p, i) => `[${i + 1}] ${p.titulo} — ${p.url}\n${p.texto}`),
      "OUTROS RESULTADOS (só o trecho do buscador):",
      ...pesquisa.resultados.filter((r) => !paginas.some((p) => p.url === r.url)).map((r) => `- ${r.titulo} — ${r.url}${r.trecho ? `: ${r.trecho}` : ""}`),
    );
  } else if (pesquisa?.resultados?.length) {
    linhas.push(
      `Pesquisei "${pesquisa.consulta}" (${pesquisa.buscador}), mas as páginas não abriram daqui. ABRA as 2 ou 3 mais ` +
        "promissoras com a ferramenta de contexto de URL e responda com o que está nelas (o trecho do buscador é só uma " +
        "prévia e pode estar velho). Prefira fontes oficiais e recentes.",
      "RESULTADOS DA PESQUISA:",
      ...pesquisa.resultados.map((r, i) => `${i + 1}. ${r.titulo} — ${r.url}${r.trecho ? `\n   ${r.trecho}` : ""}`),
    );
  } else if (pesquisa) {
    linhas.push(`A pesquisa por "${pesquisa.consulta}" não funcionou agora (o buscador não respondeu). Diga isso com franqueza e responda só o que você já sabe, avisando que pode estar desatualizado.`);
  } else if (buscaDoGoogle) {
    linhas.push("Use a busca do Google para responder com informação atual.");
  }
  linhas.push(
    "Diga de qual site veio cada informação e não invente: se a página não abriu ou não tinha a resposta, diga isso. " +
      "Os links das fontes aparecem sozinhos na tela embaixo da resposta: não escreva nem leia endereços em voz alta.",
  );
  return linhas.join("\n");
}

/**
 * Prepara a internet para uma pergunta: as ferramentas, a nota do prompt e — quando a pessoa pediu
 * para pesquisar (sem citar um site e sem a busca do Google ligada) — a pesquisa e a leitura das
 * primeiras páginas, feitas aqui. Com páginas lidas, o urlContext sai desta pergunta (o Gemini
 * reabriria as mesmas páginas, devagar). `fontes`: as páginas lidas e depois os outros resultados.
 */
export async function webDaPergunta(pergunta, { turnos = [], ferramentasDoEscopo, buscaDoGoogle = BUSCA_DO_GOOGLE, fetch, agora } = {}) {
  // "sim" depois de "quer que eu pesquise?": pesquisa a pergunta anterior
  const aceite = aceitouPesquisar(pergunta, turnos);
  if (aceite) return webDaPergunta(`pesquise na internet: ${aceite}`, { ferramentasDoEscopo, buscaDoGoogle, fetch, agora });
  let ferramentas = ferramentasDaPergunta(pergunta, ferramentasDoEscopo, { buscaDoGoogle });
  if (!pedeInternet(pergunta)) return { ferramentas, nota: null, pesquisa: null, paginas: [], fontes: [] };
  const comFetch = fetch ? { fetch } : {};
  const pesquisa = !buscaDoGoogle && !enderecosDoTexto(pergunta).length
    ? await pesquisarNaWeb(consultaDaPergunta(pergunta, turnos), comFetch)
    : null;
  const paginas = pesquisa?.resultados?.length ? await lerPaginas(pesquisa.resultados, comFetch) : [];
  if (paginas.length) {
    const sem = (ferramentas || []).filter((f) => !f.urlContext);
    ferramentas = sem.length ? sem : undefined;
  }
  const fontes = [...paginas, ...(pesquisa?.resultados || []).filter((r) => !paginas.some((p) => p.url === r.url)).slice(0, paginas.length ? 1 : 3)]
    .map((r) => ({ titulo: r.titulo, url: r.url }));
  return { ferramentas, nota: notaDaWeb(pergunta, { pesquisa, paginas, buscaDoGoogle, agora }), pesquisa, paginas, fontes };
}

/**
 * As fontes da resposta: as páginas que o Gemini abriu (`urlMetadata`) e as da busca do Google
 * (`groundingChunks`), e depois `extras` — as da pesquisa feita aqui (webDaPergunta). [{ titulo, url, nome? }]:
 * `titulo` é o domínio que aparece no botão, `nome` o título da página (aparece ao passar o mouse).
 */
export function fontesDaBusca(metadados, max = 6, extras = []) {
  const fontes = [];
  const nomes = new Map(extras.map((r) => [r.url, r.titulo]));
  for (const m of [].concat(metadados || [])) {
    for (const c of m?.groundingChunks || []) {
      const url = c?.web?.uri;
      if (url) fontes.push({ titulo: String(c.web.title || "").trim() || dominioDe(url), url });
    }
    for (const u of m?.urlMetadata || []) {
      const url = u?.retrievedUrl;
      if (url && !/ERROR|UNSAFE|PAYWALL/i.test(String(u.urlRetrievalStatus || ""))) fontes.push({ titulo: dominioDe(url), url, nome: nomes.get(url) });
    }
  }
  for (const r of extras) fontes.push({ titulo: dominioDe(r.url), url: r.url, nome: r.titulo });
  const vistos = new Set();
  const rotulos = new Set();
  return fontes
    .filter((f) => /^https?:\/\//i.test(f.url))
    .filter((f) => (vistos.has(f.url) ? false : vistos.add(f.url)))
    .slice(0, max)
    .map(({ titulo, url, nome }) => {
      // duas páginas do mesmo site: a segunda mostra o título dela, não o domínio de novo
      const rotulo = rotulos.has(titulo) && nome ? (nome.length > 40 ? `${nome.slice(0, 39)}…` : nome) : titulo;
      rotulos.add(rotulo);
      return nome ? { titulo: rotulo, url, nome } : { titulo: rotulo, url };
    });
}

export function dominioDe(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return String(url).slice(0, 60); }
}
