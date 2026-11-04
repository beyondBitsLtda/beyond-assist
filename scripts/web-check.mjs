// Guarda a Lisa na internet (src/lib/buscaNaWeb.js): quando a pergunta pede para pesquisar ou cita
// um site, a pesquisa e a leitura de páginas ligam em qualquer escopo; quando é sobre os dados da
// pessoa (notas, cards, código), não ligam. A busca do Google do Gemini fica de fora (as chaves não
// têm cota para ela); o DuckDuckGo é lido daqui, e as fontes viram links limpos.

import {
  enderecosDoTexto, pedeInternet, consultaDaPergunta, resultadosDoDuckDuckGo, resultadosDoRss, pesquisarNaWeb, textoDaPagina, lerPaginas,
  ferramentasDaPergunta, notaDaWeb, webDaPergunta, fontesDaBusca, dominioDe, aceitouPesquisar,
} from "../src/lib/buscaNaWeb.js";
import { cleanForSpeech } from "../src/lib/cleanForSpeech.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// um pedaço da página do DuckDuckGo como ela vem (01/11/2026), com um anúncio e entidades
const DDG = `
<div class="result results_links results_links_deep web-result ">
  <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.infomoney.com.br%2Fcotacoes%2Fcambio%2Fmoeda%2Fdolar%2F&amp;rut=34f1">D&oacute;lar hoje - <b>Cota&#231;&#227;o</b> em tempo real</a></h2>
  <a class="result__url" href="//duckduckgo.com/l/?uddg=x">infomoney.com.br</a>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=x">Confira a <b>cotação</b> do dólar hoje &amp; a variação do dia.</a>
</div>
<div class="result results_links results_links_deep result--ad">
  <h2 class="result__title"><a rel="nofollow" class="result__a" href="https://duckduckgo.com/y.js?ad_domain=x">Anúncio</a></h2>
</div>
<div class="result results_links results_links_deep web-result ">
  <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.bcb.gov.br%2Fcotacoes&amp;rut=aa">Cotações - Banco Central</a></h2>
</div>
<div class="result results_links results_links_deep web-result ">
  <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.infomoney.com.br%2Fcotacoes%2Fcambio%2Fmoeda%2Fdolar%2F&amp;rut=zz">Repetido</a></h2>
</div>`;
const LITE = `<table><tr><td><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnextjs.org%2Fblog&amp;rut=1" class='result-link'>Next.js Blog</a></td></tr>
<tr><td class='result-snippet'>Next.js <b>16</b> is now stable.</td></tr>
<tr><td><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Freleases&amp;rut=2" class='result-link'>Releases</a></td></tr></table>`;
const RSS = `<rss><channel><item><title>Dólar fecha em queda - G1</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Sat, 01 Nov 2026 18:00:00 GMT</pubDate><source url="https://g1.globo.com">g1</source></item>
<item><title><![CDATA[Sem link]]></title></item></channel></rss>`;

console.log("\nos endereços na pergunta");
{
  conferir("link completo", igual(enderecosDoTexto("olha https://beyond.dev.br/precos."), ["https://beyond.dev.br/precos"]));
  conferir("domínio solto vira link", igual(enderecosDoTexto("entra no site delp.com.br e me diz"), ["https://delp.com.br"]));
  conferir("www também", enderecosDoTexto("abre www.gov.br/receita")[0] === "https://www.gov.br/receita");
  conferir("nome de arquivo não é site", enderecosDoTexto("o erro está no page.js e no README.md").length === 0);
  conferir("e-mail não é site", enderecosDoTexto("manda para bryan@beyond.dev.br").length === 0);
  conferir("sem repetir e no máximo 5", enderecosDoTexto("a.com a.com b.com c.com d.com e.com f.com").length === 5);
}

console.log("\nquando a Lisa olha a internet");
{
  const sim = [
    "pesquise o preço do dólar hoje",
    "pesquisa pra mim quem ganhou o jogo ontem",
    "procura na internet o horário do metrô",
    "busque no google a documentação do Next 16",
    "abre o site da Receita Federal",
    "o que diz a página https://nextjs.org/blog",
    "lê o delp.com.br e me resume",
    "quais as notícias de hoje? procura aí na web",
    "dá um google em OpenNext Cloudflare",
  ];
  for (const q of sim) conferir(`liga: "${q}"`, pedeInternet(q));
  const nao = [
    "pesquise nas minhas notas sobre o projeto",
    "procure o card do cliente X",
    "o que eu tenho de tarefa hoje?",
    "abre o meu código e acha o erro",
    "me explica o que é uma closure",
    "procura no repositório onde está a rota",
  ];
  for (const q of nao) conferir(`não liga: "${q}"`, !pedeInternet(q));
  conferir("dados da pessoa, mas pediu internet: liga", pedeInternet("procure na internet algo parecido com as minhas notas"));
}

console.log("\no que pesquisar");
{
  const casos = [
    ["pesquise o preço do dólar hoje", "preço do dólar hoje"],
    ["Lisa, pesquisa pra mim quem ganhou o jogo ontem", "quem ganhou o jogo ontem"],
    ["procura na internet o horário do metrô", "horário do metrô"],
    ["busque no google a documentação do Next 16", "documentação do Next 16"],
    ["dá um google em OpenNext Cloudflare", "OpenNext Cloudflare"],
    ["você pode pesquisar sobre a nova lei do PIX?", "nova lei do PIX"],
  ];
  for (const [q, esperado] of casos) {
    const c = consultaDaPergunta(q);
    conferir(`"${q}" → "${esperado}"`, c === esperado, c);
  }
  const turnos = [{ papel: "voce", texto: "o que mudou no imposto de renda 2027?" }, { papel: "lisa", texto: "..." }];
  conferir("\"pesquisa isso\" usa a fala anterior", consultaDaPergunta("pesquisa isso na internet", turnos) === "o que mudou no imposto de renda 2027", consultaDaPergunta("pesquisa isso na internet", turnos));
  conferir("sem fala anterior, fica a pergunta", consultaDaPergunta("pesquisa isso") === "pesquisa isso", consultaDaPergunta("pesquisa isso"));
}

console.log("\nler o buscador");
{
  const r = resultadosDoDuckDuckGo(DDG);
  conferir("DuckDuckGo: tira o redirecionamento, pula anúncio e repetido", igual(r.map((x) => x.url), ["https://www.infomoney.com.br/cotacoes/cambio/moeda/dolar/", "https://www.bcb.gov.br/cotacoes"]), JSON.stringify(r));
  conferir("título e trecho sem HTML nem entidades", r[0].titulo === "Dólar hoje - Cotação em tempo real" && r[0].trecho === "Confira a cotação do dólar hoje & a variação do dia.", JSON.stringify(r[0]));
  conferir("resultado sem trecho não pega o trecho do vizinho", r[1].trecho === "");
  const l = resultadosDoDuckDuckGo(LITE);
  conferir("versão lite também", igual(l.map((x) => [x.titulo, x.url, x.trecho]), [["Next.js Blog", "https://nextjs.org/blog", "Next.js 16 is now stable."], ["Releases", "https://github.com/vercel/next.js/releases", ""]]), JSON.stringify(l));
  const n = resultadosDoRss(RSS);
  conferir("RSS do Google Notícias: só itens com link, com fonte e data", n.length === 1 && n[0].trecho.startsWith("g1 · publicado em"), JSON.stringify(n));
  conferir("página vazia ou estranha: nenhum resultado", resultadosDoDuckDuckGo("").length === 0 && resultadosDoDuckDuckGo("<html>captcha</html>").length === 0);
}

console.log("\npesquisar (com um fetch de mentira)");
{
  const resposta = (status, corpo) => ({ ok: status < 400, status, text: async () => corpo });
  const pedidos = [];
  const so = (mapa) => async (url) => { pedidos.push(url); for (const [k, v] of Object.entries(mapa)) if (url.includes(k)) return typeof v === "function" ? v() : v; throw new Error("fora do ar"); };

  const p1 = await pesquisarNaWeb("cotação do dólar", { fetch: so({ "html.duckduckgo": resposta(200, DDG) }) });
  conferir("o DuckDuckGo respondeu: para nele", p1.buscador === "DuckDuckGo" && p1.resultados.length === 2 && pedidos.length === 1);
  pedidos.length = 0;
  const p2 = await pesquisarNaWeb("next", { fetch: so({ "html.duckduckgo": resposta(202, "<html>anomaly</html>"), "lite.duckduckgo": resposta(200, LITE) }) });
  conferir("DuckDuckGo recusou: vai para o lite", p2.buscador === "DuckDuckGo Lite" && p2.erros.length === 1 && /HTTP 202|nenhum/.test(p2.erros[0]), JSON.stringify(p2.erros));
  const p3 = await pesquisarNaWeb("dólar", { fetch: so({ "news.google": resposta(200, RSS) }) });
  conferir("os dois fora do ar: Google Notícias", p3.buscador === "Google Notícias" && p3.erros.length === 2);
  const p4 = await pesquisarNaWeb("dólar", { fetch: so({}) });
  conferir("nenhum respondeu: resultados vazios, com os erros", p4.buscador === null && p4.resultados.length === 0 && p4.erros.length === 3);
  pedidos.length = 0;
  await pesquisarNaWeb("cotação & câmbio", { fetch: so({ "html.duckduckgo": resposta(200, DDG) }) });
  conferir("a consulta vai codificada na URL", pedidos[0].includes("cota%C3%A7%C3%A3o%20%26%20c%C3%A2mbio"), pedidos[0]);
}

console.log("\nas ferramentas do Gemini");
{
  conferir("pediu internet: só a leitura de páginas (a busca do Google não tem cota)", igual(ferramentasDaPergunta("pesquise a cotação do euro", undefined, { buscaDoGoogle: false }), [{ urlContext: {} }]));
  conferir("escopo Geral: tira a busca do Google e deixa a leitura", igual(ferramentasDaPergunta("me explica closure", [{ googleSearch: {} }], { buscaDoGoogle: false }), [{ urlContext: {} }]));
  conferir("com chave paga (GEMINI_BUSCA_GOOGLE): busca + leitura", igual(ferramentasDaPergunta("pesquise a cotação do euro", undefined, { buscaDoGoogle: true }), [{ googleSearch: {} }, { urlContext: {} }]));
  conferir("com chave paga, no Geral: não duplica", igual(ferramentasDaPergunta("pesquise isso", [{ googleSearch: {} }], { buscaDoGoogle: true }), [{ googleSearch: {} }, { urlContext: {} }]));
  conferir("sem pedido de internet e sem escopo: nenhuma", ferramentasDaPergunta("o que tenho hoje?", undefined, { buscaDoGoogle: false }) === undefined);
  conferir("lista vazia do escopo: nenhuma", ferramentasDaPergunta("oi", [], { buscaDoGoogle: false }) === undefined);
}

console.log("\na nota do prompt");
{
  const agora = new Date("2026-11-01T15:00:00Z");
  conferir("sem internet: sem nota", notaDaWeb("me explica closure") === null);
  const site = notaDaWeb("lê o site beyond.dev.br e me resume", { agora });
  conferir("com site: pede para ler a página e cita o endereço", /LEIA as páginas citadas/.test(site) && site.includes("https://beyond.dev.br"));
  conferir("traz a data de hoje", site.includes("01/11/2026"));
  conferir("pede para dizer a fonte, não inventar e não ler endereço", /de qual site/.test(site) && /não invente/.test(site) && /não escreva nem leia endereços/.test(site));
  const pesquisa = { consulta: "cotação do dólar", buscador: "DuckDuckGo", resultados: resultadosDoDuckDuckGo(DDG) };
  const comResultados = notaDaWeb("pesquise a cotação do dólar", { pesquisa, agora });
  conferir("com pesquisa: os resultados numerados, com link e trecho", /1\. Dólar hoje - Cotação em tempo real — https:\/\/www\.infomoney/.test(comResultados) && /Confira a cotação/.test(comResultados) && /2\. Cotações - Banco Central/.test(comResultados));
  conferir("com pesquisa: pede para abrir as páginas", /ABRA as 2 ou 3 mais/.test(comResultados));
  const semResultado = notaDaWeb("pesquise a cotação do dólar", { pesquisa: { consulta: "cotação do dólar", buscador: null, resultados: [] }, agora });
  conferir("pesquisa falhou: manda dizer com franqueza", /não funcionou agora/.test(semResultado));
}

console.log("\nler as páginas");
{
  const PAGINA = `<html><head><title>x</title><style>.a{}</style><script>var segredo = 1;</script></head><body>
    <nav><a href="/">Menu</a><a href="/b">Outro item do menu</a></nav>
    <main><h1>Dólar hoje</h1><p>O dólar comercial fechou a R$&nbsp;5,42 nesta sexta-feira, alta de 0,87%.</p>
    <p>${"Texto de apoio da matéria. ".repeat(30)}</p><!-- comentário --></main>
    <footer>Todos os direitos reservados</footer></body></html>`;
  const t = textoDaPagina(PAGINA);
  conferir("fica o texto do <main>, em linhas", t.startsWith("Dólar hoje\nO dólar comercial fechou a R$ 5,42"), t.slice(0, 80));
  conferir("sem script, estilo, menu, rodapé e comentário", !/segredo|\.a\{|Menu|direitos|comentário/.test(t));
  conferir("corta no limite", textoDaPagina(PAGINA, 100).length === 101 && textoDaPagina(PAGINA, 100).endsWith("…"));

  const resposta = (status, corpo, tipo = "text/html; charset=utf-8") => ({ ok: status < 400, status, headers: { get: () => tipo }, text: async () => corpo });
  const pedidas = [];
  const fetch = async (url) => {
    pedidas.push(url);
    if (url.includes("lento")) throw new Error("timeout");
    if (url.includes("pdf")) return resposta(200, "%PDF", "application/pdf");
    if (url.includes("vazio")) return resposta(200, "<html><body><p>oi</p></body></html>");
    if (url.includes("erro")) return resposta(403, "proibido");
    return resposta(200, PAGINA);
  };
  const resultados = ["https://www.youtube.com/watch?v=1", "https://lento.com", "https://a.com", "https://pdf.com/x.pdf", "https://b.com", "https://erro.com", "https://c.com", "https://d.com"]
    .map((url, i) => ({ titulo: `R${i}`, url, trecho: "" }));
  const lidas = await lerPaginas(resultados, { fetch });
  conferir("pula os sites que não abrem (YouTube…) sem nem pedir", !pedidas.some((u) => u.includes("youtube")));
  conferir("tenta só as 4 primeiras candidatas, em paralelo", pedidas.length === 4, pedidas.join(" "));
  conferir("fica com as que abriram com texto (falha, PDF e vazia ficam de fora)", igual(lidas.map((l) => l.url), ["https://a.com", "https://b.com"]), JSON.stringify(lidas.map((l) => l.url)));
  conferir("cada página leva título, link e texto", lidas[0].titulo === "R2" && lidas[0].texto.includes("5,42"));
}

console.log("\npreparar a pergunta");
{
  const resposta = (corpo) => ({ ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => corpo });
  const PAGINA = `<main><p>O dólar comercial fechou a R$ 5,42.</p><p>${"Mais texto da matéria. ".repeat(30)}</p></main>`;
  let chamadas = 0;
  const fetch = async (url) => { chamadas++; return resposta(url.includes("duckduckgo") ? DDG : PAGINA); };
  const w1 = await webDaPergunta("Lisa, pesquisa a cotação do dólar", { fetch, buscaDoGoogle: false });
  conferir("pediu para pesquisar: pesquisa e lê as páginas (1 + 2 pedidos)", chamadas === 3 && w1.pesquisa?.consulta === "cotação do dólar" && w1.paginas.length === 2, `${chamadas} ${w1.paginas.length}`);
  conferir("com páginas lidas: o texto vai na nota e o urlContext sai", /PÁGINAS LIDAS/.test(w1.nota) && w1.nota.includes("fechou a R$ 5,42") && w1.ferramentas === undefined);
  conferir("as fontes são as páginas lidas", igual(w1.fontes.map((f) => f.url), ["https://www.infomoney.com.br/cotacoes/cambio/moeda/dolar/", "https://www.bcb.gov.br/cotacoes"]));
  conferir("no escopo Geral, as outras ferramentas ficam", igual((await webDaPergunta("pesquisa a cotação do dólar", { fetch, buscaDoGoogle: false, ferramentasDoEscopo: [{ googleSearch: {} }, { codeExecution: {} }] })).ferramentas, [{ codeExecution: {} }]));
  chamadas = 0;
  const naoAbre = async (url) => { chamadas++; if (url.includes("duckduckgo")) return resposta(DDG); throw new Error("bloqueado"); };
  const w0 = await webDaPergunta("pesquisa a cotação do dólar", { fetch: naoAbre, buscaDoGoogle: false });
  conferir("as páginas não abriram: os resultados vão para o Gemini abrir (urlContext)", w0.paginas.length === 0 && igual(w0.ferramentas, [{ urlContext: {} }]) && /RESULTADOS DA PESQUISA/.test(w0.nota) && /ABRA as 2 ou 3/.test(w0.nota));
  chamadas = 0;
  const w2 = await webDaPergunta("lê o site https://nextjs.org/blog e resume", { fetch, buscaDoGoogle: false });
  conferir("citou o site: não pesquisa, só lê a página", chamadas === 0 && w2.pesquisa === null && /LEIA as páginas citadas/.test(w2.nota));
  const w3 = await webDaPergunta("o que tenho hoje?", { fetch, buscaDoGoogle: false });
  conferir("não pediu internet: nada", chamadas === 0 && w3.nota === null && w3.ferramentas === undefined);
  const oferta = [{ papel: "voce", texto: "quanto está o dólar hoje?" }, { papel: "lisa", texto: "Não tenho a cotação de hoje nos seus dados. Quer que eu pesquise?" }];
  conferir("\"sim\" depois da oferta: pesquisa a pergunta anterior", aceitouPesquisar("sim", oferta) === "quanto está o dólar hoje?" && aceitouPesquisar("pode pesquisar", oferta) === "quanto está o dólar hoje?");
  conferir("\"sim\" sem oferta, ou resposta longa: não", aceitouPesquisar("sim", [{ papel: "voce", texto: "x" }, { papel: "lisa", texto: "Posso mover o card?" }]) === null
    && aceitouPesquisar("sim, mas antes me diga o que tenho para hoje na agenda", oferta) === null && aceitouPesquisar("sim", []) === null);
  chamadas = 0;
  const wSim = await webDaPergunta("sim", { fetch, buscaDoGoogle: false, turnos: oferta });
  conferir("e a pesquisa sai de verdade, com a consulta da pergunta anterior", chamadas === 3 && wSim.pesquisa?.consulta === "quanto está o dólar hoje" && /PÁGINAS LIDAS/.test(wSim.nota), wSim.pesquisa?.consulta);
  chamadas = 0;
  const w4 = await webDaPergunta("pesquise a cotação do dólar", { fetch, buscaDoGoogle: true });
  conferir("com a busca do Google ligada: não pesquisa aqui", chamadas === 0 && w4.pesquisa === null && /busca do Google/.test(w4.nota));
}

console.log("\nas fontes da resposta");
{
  const meta = [
    { groundingChunks: [
      { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "bcb.gov.br" } },
      { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", title: "" } },
      { retrievedContext: { uri: "gs://x" } },
    ] },
    { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "bcb.gov.br" } }] },
    { urlMetadata: [
      { retrievedUrl: "https://nextjs.org/blog", urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" },
      { retrievedUrl: "https://quebrado.com", urlRetrievalStatus: "URL_RETRIEVAL_STATUS_ERROR" },
      { retrievedUrl: "javascript:alert(1)", urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" },
    ] },
  ];
  const fontes = fontesDaBusca(meta);
  conferir("junta busca e páginas lidas, sem repetir", fontes.length === 3, JSON.stringify(fontes));
  conferir("o título da busca é o domínio", fontes[0].titulo === "bcb.gov.br");
  conferir("sem título: usa o domínio do link", fontes[1].titulo === "vertexaisearch.cloud.google.com");
  conferir("página lida entra com o domínio", fontes[2].titulo === "nextjs.org" && fontes[2].url === "https://nextjs.org/blog");
  conferir("página que não abriu fica de fora", !fontes.some((f) => f.url.includes("quebrado")));
  conferir("só http(s): nada de javascript:", !fontes.some((f) => /^javascript:/i.test(f.url)));
  conferir("no máximo 6", fontesDaBusca([{ groundingChunks: Array.from({ length: 10 }, (_, i) => ({ web: { uri: `https://s${i}.com`, title: `s${i}` } })) }]).length === 6);
  conferir("metadados vazios ou estragados", fontesDaBusca(undefined).length === 0 && fontesDaBusca([null, {}, { groundingChunks: null }]).length === 0);

  const resultados = resultadosDoDuckDuckGo(DDG);
  const lidas = fontesDaBusca([{ urlMetadata: [{ retrievedUrl: "https://www.bcb.gov.br/cotacoes", urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" }] }], 6, resultados);
  conferir("pesquisa nossa: a página aberta primeiro, depois os resultados, sem repetir", igual(lidas.map((f) => f.titulo), ["bcb.gov.br", "infomoney.com.br"]), JSON.stringify(lidas));
  conferir("o título do resultado vai junto (aparece ao passar o mouse)", lidas[0].nome === "Cotações - Banco Central");
  conferir("dominioDe tira o www", dominioDe("https://www.gov.br/receita") === "gov.br");
  const mesmoSite = fontesDaBusca([], 6, [{ titulo: "Blog", url: "https://nextjs.org/blog" }, { titulo: "Next.js 16.4 — tudo o que mudou nesta versão do framework", url: "https://nextjs.org/blog/16-4" }]);
  conferir("duas páginas do mesmo site: a segunda mostra o título, cortado", igual(mesmoSite.map((f) => f.titulo), ["nextjs.org", "Next.js 16.4 — tudo o que mudou nesta v…"]), JSON.stringify(mesmoSite.map((f) => f.titulo)));
}

console.log("\na fala");
{
  const f = cleanForSpeech("Segundo o Banco Central (https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes?x=1), o dólar fechou em R$ 5,40.");
  conferir("link solto vira só o site", f.includes("bcb.gov.br") && !/https|estabilidadefinanceira|historicocotacoes/.test(f), f);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
