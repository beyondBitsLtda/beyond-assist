// O diagrama da Lisa (31/10/2026, BEYOND-0010): "quero que a Lisa desenhe processos na tela usando o
// processmap... eu altero o fluxo e ela interage com esse fluxo".
//
// A Lisa não desenha pixel por pixel: a IA devolve a ESTRUTURA (as formas, com um id curto, o tipo e
// o texto; as ligações; as raias) e o layout é feito aqui, em camadas (Sugiyama simplificado). O
// documento sai no formato do quadro (o ProcessMap em public/diagramas, formato 4). Quando o desenho
// já existe e a pessoa mexeu nele, a forma que continua (mesmo id) fica onde a pessoa deixou; só as
// novas ganham lugar do layout. E o desenho volta para a Lisa como texto (descreverDiagrama): é assim
// que ela "vê" o que a pessoa mudou. Puro: sem rede, sem DOM — testado por `npm run diagrama-check`.

/** As formas que a Lisa usa (o `type` do quadro), com o nome para o prompt, o tamanho e a cor padrão. */
export const FORMAS = {
  terminal: { nome: "início/fim do fluxograma", w: 140, h: 50, cor: "deep" },
  process: { nome: "processo/etapa", w: 160, h: 70 },
  decision: { nome: "decisão (losango; as saídas levam o rótulo, ex. Sim/Não)", w: 180, h: 110, cor: "lilac" },
  data: { nome: "entrada/saída de dados", w: 160, h: 70 },
  document: { nome: "documento", w: 160, h: 80 },
  subprocess: { nome: "subprocesso", w: 160, h: 70 },
  database: { nome: "banco de dados", w: 120, h: 90, cor: "graphite" },
  delay: { nome: "espera", w: 130, h: 70 },
  manual: { nome: "operação manual", w: 160, h: 70 },
  note: { nome: "anotação", w: 170, h: 60, cor: "graphite" },
  bpmnStart: { nome: "evento de início (BPMN)", w: 46, h: 46 },
  bpmnEnd: { nome: "evento de fim (BPMN)", w: 46, h: 46 },
  bpmnTask: { nome: "tarefa (BPMN)", w: 150, h: 70 },
  bpmnUserTask: { nome: "tarefa de usuário (BPMN)", w: 150, h: 70 },
  bpmnServiceTask: { nome: "tarefa de serviço/automática (BPMN)", w: 150, h: 70 },
  bpmnGatewayX: { nome: "gateway exclusivo XOR (BPMN)", w: 56, h: 56 },
  bpmnGatewayParallel: { nome: "gateway paralelo AND (BPMN)", w: 56, h: 56 },
  bpmnTimer: { nome: "evento de tempo (BPMN)", w: 46, h: 46 },
  bpmnMessageEvent: { nome: "evento de mensagem (BPMN)", w: 46, h: 46 },
  bpmnDataObject: { nome: "objeto de dados (BPMN)", w: 50, h: 64 },
  umlInitial: { nome: "nó inicial (UML atividades)", w: 34, h: 34, cor: "deep" },
  umlAction: { nome: "ação (UML atividades)", w: 160, h: 60 },
  umlDecision: { nome: "decisão/junção (UML)", w: 64, h: 64, cor: "lilac" },
  umlFinal: { nome: "nó final (UML)", w: 38, h: 38, cor: "lilac" },
  umlClass: { nome: "classe UML (Nome, --, atributos, --, métodos em linhas)", w: 220, h: 120, cor: "white" },
  ucActor: { nome: "ator / pessoa", w: 60, h: 110 },
  ucCase: { nome: "caso de uso", w: 180, h: 80, cor: "lilac" },
  dbTable: { nome: "tabela (NOME na 1ª linha, uma coluna por linha: PK id: int)", w: 240, h: 120 },
  archBrowser: { nome: "aplicação web", w: 170, h: 110 },
  archMobile: { nome: "app mobile", w: 76, h: 124 },
  archService: { nome: "serviço / API", w: 170, h: 74 },
  archComponent: { nome: "componente", w: 170, h: 74 },
  archQueue: { nome: "fila / mensageria", w: 180, h: 58 },
  archServer: { nome: "servidor", w: 120, h: 120, cor: "graphite" },
  archCloud: { nome: "nuvem / serviço externo", w: 180, h: 110, cor: "lilac" },
  archExternal: { nome: "sistema externo", w: 170, h: 74, cor: "graphite" },
  cloudUsers: { nome: "usuários", w: 170, h: 64, cor: "deep" },
  cloudLoadBalancer: { nome: "balanceador de carga", w: 170, h: 64 },
  cloudGateway: { nome: "API gateway", w: 170, h: 64 },
  cloudCache: { nome: "cache", w: 170, h: 64 },
  cloudCdn: { nome: "CDN", w: 170, h: 64 },
  cloudContainer: { nome: "contêiner", w: 170, h: 64 },
  cloudFunction: { nome: "função serverless", w: 170, h: 64 },
  cloudBucket: { nome: "armazenamento de arquivos (bucket)", w: 170, h: 64 },
  cloudTopic: { nome: "tópico / barramento de eventos", w: 170, h: 64 },
  cloudEtl: { nome: "ETL / pipeline de dados", w: 170, h: 64 },
  cloudMonitor: { nome: "monitoramento", w: 170, h: 64 },
  cloudFirewall: { nome: "firewall", w: 170, h: 64, cor: "red" },
  cloudWarehouse: { nome: "data warehouse", w: 170, h: 64, cor: "graphite" },
  cloudMl: { nome: "modelo de IA", w: 170, h: 64, cor: "lilac" },
  c4Person: { nome: "pessoa (C4)", w: 150, h: 140, cor: "deep" },
  c4System: { nome: "sistema (C4)", w: 210, h: 110, cor: "purple" },
  c4Container: { nome: "contêiner (C4; 2ª linha com a tecnologia entre colchetes)", w: 200, h: 104, cor: "lilac" },
  c4External: { nome: "sistema externo (C4)", w: 210, h: 110, cor: "graphite" },
};
export const TIPOS = Object.keys(FORMAS);
export const COLECOES = ["flow", "bpmn", "uml", "usecase", "db", "arch", "cloud", "c4"];
/** As pontas de ligação que o quadro tem (o id dele). */
export const PONTAS = ["arrow", "open", "none", "triangle", "diamond", "diamondFill", "one", "oneOnly", "many", "oneMany", "zeroMany", "zeroOne"];
const NOMES_DAS_PONTAS = {
  arrow: "seta", open: "seta aberta", none: "sem ponta", triangle: "herança", diamond: "agregação", diamondFill: "composição",
  one: "um", oneOnly: "um e somente um", many: "muitos", oneMany: "um ou muitos", zeroMany: "zero ou muitos", zeroOne: "zero ou um",
};
// as formas que agrupam outras (raias, fronteiras): o que está dentro delas importa
const AGRUPADORES = new Set(["lane", "laneV", "umlSwimlane", "umlPackage", "ucSystem", "dbSchema", "archBoundary", "cloudCluster"]);

export const LIMITES_DO_DESENHO = { formas: 60, ligacoes: 120, texto: 300, documento: 300_000 };

const texto = (v, max) => String(v ?? "").replace(/[ \t]+/g, " ").trim().slice(0, max);
const idLimpo = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// ---------------------------------------------------------------- o desenho que a IA devolve

/**
 * Confere a estrutura que a IA devolveu: { titulo, colecao, explicacao, formas: [{ id, tipo, texto,
 * raia }], ligacoes: [{ de, para, rotulo, tracejada, ponta }] }. Tipo desconhecido vira processo;
 * ligação para forma que não existe sai; ids repetidos ganham sufixo.
 */
export function validarDesenho(bruto) {
  const vistos = new Set();
  const formas = [];
  for (const f of (Array.isArray(bruto?.formas) ? bruto.formas : []).slice(0, LIMITES_DO_DESENHO.formas)) {
    let id = idLimpo(f?.id) || `f${formas.length + 1}`;
    while (vistos.has(id)) id = `${id}-2`;
    vistos.add(id);
    formas.push({
      id,
      tipo: FORMAS[f?.tipo] ? f.tipo : "process",
      // tabela e classe têm várias linhas; o resto, uma
      texto: String(f?.texto ?? "").replace(/\r/g, "").split("\n").map((l) => texto(l, 120)).filter(Boolean).join("\n").slice(0, LIMITES_DO_DESENHO.texto),
      raia: texto(f?.raia, 60),
    });
  }
  if (!formas.length) throw new Error("a Lisa não devolveu nenhuma forma — tente descrever o processo de novo");
  const ids = new Set(formas.map((f) => f.id));
  const pares = new Set();
  const ligacoes = [];
  for (const l of (Array.isArray(bruto?.ligacoes) ? bruto.ligacoes : []).slice(0, LIMITES_DO_DESENHO.ligacoes)) {
    const de = idLimpo(l?.de), para = idLimpo(l?.para);
    if (!ids.has(de) || !ids.has(para) || de === para) continue;
    const rotulo = texto(l?.rotulo, 60);
    const chave = `${de}>${para}>${rotulo}`;
    if (pares.has(chave)) continue;
    pares.add(chave);
    ligacoes.push({ de, para, rotulo, tracejada: Boolean(l?.tracejada), ponta: PONTAS.includes(l?.ponta) ? l.ponta : "arrow" });
  }
  return {
    titulo: texto(bruto?.titulo, 100) || "Processo",
    colecao: COLECOES.includes(bruto?.colecao) ? bruto.colecao : "flow",
    explicacao: String(bruto?.explicacao ?? "").trim().slice(0, 1500),
    formas, ligacoes,
  };
}

// ---------------------------------------------------------------- o layout em camadas

const VAO_X = 60, VAO_Y = 64, MARGEM = 40, CABECA_DA_RAIA = 56, FOLGA_DA_RAIA = 28;

/**
 * As camadas: cada forma fica uma camada depois de quem aponta para ela (o caminho mais longo desde
 * o começo). Ligação que volta para trás (um laço "refazer") não conta, senão não haveria começo.
 * Dentro da camada, a ordem acompanha a média dos pais (menos cruzamentos).
 */
export function camadasDoDesenho(formas, ligacoes) {
  const ordem = new Map(formas.map((f, i) => [f.id, i]));
  const saidas = new Map(formas.map((f) => [f.id, []]));
  for (const l of ligacoes) saidas.get(l.de)?.push(l.para);
  // tira as ligações de volta (as que fecham um ciclo na busca em profundidade)
  const estado = new Map();
  const frente = [];
  const visitar = (v) => {
    estado.set(v, 1);
    for (const w of saidas.get(v) || []) {
      if (estado.get(w) === 1) continue; // volta: fica de fora
      frente.push([v, w]);
      if (!estado.get(w)) visitar(w);
    }
    estado.set(v, 2);
  };
  for (const f of formas) if (!estado.get(f.id)) visitar(f.id);
  const entradas = new Map(formas.map((f) => [f.id, []]));
  for (const [v, w] of frente) entradas.get(w).push(v);
  // camada = 1 + a maior camada dos pais (Kahn, na ordem em que as formas vieram)
  const camada = new Map();
  const grau = new Map(formas.map((f) => [f.id, entradas.get(f.id).length]));
  const fila = formas.filter((f) => !grau.get(f.id)).map((f) => f.id);
  while (fila.length) {
    const v = fila.shift();
    const pais = entradas.get(v);
    camada.set(v, pais.length ? Math.max(...pais.map((p) => camada.get(p))) + 1 : 0);
    for (const [a, w] of frente) if (a === v) { grau.set(w, grau.get(w) - 1); if (!grau.get(w)) fila.push(w); }
  }
  const total = Math.max(0, ...camada.values()) + 1;
  const camadas = Array.from({ length: total }, () => []);
  for (const f of formas) camadas[camada.get(f.id) ?? 0].push(f.id);
  // a ordem dentro da camada: a média da posição dos pais na camada de antes (baricentro)
  for (let c = 1; c < camadas.length; c++) {
    const posicao = new Map(camadas[c - 1].map((id, i) => [id, i]));
    const peso = (id) => {
      const ps = entradas.get(id).filter((p) => posicao.has(p)).map((p) => posicao.get(p));
      return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : Infinity;
    };
    camadas[c].sort((a, b) => peso(a) - peso(b) || ordem.get(a) - ordem.get(b));
  }
  return camadas;
}

/**
 * As posições: sem raias, de cima para baixo (uma camada por linha, centralizada); com raias, da
 * esquerda para a direita (uma camada por coluna) e cada forma na faixa da raia dela.
 */
export function posicoesDoDesenho(desenho) {
  const { formas, ligacoes } = desenho;
  const porId = new Map(formas.map((f) => [f.id, f]));
  const tam = (id) => FORMAS[porId.get(id).tipo] || FORMAS.process;
  const camadas = camadasDoDesenho(formas, ligacoes);
  const pos = new Map();
  const raias = [...new Set(formas.map((f) => f.raia).filter(Boolean))];

  if (!raias.length) {
    const larguras = camadas.map((ids) => ids.reduce((s, id) => s + tam(id).w, 0) + VAO_X * Math.max(0, ids.length - 1));
    const maior = Math.max(...larguras);
    let y = MARGEM;
    camadas.forEach((ids, c) => {
      const altura = Math.max(...ids.map((id) => tam(id).h));
      let x = MARGEM + (maior - larguras[c]) / 2;
      for (const id of ids) {
        const t = tam(id);
        pos.set(id, { x: Math.round(x), y: Math.round(y + (altura - t.h) / 2) });
        x += t.w + VAO_X;
      }
      y += altura + VAO_Y;
    });
    return { pos, raias: [] };
  }

  // com raias: a forma sem raia vai para a primeira
  const raiaDe = (id) => porId.get(id).raia || raias[0];
  const colunas = camadas.map((ids) => Math.max(...ids.map((id) => tam(id).w)));
  const xDaColuna = [];
  let x = MARGEM + CABECA_DA_RAIA + FOLGA_DA_RAIA;
  for (const w of colunas) { xDaColuna.push(x); x += w + VAO_X; }
  const largura = x - VAO_X + FOLGA_DA_RAIA - MARGEM;
  const faixas = [];
  let y = MARGEM;
  for (const r of raias) {
    // a altura da raia: a maior pilha de formas dela numa mesma coluna
    const pilhas = camadas.map((ids) => ids.filter((id) => raiaDe(id) === r));
    const altura = Math.max(150, ...pilhas.map((ps) => ps.reduce((s, id) => s + tam(id).h, 0) + VAO_Y * Math.max(0, ps.length - 1) + FOLGA_DA_RAIA * 2));
    pilhas.forEach((ps, c) => {
      const usada = ps.reduce((s, id) => s + tam(id).h, 0) + VAO_Y * Math.max(0, ps.length - 1);
      let yy = y + (altura - usada) / 2;
      for (const id of ps) {
        const t = tam(id);
        pos.set(id, { x: Math.round(xDaColuna[c] + (colunas[c] - t.w) / 2), y: Math.round(yy) });
        yy += t.h + VAO_Y;
      }
    });
    faixas.push({ nome: r, x: MARGEM, y, w: largura, h: altura });
    y += altura;
  }
  return { pos, raias: faixas };
}

const idDaRaia = (nome) => `raia-${idLimpo(nome) || "sem-nome"}`;

const seEncostam = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Desce a caixa até não encostar em nenhuma das `outras` (cada esbarrão empurra para logo abaixo). */
function semEsbarrar(caixa, outras) {
  const c = { ...caixa };
  for (let volta = 0, mexeu = true; mexeu && volta < 80; volta++) {
    mexeu = false;
    for (const o of outras) if (seEncostam(c, o)) { c.y = Number(o.y) + Number(o.h) + 24; mexeu = true; }
  }
  return c;
}

/**
 * O documento do quadro (formato 4) para o desenho. Com `anterior` (o documento que estava na tela,
 * talvez mexido pela pessoa), a forma que continua com o mesmo id fica onde estava e do tamanho que
 * estava; a nova entra no lugar do layout e só desce se esbarrar em algo que já estava lá.
 */
export function montarDocumento(desenho, anterior = null) {
  const { pos, raias } = posicoesDoDesenho(desenho);
  const antigas = new Map();
  for (const aba of anterior?.pages || []) for (const s of aba.shapes || []) antigas.set(String(s.id), s);
  const ficou = (s) => ({ x: Number(s.x), y: Number(s.y), w: Number(s.w), h: Number(s.h) });
  const raiasQueFicam = [];
  const formasQueFicam = [];
  const shapes = [];
  const novasRaias = [];
  for (const r of raias) {
    const velha = antigas.get(idDaRaia(r.nome));
    if (velha) { shapes.push({ ...velha, text: r.nome }); raiasQueFicam.push(ficou(velha)); }
    else novasRaias.push(r);
  }
  for (const r of novasRaias) {
    const c = semEsbarrar({ x: r.x, y: r.y, w: r.w, h: r.h }, raiasQueFicam);
    // a raia desceu: as formas dela descem junto
    const desceu = c.y - r.y;
    if (desceu) for (const f of desenho.formas) if (f.raia === r.nome && pos.has(f.id)) pos.set(f.id, { ...pos.get(f.id), y: pos.get(f.id).y + desceu });
    shapes.push({ id: idDaRaia(r.nome), type: "lane", ...c, text: r.nome, color: "graphite" });
    raiasQueFicam.push(c);
  }
  for (const f of desenho.formas) {
    const velha = antigas.get(f.id);
    if (velha && velha.type === f.tipo) formasQueFicam.push(ficou(velha));
  }
  for (const f of desenho.formas) {
    const t = FORMAS[f.tipo];
    const velha = antigas.get(f.id);
    let base;
    if (velha && velha.type === f.tipo) base = { x: velha.x, y: velha.y, w: velha.w, h: velha.h, color: velha.color };
    else {
      const p = pos.get(f.id);
      const c = semEsbarrar({ x: p.x, y: p.y, w: t.w, h: t.h }, formasQueFicam);
      formasQueFicam.push(c);
      base = { ...c, color: t.cor || "purple" };
    }
    shapes.push({ id: f.id, type: f.tipo, ...base, text: f.texto });
  }
  const connections = desenho.ligacoes.map((l, i) => ({
    id: `l-${l.de}-${l.para}-${i}`, from: l.de, to: l.para, label: l.rotulo, arrow: l.ponta, dashed: l.tracejada,
  }));
  return {
    format: "processmap", version: 4, name: desenho.titulo, mode: "diagram", activePage: "p1",
    pages: [{ id: "p1", name: desenho.titulo.slice(0, 40), shapes, connections }],
  };
}

// ---------------------------------------------------------------- o desenho de volta para a Lisa

const centro = (s) => ({ x: Number(s.x) + Number(s.w) / 2, y: Number(s.y) + Number(s.h) / 2 });
const dentro = (p, c) => p.x >= Number(c.x) && p.x <= Number(c.x) + Number(c.w) && p.y >= Number(c.y) && p.y <= Number(c.y) + Number(c.h);
const ehNumero = (n) => Number.isFinite(Number(n));
const abasDe = (doc) => (Array.isArray(doc?.pages) && doc.pages.length ? doc.pages : [{ name: "Página 1", shapes: doc?.shapes, connections: doc?.connections }]);

/** A raia (ou fronteira) mais justa que contém o centro da forma. */
function agrupadorDe(s, agrupadores) {
  if (!ehNumero(s.w)) return null;
  return agrupadores.filter((g) => g !== s && dentro(centro(s), g)).sort((a, b) => Number(a.w) * Number(a.h) - Number(b.w) * Number(b.h))[0] || null;
}

/**
 * A estrutura do desenho na tela, no mesmo formato que a IA devolve — é o que vai para a Lisa
 * quando o pedido é mudar o desenho (ela devolve o desenho inteiro, mantendo os ids).
 */
export function estruturaDoDocumento(doc) {
  const aba = abasDe(doc)[0] || { shapes: [], connections: [] };
  const todas = (aba.shapes || []).filter((s) => s && s.type !== "ink" && s.type !== "image");
  const agrupadores = todas.filter((s) => AGRUPADORES.has(s.type) && ehNumero(s.w));
  const formas = todas.filter((s) => !AGRUPADORES.has(s.type)).map((s) => ({
    id: String(s.id), tipo: FORMAS[s.type] ? s.type : s.type || "process",
    texto: String(s.text ?? "").slice(0, LIMITES_DO_DESENHO.texto),
    raia: agrupadorDe(s, agrupadores)?.text || "",
  }));
  const ids = new Set(formas.map((f) => f.id));
  const ligacoes = (aba.connections || []).filter((c) => ids.has(String(c.from)) && ids.has(String(c.to))).map((c) => ({
    de: String(c.from), para: String(c.to), rotulo: String(c.label || ""), tracejada: Boolean(c.dashed), ponta: c.arrow || "arrow",
  }));
  return { titulo: String(doc?.name || aba.name || "Processo"), formas, ligacoes };
}

/** O desenho em texto, para a Lisa ler o que está na tela (o que a pessoa mudou também). */
export function descreverDiagrama(doc) {
  const partes = [];
  for (const aba of abasDe(doc)) {
    const formas = (aba.shapes || []).filter((s) => s && s.type !== "ink");
    if (!formas.length) continue;
    const porId = new Map(formas.map((s) => [String(s.id), s]));
    const agrupadores = formas.filter((s) => AGRUPADORES.has(s.type) && ehNumero(s.w));
    const nome = (s) => FORMAS[s.type]?.nome.replace(/ \(.*$/, "") || (s.type === "lane" ? "raia" : s.type);
    const curto = (id) => {
      const s = porId.get(String(id));
      if (!s) return `[${id}]`;
      const linha = String(s.text ?? "").split(/\r?\n/)[0].trim().slice(0, 60);
      return `[${s.id}] ${nome(s)}${linha ? ` "${linha}"` : ""}`;
    };
    partes.push(`ABA "${aba.name || "Página"}" — ${formas.length} formas, ${(aba.connections || []).length} ligações`);
    for (const s of formas) {
      const conteudo = String(s.text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" | ").slice(0, 200);
      let linha = `- [${s.id}] ${nome(s)}${conteudo ? `: "${conteudo}"` : ""}`;
      if (!AGRUPADORES.has(s.type)) { const g = agrupadorDe(s, agrupadores); if (g) linha += ` (dentro de [${g.id}])`; }
      partes.push(linha);
    }
    for (const c of aba.connections || []) {
      const extras = [
        c.label ? `rótulo "${String(c.label).slice(0, 60)}"` : "",
        c.arrow && c.arrow !== "arrow" ? `ponta: ${NOMES_DAS_PONTAS[c.arrow] || c.arrow}` : "",
        c.dashed ? "tracejada" : "",
      ].filter(Boolean).join("; ");
      partes.push(`- ${curto(c.from)} → ${curto(c.to)}${extras ? ` (${extras})` : ""}`);
    }
  }
  return partes.join("\n").slice(0, 12_000) || "";
}

/**
 * A seção do prompt com o desenho que está no quadro ("" sem quadro aberto). Confere o que veio do
 * navegador (é texto, com teto). A Lisa lê o fluxo como a pessoa deixou e conversa sobre ele.
 */
export function secaoDoDiagrama(texto) {
  const t = typeof texto === "string" ? texto.slice(0, 12_000).trim() : "";
  return t
    ? `\n\nO DIAGRAMA QUE ESTÁ NO QUADRO DA TELA AGORA (a pessoa pode ter mexido nele — é a versão que vale; cada forma tem um id entre colchetes, e "→" é uma ligação). Use-o para responder sobre o processo; se a pessoa pedir código, use o fluxo como especificação:\n${t}`
    : "";
}

/** O documento que veio do navegador, conferido (tamanho, formato); null se não serve. */
export function documentoValido(doc) {
  if (!doc || typeof doc !== "object") return null;
  if (JSON.stringify(doc).length > LIMITES_DO_DESENHO.documento) return null;
  if (!Array.isArray(doc.pages) && !Array.isArray(doc.shapes)) return null;
  return doc;
}

// ---------------------------------------------------------------- quando a conversa pede desenho

const VERBO_DE_DESENHO = /\b(desenh\w*|diagram\w*|mapei\w*|mapeie|modele|monte|crie|cria|fa[çc]a|gere|mostre|esboce|rabisque)\b/i;
const COISA_DESENHAVEL = /\b(processo|fluxo|fluxograma|diagrama|bpmn|workflow|jornada|arquitetura|esteira|pipeline|organograma|swimlane|raias?)\b/i;
const VERBO_DE_MUDANCA = /\b(adicion\w*|acrescent\w*|inclu\w*|coloque|ponha|remov\w*|tir[ae]|apag\w*|exclu\w*|troqu\w*|troc\w*|mud\w*|renome\w*|lig\w*|conect\w*|separ\w*|junt\w*|reorganiz\w*|refa[çz]\w*|corrij\w*|ajust\w*|divid\w*|mov[ae]\w*)\b/i;
const PARTE_DO_DESENHO = /\b(etapa|passo|caixa|forma|raia|decis[aã]o|liga[çc][aã]o|seta|fluxo|diagrama|processo|desenho|quadro|in[ií]cio|fim|tarefa|gateway|evento|swimlane|caminho)s?\b/i;

/**
 * A pergunta pede para desenhar ("novo") ou, com o quadro aberto, para mudar o desenho ("alterar")?
 * null = conversa normal (o desenho na tela vai junto como contexto, se houver).
 */
export function pedidoDeDesenho(pergunta, { quadroAberto = false } = {}) {
  const q = String(pergunta || "");
  if (quadroAberto && VERBO_DE_MUDANCA.test(q) && PARTE_DO_DESENHO.test(q)) return "alterar";
  if (VERBO_DE_DESENHO.test(q) && COISA_DESENHAVEL.test(q)) return quadroAberto && /\b(esse|este|nesse|neste|o mesmo)\b/i.test(q) ? "alterar" : "novo";
  return null;
}
