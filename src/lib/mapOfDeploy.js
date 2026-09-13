// "Map of Deploy": o quadro do Trello que diz ONDE cada aplicação está hospedada, virando um
// painel que também diz SE ela está no ar.
//
// A leitura do quadro é uma convenção, não um esquema:
//   - a LISTA (coluna) é o servidor de hospedagem — CloudFlare, GitHub Pages, Vercel…
//   - a ETIQUETA é a conta em que aquela hospedagem está
//   - a DESCRIÇÃO carrega o link da aplicação
//   - o NOME do card é o nome da aplicação
//
// Este arquivo é só conta e texto — nada de rede, nada de banco. É o que permite testar a
// leitura do quadro e a matemática de disponibilidade em node (npm run deploy-map), sem
// depender do Trello nem do Supabase estarem de pé.

/** Um card sem link não é uma aplicação fora do ar: é uma aplicação que não dá pra checar. */
export const SEM_LINK = "sem-link";

/**
 * Acha o endereço da aplicação na descrição do card.
 *
 * Aceita URL completa, link markdown `[texto](url)` e também um domínio solto — gente cola
 * "meuapp.vercel.app" com a mesma frequência com que cola "https://meuapp.vercel.app", e
 * recusar o segundo caso deixaria o card mudo sem motivo.
 */
export function extrairUrl(desc) {
  const texto = String(desc || "");
  const completa = texto.match(/https?:\/\/[^\s<>"'`)\]]+/i);
  if (completa) return limparFim(completa[0]);

  // domínio solto: exige pelo menos um ponto e um final de 2 a 12 letras, e recusa o que
  // parece nome de arquivo (app.js, foto.png) — senão qualquer descrição vira "link"
  for (const linha of texto.split(/[\s,;]+/)) {
    const m = linha.match(/^([a-z0-9][a-z0-9-]*\.)+[a-z]{2,12}(\/[^\s]*)?$/i);
    if (!m) continue;
    const tld = m[0].split("/")[0].split(".").pop().toLowerCase();
    if (ARQUIVOS.has(tld)) continue;
    return `https://${limparFim(m[0])}`;
  }
  return null;
}

const ARQUIVOS = new Set(["js", "mjs", "ts", "tsx", "jsx", "json", "css", "html", "md", "png", "jpg", "jpeg", "gif", "svg", "pdf", "zip", "txt", "yml", "yaml", "env", "lock", "sql"]);

/** Tira pontuação de fim de frase que o regex agarrou junto com a URL. */
const limparFim = (u) => u.replace(/[.,;:!?)\]}>'"]+$/, "");

/**
 * Cards do Trello → aplicações. `lista` vira servidor, `labels` vira conta, a descrição vira
 * link. Cards sem link continuam na lista, marcados — sumir com eles esconderia justamente o
 * que precisa ser arrumado no quadro.
 */
export function normalizarApps(cards = []) {
  return cards
    .map((c) => {
      const url = extrairUrl(c.desc ?? c.content ?? "");
      return {
        id: String(c.id ?? c.external_id ?? ""),
        nome: (c.name ?? c.title ?? "").trim() || "(sem nome)",
        servidor: (c.list ?? c.metadata?.list ?? "").trim() || "(sem coluna)",
        conta: primeiraEtiqueta(c),
        url,
        cardUrl: c.shortUrl ?? c.url ?? c.metadata?.url ?? null,
        problema: url ? null : SEM_LINK,
      };
    })
    .filter((a) => a.id);
}

function primeiraEtiqueta(c) {
  const cru = c.labels ?? c.metadata?.labels ?? "";
  if (Array.isArray(cru)) return cru.map((l) => (typeof l === "string" ? l : l?.name)).filter(Boolean).join(", ") || null;
  return String(cru).trim() || null;
}

/** Agrupa por servidor, mantendo a ordem das colunas do quadro. */
export function agruparPorServidor(apps = [], ordemDasListas = []) {
  const mapa = new Map();
  for (const a of apps) {
    if (!mapa.has(a.servidor)) mapa.set(a.servidor, []);
    mapa.get(a.servidor).push(a);
  }
  const peso = new Map(ordemDasListas.map((nome, i) => [nome, i]));
  return [...mapa.entries()]
    .map(([servidor, itens]) => ({ servidor, apps: itens.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")) }))
    .sort((a, b) => (peso.get(a.servidor) ?? 999) - (peso.get(b.servidor) ?? 999) || a.servidor.localeCompare(b.servidor, "pt-BR"));
}

/**
 * Como uma resposta HTTP vira estado.
 *
 * "no ar" é só 2xx/3xx. Um 404 na raiz de um deploy não é o site funcionando: é o deploy
 * quebrado respondendo. Por isso há TRÊS estados e não dois — quem respondeu errado (`erro`) e
 * quem não respondeu nada (`fora`) exigem investigações diferentes, e juntar os dois num
 * "offline" só esconderia isso.
 */
export function classificar({ status, erro } = {}) {
  if (erro || status == null) return "fora";
  if (status >= 200 && status < 400) return "no ar";
  return "erro";
}

export const NO_AR = "no ar";
export const ESTADOS = ["no ar", "erro", "fora"];

/**
 * Resumo de disponibilidade de UMA aplicação, a partir das checagens em ordem cronológica.
 *
 * Conta duas coisas diferentes de propósito:
 *   - `falhas`: quantas checagens deram errado (o volume do problema)
 *   - `quedas`: quantas vezes ela CAIU, isto é, passou de no ar pra fora do ar (quantos
 *     episódios). Uma queda de três horas com checagem de 5 em 5 minutos são 36 falhas e UMA
 *     queda — e é a queda que responde "quantas vezes ficou indisponível".
 */
export function resumo(checks = [], agora = Date.now()) {
  const ordenadas = [...checks].sort((a, b) => tempo(a) - tempo(b));
  const total = ordenadas.length;
  if (!total) return { total: 0, ok: 0, falhas: 0, quedas: 0, uptime: null, estado: "desconhecido", desde: null, ultimaQueda: null, msMedio: null, ultima: null };

  let ok = 0;
  let quedas = 0;
  let msSoma = 0;
  let msN = 0;
  let anterior = null;
  let ultimaQueda = null;
  let inicioDoEstado = tempo(ordenadas[0]);

  for (const c of ordenadas) {
    const estado = classificar(c);
    const noAr = estado === NO_AR;
    if (noAr) ok++;
    if (Number.isFinite(c.ms) && noAr) { msSoma += c.ms; msN++; }
    if (anterior !== null && anterior !== estado) {
      inicioDoEstado = tempo(c);
      if (anterior === NO_AR && !noAr) { quedas++; ultimaQueda = tempo(c); }
    }
    anterior = estado;
  }

  const ultima = ordenadas[total - 1];
  return {
    total,
    ok,
    falhas: total - ok,
    quedas,
    uptime: ok / total,
    estado: classificar(ultima),
    desde: inicioDoEstado,
    ultimaQueda,
    msMedio: msN ? Math.round(msSoma / msN) : null,
    ultima: tempo(ultima),
  };
}

const tempo = (c) => {
  const t = c?.checked_at ?? c?.at ?? 0;
  return typeof t === "number" ? t : Date.parse(t) || 0;
};

/** Junta os resumos de todas as aplicações num quadro só — é o cabeçalho do painel. */
export function resumoGeral(apps = []) {
  const comLink = apps.filter((a) => a.url);
  const conta = (e) => comLink.filter((a) => a.resumo?.estado === e).length;
  const comHistorico = comLink.filter((a) => a.resumo?.uptime != null);
  return {
    aplicacoes: apps.length,
    semLink: apps.length - comLink.length,
    noAr: conta(NO_AR),
    comErro: conta("erro"),
    fora: conta("fora"),
    desconhecidas: conta("desconhecido"),
    quedas: comLink.reduce((s, a) => s + (a.resumo?.quedas || 0), 0),
    falhas: comLink.reduce((s, a) => s + (a.resumo?.falhas || 0), 0),
    uptime: comHistorico.length
      ? comHistorico.reduce((s, a) => s + a.resumo.uptime, 0) / comHistorico.length
      : null,
  };
}

/** "há 3 min", "há 2 h", "há 4 d" — o painel inteiro fala em tempo decorrido. */
export function desde(ms, agora = Date.now()) {
  if (!ms) return null;
  const s = Math.max(0, Math.round((agora - ms) / 1000));
  if (s < 60) return "agora há pouco";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} d`;
}
