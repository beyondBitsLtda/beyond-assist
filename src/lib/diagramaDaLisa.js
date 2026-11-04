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

export const LIMITES_DO_DESENHO = { formas: 60, ligacoes: 120, texto: 300, nota: 1500, documento: 300_000, abas: 12 };

/**
 * As cores das formas (01/11/2026: "se eu falar limpe as atividades da cor vermelha do fluxo, ela deve
 * entender e fazer, não apenas o conteúdo"). A chave é o id do ProcessMap (PM.Palette); `nome` é como
 * a pessoa vê a cor no tema da Lisa (a "principal" é azul, não roxa) e `outros`, os jeitos de dizer.
 * A Lisa lê e devolve o nome; o quadro guarda o id.
 */
export const CORES = {
  purple: { nome: "azul", outros: ["azul principal", "principal", "padrao", "normal", "roxo"] },
  deep: { nome: "azul-escuro", outros: ["azul escuro", "marinho", "escuro"] },
  lilac: { nome: "azul-claro", outros: ["azul claro", "claro", "lilas"] },
  graphite: { nome: "grafite", outros: ["cinza", "cinza escuro", "preto"] },
  white: { nome: "branco", outros: ["branca"] },
  green: { nome: "verde", outros: ["concluido", "concluida", "feito"] },
  amber: { nome: "âmbar", outros: ["ambar", "laranja", "amarelo", "amarela", "atencao", "alerta"] },
  red: { nome: "vermelho", outros: ["vermelha", "problema", "erro", "bloqueado"] },
};
export const NOMES_DAS_CORES = Object.values(CORES).map((c) => c.nome);

/** O id da cor a partir do id, do nome ou de um jeito de dizer ("vermelho", "Âmbar", "laranja"); null se não for cor. */
export function corPeloNome(v) {
  const t = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_]+/g, " ").trim();
  if (!t) return null;
  for (const [id, c] of Object.entries(CORES)) {
    const formas = [id, c.nome, ...(c.outros || [])].map((x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_]+/g, " "));
    if (formas.includes(t)) return id;
  }
  return null;
}

/** O nome de uma cor guardada (o id do ProcessMap) — sem cor ou cor estranha é a principal, azul. */
export const nomeDaCor = (id) => (CORES[id] || CORES.purple).nome;

// a lista "pintar" ([{ id, cor }]) por cima das cores de cada item (forma ou galho)
function aplicarPintura(itens, pintar) {
  for (const p of Array.isArray(pintar) ? pintar.slice(0, 200) : []) {
    const cor = corPeloNome(p?.cor);
    const alvo = cor && itens.find((x) => x.id === idLimpo(p?.id));
    if (alvo) alvo.cor = cor;
  }
}

const texto = (v, max) => String(v ?? "").replace(/[ \t]+/g, " ").trim().slice(0, max);
const idLimpo = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// ---------------------------------------------------------------- o desenho que a IA devolve

/**
 * Confere a estrutura que a IA devolveu: { titulo, colecao, explicacao, abaAtiva, abasRemovidas,
 * pintar, abas: [{ id, nome, manter, formas: [{ id, tipo, texto, raia, cor, link }], ligacoes: [{ de,
 * para, rotulo, tracejada, ponta }] }] }. O formato antigo (formas e ligacoes no topo, uma aba só)
 * continua valendo: vira a aba "p1".
 *
 * Abas (01/11/2026: "a Lisa deve poder criar abas dentro dos fluxogramas quando eu pedir"): a aba que
 * o pedido não mexe vem com `manter` (sem formas) e fica como está; a que some da resposta também fica
 * (apagar aba é só pela lista `abasRemovidas` — um esquecimento do modelo não apaga o trabalho de
 * ninguém). `link` liga uma forma a outra aba (o Ctrl+clique do quadro abre a aba).
 *
 * Em cada aba: tipo desconhecido vira processo; ligação para forma que não existe sai; ids repetidos
 * ganham sufixo; `cor` (o nome) vira o id do quadro, e cor que não existe fica de fora (a forma fica
 * com a que tinha, ou a do tipo). `pintar` ([{ aba?, id, cor }]) é a lista das formas que mudaram de
 * cor: vale por cima (o modelo às vezes devolve a forma com a cor antiga e só conta a troca na
 * explicação; a lista à parte ele preenche). Devolve também `formas`/`ligacoes` da primeira aba que
 * muda (o formato de uma aba).
 */
export function validarDesenho(bruto) {
  const brutas = Array.isArray(bruto?.abas) && bruto.abas.length
    ? bruto.abas
    : [{ id: "p1", nome: bruto?.titulo, formas: bruto?.formas, ligacoes: bruto?.ligacoes }];
  const vistas = new Set();
  const abas = [];
  for (const a of brutas.slice(0, LIMITES_DO_DESENHO.abas)) {
    let id = idLimpo(a?.id) || `aba${abas.length + 1}`;
    while (vistas.has(id)) id = `${id}-2`;
    vistas.add(id);
    const nome = texto(a?.nome, 60) || `Página ${abas.length + 1}`;
    if (a?.manter === true) { abas.push({ id, nome, manter: true, formas: [], ligacoes: [] }); continue; }
    const { formas, ligacoes } = formasELigacoes(a);
    if (!formas.length) continue; // aba vazia sai (se ela já existia, fica como estava)
    aplicarPintura(formas, (Array.isArray(bruto?.pintar) ? bruto.pintar : []).filter((x) => !x?.aba || idLimpo(x.aba) === id));
    abas.push({ id, nome, formas, ligacoes });
  }
  if (!abas.some((a) => a.formas.length)) {
    if (!abas.some((a) => a.manter)) throw new Error("a Lisa não devolveu nenhuma forma — tente descrever o processo de novo");
  }
  const primeira = abas.find((a) => a.formas.length) || { formas: [], ligacoes: [] };
  return {
    titulo: texto(bruto?.titulo, 100) || "Processo",
    colecao: COLECOES.includes(bruto?.colecao) ? bruto.colecao : "flow",
    explicacao: String(bruto?.explicacao ?? "").trim().slice(0, 1500),
    abas,
    abasRemovidas: (Array.isArray(bruto?.abasRemovidas) ? bruto.abasRemovidas : []).map(idLimpo).filter(Boolean),
    abaAtiva: idLimpo(bruto?.abaAtiva),
    formas: primeira.formas, ligacoes: primeira.ligacoes,
  };
}

// as formas e as ligações de uma aba, conferidas
function formasELigacoes(a) {
  const vistos = new Set();
  const iguais = new Set(); // id + tipo + texto: a mesma forma repetida pelo modelo (acontece) sai, não vira cópia
  const formas = [];
  for (const f of (Array.isArray(a?.formas) ? a.formas : []).slice(0, LIMITES_DO_DESENHO.formas)) {
    const repetida = `${idLimpo(f?.id)}|${f?.tipo}|${String(f?.texto ?? "").trim()}`;
    if (idLimpo(f?.id) && iguais.has(repetida)) continue;
    iguais.add(repetida);
    let id = idLimpo(f?.id) || `f${formas.length + 1}`;
    while (vistos.has(id)) id = `${id}-2`;
    vistos.add(id);
    // a anotação é texto corrido (conceito, decisões): linhas e total bem maiores que os de uma etapa
    const nota = f?.tipo === "note";
    formas.push({
      id,
      tipo: FORMAS[f?.tipo] ? f.tipo : "process",
      // tabela e classe têm várias linhas; o resto, uma ("\n" escrito ao pé da letra pelo modelo
      // também é quebra de linha: a anotação saía com "\n•" no meio do texto). Na anotação, cada
      // tópico "•" começa numa linha (o modelo às vezes manda todos corridos numa linha só).
      texto: (nota ? String(f?.texto ?? "").replace(/[ \t]+•[ \t]*/g, "\n• ") : String(f?.texto ?? "")).replace(/\r/g, "").replace(/\\n/g, "\n").split("\n").map((l) => texto(l, nota ? 600 : 120)).filter(Boolean).join("\n").slice(0, nota ? LIMITES_DO_DESENHO.nota : LIMITES_DO_DESENHO.texto),
      raia: texto(f?.raia, 60),
      ...(corPeloNome(f?.cor) ? { cor: corPeloNome(f.cor) } : {}),
      ...(idLimpo(f?.link) ? { link: idLimpo(f.link) } : {}),
    });
  }
  const ids = new Set(formas.map((f) => f.id));
  const pares = new Set();
  const ligacoes = [];
  for (const l of (Array.isArray(a?.ligacoes) ? a.ligacoes : []).slice(0, LIMITES_DO_DESENHO.ligacoes)) {
    const de = idLimpo(l?.de), para = idLimpo(l?.para);
    if (!ids.has(de) || !ids.has(para) || de === para) continue;
    const rotulo = texto(l?.rotulo, 60);
    const chave = `${de}>${para}>${rotulo}`;
    if (pares.has(chave)) continue;
    pares.add(chave);
    ligacoes.push({ de, para, rotulo, tracejada: Boolean(l?.tracejada), ponta: PONTAS.includes(l?.ponta) ? l.ponta : "arrow" });
  }
  return { formas, ligacoes };
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
 * talvez mexido pela pessoa), cada aba é tratada por si: a aba que a Lisa mudou é remontada (a forma
 * que continua com o mesmo id fica onde estava, do tamanho e com o que tinha — travada, link,
 * linguagem —, a nova entra no lugar do layout e só desce se esbarrar em algo que já estava lá; as
 * imagens coladas e os rabiscos, que a Lisa não vê, ficam); a aba mantida (ou que ela nem citou) fica
 * exatamente como estava; a aba nova entra no fim; a removida sai.
 */
export function montarDocumento(desenho, anterior = null) {
  const antigas = Array.isArray(anterior?.pages) ? anterior.pages.filter((p) => p && typeof p === "object") : [];
  const novas = (desenho.abas?.length ? desenho.abas : [{ id: "p1", nome: desenho.titulo, formas: desenho.formas, ligacoes: desenho.ligacoes }]).map((a) => ({ ...a }));
  // o formato de uma aba sobre um documento de uma aba: é a mesma aba, seja qual for o id dela
  if (antigas.length === 1 && novas.length === 1 && !novas[0].manter && idLimpo(antigas[0].id) !== novas[0].id) novas[0].id = idLimpo(antigas[0].id);
  const removidas = new Set(desenho.abasRemovidas || []);
  const usadas = new Set();
  const paginas = [];
  const mudadas = [];
  for (const [i, p] of antigas.entries()) {
    const id = String(p.id ?? `p${i + 1}`);
    if (removidas.has(idLimpo(id))) continue;
    const nova = novas.find((a) => a.id === idLimpo(id));
    if (nova) usadas.add(nova);
    if (!nova || nova.manter) { paginas.push({ ...p, id, name: nova?.nome || p.name || `Página ${i + 1}` }); continue; }
    paginas.push({ id, name: nova.nome, ...montarAba(nova, p) });
    mudadas.push(id);
  }
  const criadas = [];
  for (const a of novas) {
    if (usadas.has(a) || a.manter || removidas.has(a.id)) continue;
    let id = a.id || `p${paginas.length + 1}`;
    while (paginas.some((p) => idLimpo(p.id) === idLimpo(id))) id = `${id}-2`;
    paginas.push({ id, name: a.nome, ...montarAba(a, null) });
    criadas.push(id);
  }
  if (!paginas.length) paginas.push({ id: "p1", name: "Página 1", shapes: [], connections: [] });
  // link para aba que não existe (removida, inventada) sai
  const ids = new Set(paginas.map((p) => String(p.id)));
  for (const pg of paginas) for (const sh of pg.shapes || []) if (sh.link != null && !ids.has(String(sh.link))) delete sh.link;
  // a aba que a pessoa vê: a que a Lisa indicou, senão a que ela criou, a que mudou ou a que estava aberta
  const achar = (id) => paginas.find((p) => idLimpo(p.id) === idLimpo(id));
  const ativa = (desenho.abaAtiva && achar(desenho.abaAtiva)) || (criadas[0] && achar(criadas[0]))
    || (mudadas[0] && achar(mudadas[0])) || (anterior?.activePage && achar(anterior.activePage)) || paginas[0];
  return { format: "processmap", version: 4, name: desenho.titulo, mode: "diagram", activePage: String(ativa.id), pages: paginas };
}

/** O tamanho de uma anotação pelo texto: 360 de largura e a altura das linhas (quebradas a ~46 letras). */
export function tamanhoDaNota(txt) {
  const linhas = String(txt ?? "").split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 46)), 0);
  return { w: 360, h: Math.max(60, 26 + linhas * 19) };
}

// a anotação sem ligação vai numa coluna ao lado do desenho (não entra no layout em camadas)
const notaSolta = (f, ligadas) => f.tipo === "note" && !ligadas.has(f.id);

// uma aba remontada: as formas e as ligações da Lisa, com o que a pessoa arrumou na aba de antes
function montarAba(desenho, abaAnterior) {
  const ligadas = new Set(desenho.ligacoes.flatMap((l) => [l.de, l.para]));
  const { pos, raias } = posicoesDoDesenho({ ...desenho, formas: desenho.formas.filter((f) => !notaSolta(f, ligadas)) });
  const antigas = new Map();
  for (const sh of abaAnterior?.shapes || []) antigas.set(String(sh.id), sh);
  const ficou = (sh) => ({ x: Number(sh.x), y: Number(sh.y), w: Number(sh.w), h: Number(sh.h) });
  const raiasQueFicam = [];
  const formasQueFicam = [];
  // as imagens coladas e os rabiscos à mão: a Lisa não os vê, então ficam onde estavam
  const shapes = (abaAnterior?.shapes || []).filter((sh) => sh && (sh.type === "image" || sh.type === "ink"));
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
  // as anotações soltas por último: a coluna delas fica à direita de tudo o que já está na aba
  const ordem = [...desenho.formas.filter((f) => !notaSolta(f, ligadas)), ...desenho.formas.filter((f) => notaSolta(f, ligadas))];
  let colunaDasNotas = null;
  for (const f of ordem) {
    const t = FORMAS[f.tipo];
    const velha = antigas.get(f.id);
    const mesma = velha && velha.type === f.tipo;
    let base;
    if (mesma) {
      base = { x: velha.x, y: velha.y, w: velha.w, h: velha.h, color: velha.color };
      // a anotação que ganhou texto cresce para caber
      if (f.tipo === "note") base.h = Math.max(Number(velha.h) || 0, tamanhoDaNota(f.texto).h);
    } else if (notaSolta(f, ligadas)) {
      const tam = tamanhoDaNota(f.texto);
      if (!colunaDasNotas) {
        const caixas = [...shapes, ...formasQueFicam].filter((x) => ehNumero(x.x) && ehNumero(x.w));
        colunaDasNotas = caixas.length
          ? { x: Math.max(...caixas.map((x) => Number(x.x) + Number(x.w))) + 60, y: Math.min(...caixas.map((x) => Number(x.y))) }
          : { x: MARGEM, y: MARGEM };
      }
      const c = semEsbarrar({ x: colunaDasNotas.x, y: colunaDasNotas.y, ...tam }, formasQueFicam);
      colunaDasNotas.y = c.y + c.h + 24;
      formasQueFicam.push(c);
      base = { ...c, color: velha?.color || t.cor || "graphite" };
    } else {
      const p = pos.get(f.id);
      const tam = f.tipo === "note" ? tamanhoDaNota(f.texto) : { w: t.w, h: t.h };
      const c = semEsbarrar({ x: p.x, y: p.y, ...tam }, formasQueFicam);
      formasQueFicam.push(c);
      base = { ...c, color: velha?.color || t.cor || "purple" };
    }
    // a cor que a Lisa devolveu ("pinte de verde", ou a mesma que já tinha) vale por cima
    if (f.cor) base.color = f.cor;
    // o que a forma tinha e a Lisa não vê (travada, linguagem, fonte) continua
    const forma = { ...(mesma ? velha : {}), id: f.id, type: f.tipo, ...base, text: f.texto };
    if (f.link) forma.link = f.link;
    shapes.push(forma);
  }
  // a ligação que continua (mesmas pontas) guarda o estilo e as portas que a pessoa escolheu
  const ligacoesAntigas = abaAnterior?.connections || [];
  const connections = desenho.ligacoes.map((l, i) => {
    const velha = ligacoesAntigas.find((c) => String(c.from) === l.de && String(c.to) === l.para);
    return { ...(velha || {}), id: velha?.id || `l-${l.de}-${l.para}-${i}`, from: l.de, to: l.para, label: l.rotulo, arrow: l.ponta, dashed: l.tracejada };
  });
  return { shapes, connections };
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

/** Pedido que manda tirar, mover ou refazer: só aí formas que existiam podem sumir do desenho. */
export const PEDE_PARA_TIRAR = /\b(remov|apag|exclu|delet|elimin|limp|tir[ae]|tirar|separ|mov[aei]|refa[çz]|reorganiz|simplifi[cq]|resum[ai]|condens|descart|substitu|troqu|troc|junt|enxug|reduz|recome[cç]|redesenh|desfa[çz]|transform|convert|recri)\w*/i;
/** Pedido que manda mudar o texto do que existe: só aí a anotação que já existia pode ser reescrita. */
export const PEDE_PARA_REESCREVER = /\b(atualiz|reescrev|corri[jg]|edit|alter|reformul|revis|melhor[ae]|ajust|mud[ae]|complement|amplie|ampli[ae]r|expand)\w*/i;
// a nota NOVA ("crie uma nota", "adicione uma anotação") — e não a que existe ("coloque X NA nota", "a
// nota DESSA aba está errada"): só aí a anotação que já existia fica como estava (01/11/2026: "a nota
// está errada, o certo é…" voltava igual, com uma cópia nova ao lado, e a Lisa dizia que tinha corrigido)
const CRIA = /\b(cri[ae]|adicion|acrescent|inclu|ponh|coloqu|insir)\w*/i;
const NOTA = /\b(notas?|note|anota[çc](?:[aã]o|[oõ]es)|coment[aá]rios?)\b/i;
const NA_NOTA = /\b(n[ao]s?|d[ao]s?|ness[ae]s?|dess[ae]s?|nest[ae]s?|dest[ae]s?|à|a)\s+(notas?|note|anota[çc]|coment[aá]ri)/i;
const pedeNotaNova = (p) => CRIA.test(p) && NOTA.test(p) && !PEDE_PARA_REESCREVER.test(p) && !NA_NOTA.test(p.replace(/\b(cri[ae]|adicion|acrescent|inclu|ponh|coloqu|insir)\w*\s+(uma|um|a|as)\s+/gi, " "));

/**
 * Trava contra perda (01/11/2026: pediram notas e a aba "Fluxo Desktop" voltou só com uma raia e o
 * início — o modelo devolveu a aba pela metade, e o resto foi apagado ao gravar): num pedido que só
 * acrescenta ou ajusta (sem PEDE_PARA_TIRAR), toda forma que existia e não veio na resposta volta para
 * o lugar, com o texto, o tipo e as ligações dela. Forma que mudou de aba não conta como sumida.
 * E num pedido de acrescentar ("crie uma nota"), sem pedir para mudar texto (PEDE_PARA_REESCREVER), a
 * anotação que já existia não é reescrita: o modelo reescrevia a nota da pessoa em vez de criar outra —
 * a dela fica igual e o texto novo entra numa anotação nova, ao lado.
 * Devolve { desenho, devolvidas } (devolvidas: formas que voltaram + anotações preservadas).
 */
export function semPerdas(desenho, anterior, pedido) {
  if (!anterior || anterior.mode === "mindmap" || !desenho?.abas?.length || PEDE_PARA_TIRAR.test(String(pedido || ""))) return { desenho, devolvidas: 0 };
  const guardarNotas = pedeNotaNova(String(pedido || ""));
  const est = estruturaDoDocumento(anterior);
  const paginas = abasDe(anterior);
  // a aba velha de cada aba da resposta (uma aba sobre um documento de uma aba é a mesma, como em montarDocumento)
  const velhaDe = (aba) => (est.abas.length === 1 && desenho.abas.length === 1 ? 0 : est.abas.findIndex((v) => idLimpo(v.id) === aba.id));
  // forma que chegou numa aba onde não estava foi movida para lá: na aba de onde saiu, não é perda
  // (o id é por aba — "ini" pode existir em todas)
  const chegaram = new Set();
  for (const aba of desenho.abas) {
    if (aba.manter) continue;
    const i = velhaDe(aba);
    const tinha = new Set(i >= 0 ? est.abas[i].formas.map((f) => idLimpo(f.id)) : []);
    for (const f of aba.formas) if (!tinha.has(f.id)) chegaram.add(f.id);
  }
  let devolvidas = 0;
  for (const aba of desenho.abas) {
    if (aba.manter) continue;
    const i = velhaDe(aba);
    if (i < 0) continue;
    const velha = est.abas[i];
    const originais = new Map((paginas[i]?.shapes || []).map((sh) => [String(sh?.id), sh]));
    const ids = new Set(aba.formas.map((f) => f.id));
    const voltaram = new Set();
    if (guardarNotas) {
      for (const f of [...aba.formas]) {
        const original = originais.get(f.id);
        const antes = String(original?.text ?? "").trim();
        if (f.tipo !== "note" || original?.type !== "note" || !antes || antes === f.texto.trim()) continue;
        let id = `${f.id}-nova`;
        while (ids.has(id)) id = `${id}-2`;
        aba.formas.push({ ...f, id });
        f.texto = String(original.text);
        ids.add(id);
        devolvidas++;
      }
    }
    for (const f of velha.formas) {
      const id = idLimpo(f.id);
      if (!id || ids.has(id) || chegaram.has(id)) continue;
      const original = originais.get(String(f.id));
      aba.formas.push({
        id, tipo: f.tipo, texto: String(original?.text ?? f.texto ?? ""), raia: f.raia || "",
        ...(CORES[original?.color] ? { cor: original.color } : {}), ...(f.link ? { link: idLimpo(f.link) } : {}),
      });
      ids.add(id);
      voltaram.add(id);
      devolvidas++;
    }
    // as ligações das formas que voltaram (uma ligação trocada entre formas que ficaram é decisão do pedido)
    const pares = new Set(aba.ligacoes.map((l) => `${l.de}>${l.para}`));
    for (const l of velha.ligacoes) {
      const de = idLimpo(l.de), para = idLimpo(l.para);
      if (!(voltaram.has(de) || voltaram.has(para)) || !ids.has(de) || !ids.has(para) || pares.has(`${de}>${para}`)) continue;
      aba.ligacoes.push({ de, para, rotulo: String(l.rotulo || ""), tracejada: Boolean(l.tracejada), ponta: PONTAS.includes(l.ponta) ? l.ponta : "arrow" });
      pares.add(`${de}>${para}`);
    }
  }
  return { desenho, devolvidas };
}

/**
 * A estrutura do desenho na tela, no mesmo formato que a IA devolve — é o que vai para a Lisa
 * quando o pedido é mudar o desenho (ela devolve as abas que mudam inteiras, mantendo os ids). Todas
 * as abas vão, com a que está aberta marcada (`abaAtiva`): pedido que não fala de aba é sobre ela.
 */
export function estruturaDoDocumento(doc) {
  const abas = abasDe(doc).map((aba, i) => estruturaDaAba(aba, i));
  const aberta = abas.find((a) => a.id === String(doc?.activePage)) || abas[0];
  return { titulo: String(doc?.name || abas[0]?.nome || "Processo"), abaAtiva: aberta?.id || "p1", abas };
}

/**
 * O que mudou DE VERDADE entre dois documentos (01/11/2026: "eu peço algo específico, ela diz que
 * corrigiu, mas não corrige" — a resposta era a explicação do modelo, e no "Núcleo de Funcionalidades"
 * ela disse "atualizado" com zero mudança). Compara aba por aba, pelo id: abas novas e removidas, formas
 * novas e sumidas, textos, cores, ligações, raias e o que foi movido de lugar ou de galho.
 * Devolve { mudou, texto } — o texto em português, para a conversa ("" se nada mudou).
 */
export function resumoDaMudanca(antes, depois) {
  const mapaDeAbas = (doc) => new Map(abasDe(doc).map((a, i) => [String(a.id ?? `p${i + 1}`), a]));
  const formasDe = (a) => new Map((a?.shapes || []).filter((s) => s && s.type !== "ink" && !AGRUPADORES.has(s.type)).map((s) => [String(s.id), s]));
  const raiasDe = (a) => (a?.shapes || []).filter((s) => s && AGRUPADORES.has(s.type)).map((s) => String(s.text ?? "").trim()).sort().join("|");
  const txt = (s) => String(s?.text ?? "").replace(/\s+/g, " ").trim();
  const curto = (s) => `"${txt(s).slice(0, 40) || s.type}${txt(s).length > 40 ? "…" : ""}"`;
  const lista = (xs) => `${xs.slice(0, 3).map(curto).join(", ")}${xs.length > 3 ? ` e mais ${xs.length - 3}` : ""}`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const A = mapaDeAbas(antes);
  const D = mapaDeAbas(depois);
  const mapa = depois?.mode === "mindmap";
  const partes = [];
  if ((antes?.mode === "mindmap") !== mapa) partes.push(mapa ? "virou mapa mental" : "virou fluxograma");
  for (const [id, d] of D) {
    const a = A.get(id);
    const nome = d.name || a?.name || id;
    const fd = formasDe(d);
    if (!a) { partes.push(`aba nova "${nome}" (${plural(fd.size, "forma", "formas")})`); continue; }
    const fa = formasDe(a);
    const novas = [...fd.keys()].filter((k) => !fa.has(k)).map((k) => fd.get(k));
    const sumidas = [...fa.keys()].filter((k) => !fd.has(k)).map((k) => fa.get(k));
    const ficaram = [...fd.keys()].filter((k) => fa.has(k));
    const textos = ficaram.filter((k) => txt(fa.get(k)) !== txt(fd.get(k))).map((k) => fd.get(k));
    const cores = ficaram.filter((k) => (fa.get(k).color || "") !== (fd.get(k).color || ""));
    const outras = ficaram.filter((k) => String(fa.get(k).parent ?? "") !== String(fd.get(k).parent ?? "") || String(fa.get(k).link ?? "") !== String(fd.get(k).link ?? "") || fa.get(k).type !== fd.get(k).type);
    const lugar = mapa ? [] : ficaram.filter((k) => Number(fa.get(k).x) !== Number(fd.get(k).x) || Number(fa.get(k).y) !== Number(fd.get(k).y));
    const ligacao = (c) => `${c.from}>${c.to}>${c.label || ""}`;
    const ligA = new Set((a.connections || []).map(ligacao));
    const ligD = new Set((d.connections || []).map(ligacao));
    const ligNovas = [...ligD].filter((x) => !ligA.has(x)).length;
    const ligSumidas = [...ligA].filter((x) => !ligD.has(x)).length;
    const itens = [];
    if (novas.length) itens.push(`+${plural(novas.length, "forma", "formas")} (${lista(novas)})`);
    if (sumidas.length) itens.push(`−${plural(sumidas.length, "forma", "formas")} (${lista(sumidas)})`);
    if (textos.length) itens.push(`${plural(textos.length, "texto mudado", "textos mudados")} (${lista(textos)})`);
    if (cores.length) itens.push(plural(cores.length, "cor trocada", "cores trocadas"));
    if (outras.length) itens.push(plural(outras.length, mapa ? "tópico mudou de galho" : "forma religada", mapa ? "tópicos mudaram de galho" : "formas religadas"));
    if (ligNovas || ligSumidas) itens.push(`ligações ${[ligNovas ? `+${ligNovas}` : "", ligSumidas ? `−${ligSumidas}` : ""].filter(Boolean).join(" ")}`);
    if (raiasDe(a) !== raiasDe(d)) itens.push("raias mudaram");
    if ((a.name || "") !== (d.name || "")) itens.push(`aba renomeada (era "${a.name}")`);
    if (!itens.length && lugar.length) itens.push(`só a posição de ${plural(lugar.length, "forma", "formas")}`);
    if (itens.length) partes.push(`${D.size > 1 || A.size > 1 ? `aba "${nome}": ` : ""}${itens.join(", ")}`);
  }
  for (const [id, a] of A) if (!D.has(id)) partes.push(`aba "${a.name || id}" removida`);
  return { mudou: partes.length > 0, texto: partes.join("; ") };
}

/**
 * O desenho da tela em JSON para o modelo, sem cortar no meio (01/11/2026: o JSON era cortado em 24 mil
 * letras — com várias abas e anotações longas, a última aba chegava pela metade e voltava pela metade,
 * e a aba "Fluxo Desktop" perdeu as formas). Se não couber, entram a aba aberta e as outras na ordem,
 * enquanto couberem; as que sobram vão só com id e nome, marcadas "naoCoube" (o modelo as mantém).
 */
export function estruturaQueCabe(estrutura, limite = 120_000) {
  const json = JSON.stringify(estrutura);
  if (json.length <= limite) return json;
  const ordem = [...estrutura.abas].sort((a, b) => Number(b.id === estrutura.abaAtiva) - Number(a.id === estrutura.abaAtiva));
  const cabem = new Set();
  let usado = 500;
  for (const a of ordem) {
    const n = JSON.stringify(a).length;
    if (usado + n <= limite) { cabem.add(a); usado += n; }
  }
  return JSON.stringify({
    ...estrutura,
    abas: estrutura.abas.map((a) => (cabem.has(a) ? a : { id: a.id, nome: a.nome, naoCoube: true, quantasFormas: a.formas.length })),
  });
}

function estruturaDaAba(aba, i) {
  const todas = (aba.shapes || []).filter((sh) => sh && sh.type !== "ink" && sh.type !== "image");
  const agrupadores = todas.filter((sh) => AGRUPADORES.has(sh.type) && ehNumero(sh.w));
  const formas = todas.filter((sh) => !AGRUPADORES.has(sh.type)).map((sh) => ({
    id: String(sh.id), tipo: FORMAS[sh.type] ? sh.type : sh.type || "process",
    // (a anotação vai inteira: cortada aqui, ela voltaria cortada na próxima mudança)
    texto: String(sh.text ?? "").slice(0, sh.type === "note" ? LIMITES_DO_DESENHO.nota : LIMITES_DO_DESENHO.texto),
    raia: agrupadorDe(sh, agrupadores)?.text || "",
    cor: nomeDaCor(sh.color),
    ...(sh.link != null ? { link: String(sh.link) } : {}),
  }));
  const ids = new Set(formas.map((f) => f.id));
  const ligacoes = (aba.connections || []).filter((c) => ids.has(String(c.from)) && ids.has(String(c.to))).map((c) => ({
    de: String(c.from), para: String(c.to), rotulo: String(c.label || ""), tracejada: Boolean(c.dashed), ponta: c.arrow || "arrow",
  }));
  return { id: String(aba.id ?? `p${i + 1}`), nome: String(aba.name || `Página ${i + 1}`), formas, ligacoes };
}

/**
 * O desenho em texto, para a Lisa ler o que está na tela (o que a pessoa mudou também). `inteiro` (os
 * .md que a Lisa escreve): o texto das formas e das anotações sem corte, e um teto bem maior.
 */
export function descreverDiagrama(doc, { inteiro = false } = {}) {
  if (doc?.mode === "mindmap") return descreverMapa(doc, { inteiro });
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
    const aberta = abasDe(doc).length > 1 && String(aba.id) === String(doc?.activePage) ? " (a que está aberta)" : "";
    partes.push(`ABA "${aba.name || "Página"}" [aba ${aba.id ?? "p1"}]${aberta} — ${formas.length} formas, ${(aba.connections || []).length} ligações`);
    for (const s of formas) {
      const conteudo = String(s.text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" | ").slice(0, inteiro ? LIMITES_DO_DESENHO.nota : 200);
      let linha = `- [${s.id}] ${nome(s)}, ${nomeDaCor(s.color)}${conteudo ? `: "${conteudo}"` : ""}`;
      if (!AGRUPADORES.has(s.type)) { const g = agrupadorDe(s, agrupadores); if (g) linha += ` (dentro de [${g.id}])`; }
      if (s.link != null) linha += ` (abre a aba ${s.link})`;
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
  return partes.join("\n").slice(0, inteiro ? 60_000 : 12_000) || "";
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

// O reconhecimento aguenta erro de digitação (31/10/2026: "quero que desneho ess arquiettrua via
// processmap" caía na conversa normal e a Lisa respondia com Mermaid no editor): cada palavra é
// comparada com as formas certas pela distância de edição (letra trocada, faltando, sobrando ou
// invertida conta 1), com folga que cresce com o tamanho da palavra.
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavrasDe = (texto) => semAcento(texto).split(/[^a-z0-9]+/).filter(Boolean);

/** A distância de edição com transposição ("optimal string alignment"): "desneho" → "desenho" = 1. */
export function distanciaDeEdicao(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const folgaDe = (alvo) => (alvo.length <= 4 ? 0 : alvo.length <= 7 ? 1 : 2);
/** Alguma das palavras é (quase) uma das formas? */
const temQuase = (palavras, formas) => palavras.some((p) => formas.some((f) => p === f
  || (Math.abs(p.length - f.length) <= folgaDe(f) && distanciaDeEdicao(p, f) <= folgaDe(f))));

const IMPERATIVOS_DE_DESENHO = ["desenhe", "desenha", "desenhar", "desenhasse", "desenhando", "diagrame", "diagramar", "mapeie", "mapear", "esboce", "esbocar", "rabisque"];
const VERBOS_DE_DESENHO = [...IMPERATIVOS_DE_DESENHO, "desenho"];
const SUBSTANTIVOS_DE_DESENHO = new Set(["desenho", "desenhos", "desenhado", "desenhada", "desenhista"]);
const VERBOS_GERAIS = ["monte", "montar", "crie", "criar", "cria", "faca", "fazer", "faz", "gere", "gerar", "mostre", "mostrar", "coloque", "ponha", "quero", "preciso"];
const COISAS_FORTES = ["diagrama", "diagramas", "fluxograma", "fluxogramas", "bpmn", "swimlane", "organograma", "processmap"];
const COISAS = [...COISAS_FORTES, "processo", "processos", "fluxo", "fluxos", "arquitetura", "workflow", "jornada", "pipeline", "esteira", "raias", "mapa", "modelagem"];
// (01/11/2026: "corrija a nota", "complete a aba", "arrume o texto" não contavam como mudança — o
// pedido ia para a conversa, que não muda desenho nenhum, e a resposta dizia que tinha corrigido)
const VERBO_DE_MUDANCA = /\b(adicion\w*|acrescent\w*|inclu\w*|coloque|ponha|remov\w*|tir[ae]|apag\w*|exclu\w*|troqu\w*|troc\w*|mud\w*|renome\w*|lig\w*|conect\w*|separ\w*|junt\w*|reorganiz\w*|refa[çz]\w*|corrij\w*|corrig\w*|ajust\w*|divid\w*|mov[ae]\w*|limp\w*|pint\w*|color\w*|destaqu\w*|destac\w*|marqu\w*|deix[ae]\w*|cri[ae]\w*|detalh\w*|complet\w*|arrum\w*|consert\w*|atualiz\w*|reescrev\w*|melhor[ae]\w*|edit[ae]\w*|alter[ae]\w*|insir\w*|acert[ae]\w*|revis[ae]\w*|anot[ae]\w*)\b/i;
const PARTE_DO_DESENHO = /\b(etapa|passo|caixa|forma|raia|decis[aã]o|liga[çc][aã]o|seta|fluxo|fluxograma|diagrama|processo|desenho|quadro|in[ií]cio|fim|tarefa|gateway|evento|swimlane|caminho|mapa|t[oó]pico|galho|atividade|cor|cores|vermelh[ao]|verde|azul|[aâ]mbar|amarel[ao]|laranja|cinza|grafite|branc[ao]|aba|p[aá]gina|subprocesso)s?\b/i;
// (a nota é parte do desenho para mandar o pedido ao PLANO do projeto, que decide; no quadro sem projeto
// não — "crie uma nota da reunião" com o quadro aberto é outra coisa)
const PARTE_OU_NOTA = new RegExp(`${PARTE_DO_DESENHO.source.slice(0, -"s?\\b".length - 1)}|nota|anota[çc][aã]o|anota[çc][oõ]e|coment[aá]rio|r[oó]tulo)s?\\b`, "i");

/** O pedido manda mudar alguma parte de um desenho ("corrija a nota da aba Desktop", "complete o fluxo")? */
export const pedeMudancaNoDesenho = (q) => VERBO_DE_MUDANCA.test(String(q || "")) && PARTE_OU_NOTA.test(String(q || ""));

/**
 * A pergunta pede para desenhar ("novo") ou, com o quadro aberto, para mudar o desenho que está nele
 * ("alterar")? null = conversa normal (o desenho na tela vai junto como contexto, se houver).
 * Citar o quadro ("via processmap", "no quadro de diagramas") já é pedido de desenho.
 */
export function pedidoDeDesenho(pergunta, { quadroAberto = false } = {}) {
  const q = String(pergunta || "");
  const palavras = palavrasDe(q);
  const texto = palavras.join(" ");
  const citaOQuadro = temQuase(palavras, ["processmap"]) || /\bprocess map\b/.test(texto) || /\bquadro de diagramas?\b/.test(texto);
  if (quadroAberto && VERBO_DE_MUDANCA.test(q) && PARTE_DO_DESENHO.test(q)) return "alterar";
  // pergunta sobre um desenho ("meu desenho está certo?") não é pedido — a não ser com o verbo de pedir
  // ("desenho", escrito certinho, é o substantivo: fica a uma letra de "desenhe", mas não pede nada)
  const imperativo = temQuase(palavras.filter((p) => !SUBSTANTIVOS_DE_DESENHO.has(p)), IMPERATIVOS_DE_DESENHO);
  if (q.includes("?") && !citaOQuadro && !imperativo) return null;
  const verbo = temQuase(palavras, VERBOS_DE_DESENHO);
  // "faça um mapa mental sobre…" (01/11/2026): mapa mental é desenho do quadro, como fluxograma
  const mental = pedeMapaMental(texto);
  const pede = citaOQuadro
    || (verbo && (temQuase(palavras, COISAS) || mental || /\bno quadro\b/.test(texto)))
    || (temQuase(palavras, VERBOS_GERAIS) && (temQuase(palavras, COISAS_FORTES) || mental));
  if (!pede) return null;
  // "mude esse desenho", "refaça este fluxo": é o que está na tela; o resto é um desenho novo
  return quadroAberto && /\b(esse|este|nesse|neste|desse|deste|o mesmo) (desenho|diagrama|fluxo|quadro|processo|mapa)\b/.test(texto) ? "alterar" : "novo";
}

// ---------------------------------------------------------------- o tipo e o conteúdo pedidos
//
// (02/11/2026: "ela não respeita fazer exatamente o que eu peço: criar o fluxograma do tipo que eu
// pedir com o conteúdo que eu pedir") O tipo dito ("um BPMN", "diagrama de classes", "com raias") vira
// regra, e não sugestão: num desenho novo (ou num "transforme em…"), as formas que o modelo trouxer de
// outra família são trocadas pela equivalente da família pedida. E o conteúdo dado em lista (tópicos,
// "etapas: A, B e C", "A → B → C") é conferido no desenho pronto: o que faltou volta para o modelo uma vez.

const FLUXO = ["terminal", "process", "decision", "data", "document", "subprocess", "database", "delay", "manual"];

/**
 * Os tipos de desenho que a pessoa pode pedir: `plano` é o nome no plano do projeto (o modelo escolhe
 * um deles), `colecao` a paleta do quadro, `formas` as que valem (a anotação vale em todos). O
 * "fluxograma" genérico só quer dizer "não é mapa mental" — a família fica livre. "Arquitetura" e
 * "nuvem" também não trocam formas: são assunto tanto quanto tipo ("a arquitetura e os requisitos desse
 * exercício" é o passo a passo dele), e o modelo já desenha arquitetura com arch* e cloud*.
 */
export const TIPOS_DE_DESENHO = {
  fluxograma: { nome: "fluxograma", plano: "fluxograma" },
  mapa: { nome: "mapa mental", plano: "mapa mental" },
  simples: { nome: "fluxograma simples", plano: "fluxograma simples", colecao: "flow", formas: FLUXO },
  raias: { nome: "fluxograma com raias (swimlane)", plano: "raias", colecao: "flow", formas: FLUXO, raias: true },
  bpmn: { nome: "BPMN", plano: "bpmn", colecao: "bpmn", formas: TIPOS.filter((t) => t.startsWith("bpmn")) },
  atividades: { nome: "UML de atividades", plano: "uml de atividades", colecao: "uml", formas: ["umlInitial", "umlAction", "umlDecision", "umlFinal"] },
  classes: { nome: "diagrama de classes (UML)", plano: "diagrama de classes", colecao: "uml", formas: ["umlClass"] },
  casos: { nome: "casos de uso (UML)", plano: "casos de uso", colecao: "usecase", formas: ["ucActor", "ucCase"] },
  dados: { nome: "modelo de dados", plano: "modelo de dados", colecao: "db", formas: ["dbTable"] },
  c4: { nome: "C4", plano: "c4", colecao: "c4", formas: ["c4Person", "c4System", "c4Container", "c4External"] },
  arquitetura: { nome: "arquitetura de software", plano: "arquitetura" },
  nuvem: { nome: "arquitetura de nuvem", plano: "nuvem" },
};
/** Os nomes do plano (o enum que o modelo do plano escolhe). */
export const TIPOS_NO_PLANO = Object.values(TIPOS_DE_DESENHO).map((t) => t.plano);
/** O id do tipo a partir do id ou do nome do plano ("uml de atividades" → "atividades"); null se não for tipo. */
export function idDoTipo(v) {
  const t = String(v ?? "").trim().toLowerCase();
  if (TIPOS_DE_DESENHO[t]) return t;
  return Object.keys(TIPOS_DE_DESENHO).find((id) => TIPOS_DE_DESENHO[id].plano === t) || null;
}

// as menções de tipo no texto (sem acento, minúsculo); na ordem: a de cima ganha quando duas se sobrepõem
const MENCOES = [
  ["mapa", /\bmapas? ment(al|ais)\b|\bmind ?maps?\b/g],
  ["bpmn", /\bbpmn\b/g],
  ["classes", /\b(diagramas?|uml) de class(e|es)\b/g],
  ["casos", /\b((diagramas?|uml) de )?casos? de uso\b|\buse ?cases?\b/g],
  ["atividades", /\b(diagramas?|uml) de atividades?\b|\buml\b/g],
  ["dados", /\b(modelos?|diagramas?|modelagem) (de dados|entidade relacionamento|er|relacional)\b|\b(der|mer)\b|\bentidade relacionamento\b/g],
  ["c4", /\bc4\b/g],
  ["simples", /\b(fluxogramas?|fluxos?|diagramas?) (simples|tradicional|classico|padrao|comum|basico)\b/g],
  ["nuvem", /\b(arquitetura|diagrama|desenho)s? (de|da|na|em) nuvem\b|\bcloud\b|\baws\b|\bazure\b|\bgcp\b/g],
  ["arquitetura", /\barquitetura\b/g],
  ["raias", /\bswim ?lanes?\b|\b(com|em|por) raias?\b|\braias\b/g],
];
// o que é "o jeito de desenhar" (e não o assunto): ganha do assunto ("a arquitetura em BPMN" é BPMN)
const NOTACOES = new Set(["mapa", "bpmn", "classes", "casos", "atividades", "dados", "c4", "simples"]);
const GENERICO = /\b(fluxogramas?|fluxos?|diagramas?|desenhos?|processos?|esquemas?)\b/g;
const CRIAR = /\b(faca|facam|faz|fazer|crie|cria|criar|monte|monta|montar|gere|gera|gerar|desenhe|desenha|desenhar|elabore|elaborar|construa|construir|estruture|estruturar|modele|modelar|organize|organizar|quero|queria|preciso|gostaria|mostre|mostrar|coloque|colocar|ponha|bote|botar|transforme|transformar|converta|converter|refaca|refazer|redesenhe|redesenhar|passe|passar)\b/;
// "transforme esse fluxo EM mapa mental", "refaça como BPMN", "passe para UML"
const TRANSFORMA = /\b(transform|convert|vir[ae]|pass[ae]|refac|refaz|redesenh|mud[ae]|troqu|troc)\w*\b[^.;\n]{0,60}?\b(em|para|pra|como|num|numa)\s+(um\s+|uma\s+)?/g;
// o tipo depois do desenho só é o tipo DELE quando vem colado ("fluxograma BPMN") ou depois de
// "em/usando/tipo/estilo…" ("a arquitetura em BPMN") — "um fluxograma a partir do mapa mental" é fluxograma
const QUALIFICA = /(^|\s)(em|usando|tipo|estilo|formato|notacao|como|modelo|padrao)\s*$/;
// o texto para achar o tipo: sem acento, minúsculo, só letras, números e o fim de frase
const textoDoTipo = (s) => semAcento(s).replace(/[^a-z0-9.;\n]+/g, " ").replace(/ {2,}/g, " ");

function mencoes(t) {
  const achadas = [];
  for (const [id, re] of MENCOES) {
    for (const m of t.matchAll(re)) {
      const ini = m.index, fim = m.index + m[0].length;
      if (!achadas.some((a) => a.ini < fim && ini < a.fim)) achadas.push({ id, ini, fim });
    }
  }
  return achadas.sort((a, b) => a.ini - b.ini);
}

// o tipo do primeiro desenho dito no trecho (até o fim da frase): o dito de cara ("um BPMN", "a
// arquitetura") ou o genérico ("um fluxograma"), com o que o qualifica ("fluxograma BPMN", "a
// arquitetura em C4", "fluxograma com raias"); o genérico sem qualificação é "fluxograma"
function tipoDoTrecho(trecho) {
  const fim = trecho.search(/[.;\n]/);
  const t = fim < 0 ? trecho : trecho.slice(0, fim);
  const ms = mencoes(t);
  const generico = [...t.matchAll(GENERICO)][0];
  if (!ms.length && !generico) return null;
  const ehGenerico = Boolean(generico) && !(ms[0] && ms[0].ini <= generico.index);
  const depois = ehGenerico ? generico.index + generico[0].length : ms[0].fim;
  for (const m of ms) {
    if (m.ini < depois) continue;
    if (m.id === "raias" && ehGenerico) return "raias";
    const antes = t.slice(depois, m.ini);
    if (NOTACOES.has(m.id) && (!antes.trim() || QUALIFICA.test(antes))) return m.id;
  }
  return ehGenerico ? "fluxograma" : ms[0].id;
}

/**
 * O tipo que um "transforme em…" pede ("transforme esse fluxo em mapa mental", "refaça como BPMN",
 * "passe para fluxograma" = o clássico), ou null — "mude a cor para verde" não é transformar.
 */
export function tipoDaTransformacao(pedido) {
  const t = textoDoTipo(pedido);
  for (const tr of t.matchAll(TRANSFORMA)) {
    const alvo = tipoDoTrecho(t.slice(tr.index + tr[0].length, tr.index + tr[0].length + 80));
    if (alvo) return alvo === "fluxograma" ? "simples" : alvo;
  }
  return null;
}

/**
 * O tipo de desenho que o pedido pede (o id de TIPOS_DE_DESENHO), ou null se ele não diz. Vale o alvo
 * de um "transforme em…"; senão o primeiro desenho depois do verbo ("faça um BPMN…", "crie um
 * fluxograma com raias…"); sem verbo, o único tipo citado.
 */
export function tipoPedido(pedido) {
  const t = textoDoTipo(pedido);
  if (!t.trim()) return null;
  const alvo = tipoDaTransformacao(pedido);
  if (alvo) return alvo;
  const v = t.match(CRIAR);
  if (v) {
    const trecho = t.slice(v.index + v[0].length, v.index + v[0].length + 120);
    const id = tipoDoTrecho(trecho);
    if (id) return id;
  }
  const ids = [...new Set(mencoes(t).map((m) => m.id))];
  const notacoes = ids.filter((id) => NOTACOES.has(id));
  if (notacoes.length === 1) return notacoes[0];
  if (!notacoes.length && ids.length === 1) return ids[0];
  return null;
}

// o papel de uma forma, para achar a equivalente em outra família
function papelDa(f, ligacoes) {
  const t = f.tipo;
  if (t === "bpmnStart" || t === "umlInitial") return "inicio";
  if (t === "bpmnEnd" || t === "umlFinal") return "fim";
  if (t === "terminal") {
    const entra = ligacoes.some((l) => l.para === f.id);
    const sai = ligacoes.some((l) => l.de === f.id);
    return /\b(fim|final|termin|encerr|end)\w*/i.test(f.texto) || (entra && !sai) ? "fim" : "inicio";
  }
  if (["decision", "bpmnGatewayX", "bpmnGatewayParallel", "umlDecision"].includes(t)) return "decisao";
  if (["delay", "bpmnTimer"].includes(t)) return "espera";
  if (["data", "document", "bpmnDataObject", "bpmnMessageEvent"].includes(t)) return "dado";
  if (["database", "dbTable", "cloudWarehouse", "cloudBucket"].includes(t)) return "banco";
  if (["ucActor", "c4Person", "cloudUsers", "bpmnUserTask", "manual"].includes(t)) return "pessoa";
  if (["archExternal", "c4External", "archCloud"].includes(t)) return "externo";
  if (["bpmnServiceTask", "archService", "archComponent", "c4Container", "c4System", "cloudFunction", "cloudContainer", "archServer"].includes(t)) return "sistema";
  return "etapa";
}
const EQUIVALENTES = {
  simples: { inicio: "terminal", fim: "terminal", decisao: "decision", espera: "delay", dado: "data", banco: "database", pessoa: "manual", padrao: "process" },
  bpmn: { inicio: "bpmnStart", fim: "bpmnEnd", decisao: "bpmnGatewayX", espera: "bpmnTimer", dado: "bpmnDataObject", banco: "bpmnDataObject", pessoa: "bpmnUserTask", sistema: "bpmnServiceTask", padrao: "bpmnTask" },
  atividades: { inicio: "umlInitial", fim: "umlFinal", decisao: "umlDecision", padrao: "umlAction" },
  classes: { padrao: "umlClass" },
  casos: { pessoa: "ucActor", padrao: "ucCase" },
  dados: { padrao: "dbTable" },
  c4: { pessoa: "c4Person", externo: "c4External", padrao: "c4Container" },
};
EQUIVALENTES.raias = EQUIVALENTES.simples;

/**
 * Põe o desenho na família do tipo pedido: a "colecao" passa a ser a do tipo, e cada forma de outra
 * família vira a equivalente (o início de um fluxograma vira o evento de início no BPMN, a decisão vira
 * o gateway…), com o mesmo id, texto e raia. A anotação fica. Devolve quantas formas foram trocadas.
 */
export function naFamilia(desenho, tipo) {
  const t = TIPOS_DE_DESENHO[tipo];
  if (!t?.formas || !desenho?.abas) return { desenho, trocadas: 0 };
  const vale = new Set([...t.formas, "note"]);
  const eq = EQUIVALENTES[tipo];
  let trocadas = 0;
  for (const aba of desenho.abas) {
    if (aba.manter) continue;
    for (const f of aba.formas) {
      if (vale.has(f.tipo)) continue;
      const papel = papelDa(f, aba.ligacoes);
      f.tipo = eq[papel] || eq.padrao;
      trocadas++;
    }
  }
  desenho.colecao = t.colecao;
  return { desenho, trocadas };
}

const LISTA_NA_LINHA = /^\s*(?:[-*•–]|\d{1,2}\s*[.)º°-])\s+(.+?)\s*$/;
const LISTA_DEPOIS_DE = /\b(etapas|passos|atividades|topicos|fases|itens|partes|areas|raias|tarefas|subtopicos|telas|funcionalidades|requisitos)\b[^:\n]{0,40}:\s*([^\n]+)/gi;
const limparItem = (s) => String(s).replace(/^["“'`]+|["”'`.;:,!?]+$/g, "").replace(/\s+/g, " ").trim();
const palavrasFortes = (s) => palavrasDe(s).filter((p) => p.length >= 3 && !["que", "com", "sem", "para", "pra", "dos", "das", "nos", "nas", "uma", "por", "seu", "sua", "the", "and"].includes(p));

/**
 * O conteúdo que o pedido dá em LISTA, item por item: as linhas com tópico ("- Pagar", "1. Pagar"), as
 * cadeias "A → B → C" e o que vem depois de "as etapas são:" separado por vírgula ou "e". Só os itens de
 * até 10 palavras (o resto é instrução, não o texto de uma forma).
 */
export function itensDoPedido(pedido) {
  const texto = String(pedido || "");
  const itens = [];
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(LISTA_NA_LINHA);
    if (m) itens.push(m[1].split(/:\s+/)[0]);
  }
  for (const frase of texto.split(/[\n.]/)) {
    if (!/→|->|=>/.test(frase)) continue;
    const partes = frase.split(/\s*(?:→|->|=>)\s*/);
    partes[0] = partes[0].split(":").pop();
    itens.push(...partes);
  }
  for (const m of semAcento(texto).matchAll(LISTA_DEPOIS_DE)) {
    // (o trecho vem do texto sem acento: pega o mesmo trecho no original, pela posição)
    const ini = m.index + m[0].length - m[2].length;
    itens.push(...texto.slice(ini, ini + m[2].length).split(/\s*(?:,|;|\be\b)\s*/));
  }
  const vistos = new Set();
  return itens.map(limparItem).filter((i) => {
    const n = palavrasDe(i).length;
    const chave = palavrasDe(i).join(" ");
    if (!n || n > 10 || !palavrasFortes(i).length || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }).slice(0, 60);
}

/** Os textos de um documento do quadro (todas as abas; raias e tópicos do mapa inclusive). */
export const textosDoDocumento = (doc) => abasDe(doc).flatMap((a) => (a.shapes || []).map((s) => String(s?.text ?? ""))).filter(Boolean);

/**
 * Os itens pedidos que não estão em nenhum texto do desenho: um item está lá quando ao menos 2/3 das
 * palavras dele (com 3 letras ou mais) aparecem num mesmo texto — aguentando plural e erro de uma letra.
 */
export function faltandoNoDesenho(itens, textos) {
  const doDesenho = (textos || []).map((t) => palavrasDe(t));
  const bate = (p, w) => p === w || (p.length >= 5 && w.length >= 5 && (p.startsWith(w.slice(0, 5)) && Math.abs(p.length - w.length) <= 3)) || (p.length > 4 && distanciaDeEdicao(p, w) <= 1);
  return (itens || []).filter((item) => {
    const fortes = palavrasFortes(item);
    if (!fortes.length) return false;
    const precisa = Math.ceil(fortes.length * 2 / 3);
    return !doDesenho.some((ws) => fortes.filter((p) => ws.some((w) => bate(p, w))).length >= precisa);
  });
}

/** O que o desenho pronto deixou de cumprir do pedido (frases para o modelo), [] se cumpriu. */
export function oQueFaltou(doc, { itens = [], tipo = null } = {}) {
  const problemas = [];
  const faltando = faltandoNoDesenho(itens, textosDoDocumento(doc));
  if (faltando.length) problemas.push(`faltaram estes itens que a pessoa deu (ponha cada um, com as palavras dela): ${faltando.map((i) => `"${i}"`).join(", ")}`);
  if (TIPOS_DE_DESENHO[tipo]?.raias && !abasDe(doc).some((a) => (a.shapes || []).some((s) => s?.type === "lane"))) {
    problemas.push("a pessoa pediu raias (swimlane) e o desenho veio sem: dê a cada forma a \"raia\" de quem faz a etapa");
  }
  return { problemas, faltando };
}

// ---------------------------------------------------------------- a conversa que entendeu um pedido de desenho
//
// (02/11/2026: "pode fazer a alteração" → "por aqui nesta resposta eu não altero nada; é só me dar o
// comando direto") Quando um pedido de desenho cai na conversa comum, a Lisa diz o que entendeu,
// pergunta "Posso fazer?" e termina com a MARCA; o servidor tira a marca do texto e avisa a página
// (o evento "desenho"), que guarda o pedido — e o "sim" seguinte desenha de verdade.

export const MARCA_DE_DESENHO = "[[DESENHAR]]";

/**
 * Tira a marca do texto que chega aos pedaços (ela pode vir partida entre dois pedaços): `passar`
 * devolve o que já pode ir para a tela, segurando o fim que pode ser o começo da marca; `fim` devolve o
 * que sobrou e se a marca apareceu.
 */
export function filtroDaMarca(marca = MARCA_DE_DESENHO) {
  let guardado = "";
  let marcou = false;
  return {
    passar(pedaco) {
      let t = guardado + String(pedaco ?? "");
      guardado = "";
      for (let i = t.indexOf(marca); i >= 0; i = t.indexOf(marca)) {
        marcou = true;
        t = t.slice(0, i).replace(/[ \t]+$/, "") + t.slice(i + marca.length);
      }
      for (let n = Math.min(marca.length - 1, t.length); n > 0; n--) {
        if (marca.startsWith(t.slice(-n))) { guardado = t.slice(-n); t = t.slice(0, -n); break; }
      }
      return t;
    },
    fim() {
      const resto = guardado;
      guardado = "";
      return { resto, marcou };
    },
  };
}

/** O código parece um diagrama em texto (Mermaid, PlantUML, Graphviz)? — a IDE oferece desenhar no quadro. */
export function pareceDiagramaEmTexto(codigo, linguagem = "") {
  if (/^(mermaid|plantuml|puml|dot|graphviz)$/i.test(String(linguagem || ""))) return true;
  const c = String(codigo || "").trimStart();
  return /^(flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/i.test(c)
    || /^(sequenceDiagram|classDiagram|erDiagram|stateDiagram(-v2)?|journey|gantt|C4Context|C4Container|C4Component|mindmap)\b/.test(c)
    || /^@startuml/i.test(c)
    || /^(strict\s+)?(di)?graph\s+[\w"]*\s*\{/.test(c);
}

// ---------------------------------------------------------------- o mapa mental (01/11/2026)
//
// "Tá faltando no ProcessMap o modo de mapa mental": a Lisa também desenha mapas mentais. No
// ProcessMap o mapa mental é uma árvore — um tema central (mmRoot) e tópicos (mmNode) com "parent" —
// e o próprio quadro faz o layout (public/diagramas/js/MindMap.js): aqui só se monta a árvore. Os
// filhos do tema se alternam entre a direita e a esquerda, e cada galho ganha uma cor.

export const LIMITES_DO_MAPA = { topicos: 8, filhos: 6, netos: 5, total: 70, texto: 120 };
const CORES_DOS_GALHOS = ["green", "deep", "amber", "red", "lilac", "purple", "graphite", "white"];
const ID_DO_TEMA = "raiz";

/**
 * O desenho que sai é um mapa mental? Quando o pedido fala em mapa mental, ou quando há um mapa mental
 * na tela — aí só deixa de ser se o pedido for transformá-lo em fluxograma. (Antes, qualquer
 * "processo" no texto do pedido trocava o mapa por um fluxograma novo, e o pedido de uma nota
 * "explicando as decisões do processo" apagava o mapa.)
 */
export function vaiSerMapaMental(pedido, atual) {
  if (atual?.mode === "mindmap") {
    return !/\b(transform\w*|convert\w*|vir[ae]\w*|refa[cç]a\w*|passe\w*)\b[^.]{0,40}\b(fluxograma|diagrama|bpmn)\b/i.test(String(pedido || ""));
  }
  // (02/11/2026) um fluxograma na tela só vira mapa mental se o pedido mandar transformar — "inclua no
  // fluxo o que está no mapa mental" é mudar o fluxograma
  if (atual) return tipoDaTransformacao(pedido) === "mapa";
  return pedeMapaMental(pedido);
}

/** A pergunta fala em mapa mental ("mapa mental", "mapas mentais", "mind map")? */
export function pedeMapaMental(texto) {
  return /\bmapas? ment(al|ais)\b|\bmind ?maps?\b/.test(semAcento(texto));
}

/**
 * Confere o mapa que a IA devolveu: { titulo, tema, explicacao, topicos: [{ id, texto, cor, filhos: [{ id,
 * texto, filhos: [{ id, texto }] }] }] } — três níveis abaixo do tema, com teto por nível e no total.
 * Tópico sem texto sai; ids limpos e sem repetir; a `cor` (o nome) só vale nos galhos (1º nível).
 */
export function validarMapaMental(bruto) {
  const vistos = new Set([ID_DO_TEMA]);
  let total = 1;
  let n = 0;
  const idDe = (v) => {
    let id = idLimpo(v) || `t${++n}`;
    while (vistos.has(id)) id = `${id}-2`;
    vistos.add(id);
    return id;
  };
  const ramo = (lista, max, nivel) => (Array.isArray(lista) ? lista : []).slice(0, max).flatMap((t) => {
    const txt = texto(String(t?.texto ?? "").replace(/\\n/g, " "), LIMITES_DO_MAPA.texto);
    if (!txt || total >= LIMITES_DO_MAPA.total) return [];
    total++;
    const no = { id: idDe(t?.id), texto: txt };
    if (nivel === 1 && corPeloNome(t?.cor)) no.cor = corPeloNome(t.cor);
    if (nivel < 3) no.filhos = ramo(t?.filhos, nivel === 1 ? LIMITES_DO_MAPA.filhos : LIMITES_DO_MAPA.netos, nivel + 1);
    return [no];
  });
  const topicos = ramo(bruto?.topicos, LIMITES_DO_MAPA.topicos, 1);
  aplicarPintura(topicos, bruto?.pintar);
  return {
    titulo: texto(bruto?.titulo, 80) || texto(bruto?.tema, 80) || "Mapa mental",
    tema: texto(bruto?.tema, LIMITES_DO_MAPA.texto) || texto(bruto?.titulo, 80) || "Tema central",
    explicacao: texto(bruto?.explicacao, 600),
    topicos,
  };
}

/**
 * O documento do quadro (formato 4, modo mapa mental). Com o mapa `anterior` (uma mudança), o que a
 * pessoa arrumou fica: a posição manual (ox, oy), o galho recolhido, a cor e o lado de cada tópico
 * que continua (mesmo id) — e os tópicos mais fundos que a Lisa não vê (abaixo do 3º nível) voltam
 * pendurados onde estavam, se o pai continua. Com `manterTudo` (a trava contra perda: o pedido não
 * manda tirar nada), QUALQUER tópico que existia e não veio na resposta volta, com o galho dele.
 */
export function montarMapaMental(mapa, anterior = null, { manterTudo = false } = {}) {
  const antigos = new Map();
  let temaVelho = null;
  for (const aba of anterior?.mode === "mindmap" ? abasDe(anterior).slice(0, 1) : []) {
    for (const s of aba.shapes || []) {
      if (s && s.type === "mmNode") antigos.set(String(s.id), s);
      if (s && s.type === "mmRoot") temaVelho = String(s.id);
    }
  }
  // o pai de um tópico antigo, já no mapa novo (o tema antigo é o tema de agora)
  const paiDe = (velho) => (String(velho.parent) === temaVelho ? ID_DO_TEMA : String(velho.parent));
  const shapes = [{ id: ID_DO_TEMA, type: "mmRoot", x: -100, y: -28, w: 200, h: 56, text: mapa.tema, color: "purple" }];
  const pendurar = (lista, pai, nivel) => lista.forEach((t, i) => {
    const velho = antigos.get(t.id);
    const no = { id: t.id, type: "mmNode", x: 0, y: 0, w: 120, h: 36, text: t.texto, parent: pai };
    if (nivel === 1) {
      no.side = velho?.side === "left" || velho?.side === "right" ? velho.side : i % 2 ? "left" : "right";
      no.color = t.cor || velho?.color || CORES_DOS_GALHOS[i % CORES_DOS_GALHOS.length];
    }
    if (velho?.collapsed === true) no.collapsed = true;
    for (const k of ["ox", "oy"]) if (ehNumero(velho?.[k]) && Number(velho[k])) no[k] = Number(velho[k]);
    shapes.push(no);
    if (t.filhos?.length) pendurar(t.filhos, t.id, nivel + 1);
  });
  pendurar(mapa.topicos, ID_DO_TEMA, 1);
  // os tópicos fundos que a Lisa não viu, onde estavam (enquanto o pai existir)
  const ids = new Set(shapes.map((x) => x.id));
  let achou = true;
  while (achou) {
    achou = false;
    for (const [id, velho] of antigos) {
      if (ids.has(id) || !ids.has(paiDe(velho)) || (!manterTudo && profundidade(antigos, velho) <= 3)) continue;
      const galho = paiDe(velho) === ID_DO_TEMA;
      shapes.push({
        id, type: "mmNode", x: 0, y: 0, w: 120, h: 36, text: String(velho.text ?? ""), parent: paiDe(velho),
        ...(galho && (velho.side === "left" || velho.side === "right") ? { side: velho.side } : {}),
        ...(galho && velho.color ? { color: velho.color } : {}),
        ...(velho.collapsed === true ? { collapsed: true } : {}),
      });
      ids.add(id);
      achou = true;
    }
  }
  return {
    format: "processmap", version: 4, name: mapa.titulo, mode: "mindmap", activePage: "p1",
    pages: [{ id: "p1", name: mapa.titulo.slice(0, 40), shapes, connections: [] }],
  };
}

// quantos níveis abaixo do tema (o filho do tema é 1)
function profundidade(nos, s) {
  let d = 1;
  let p = nos.get(String(s.parent));
  while (p && d < 50) { d++; p = nos.get(String(p.parent)); }
  return d;
}

/** A árvore do mapa na tela, no formato que a IA devolve (para mudar o mapa a partir dele). */
export function estruturaDoMapa(doc) {
  const aba = abasDe(doc)[0] || { shapes: [] };
  const nos = (aba.shapes || []).filter((s) => s && (s.type === "mmRoot" || s.type === "mmNode"));
  const tema = nos.find((s) => s.type === "mmRoot");
  const arvore = (id, nivel) => nos.filter((s) => s.type === "mmNode" && String(s.parent) === String(id)).map((s) => ({
    id: String(s.id), texto: String(s.text ?? "").slice(0, LIMITES_DO_MAPA.texto),
    ...(nivel === 1 && CORES[s.color] ? { cor: nomeDaCor(s.color) } : {}),
    ...(nivel < 3 ? { filhos: arvore(s.id, nivel + 1) } : {}),
  }));
  return { titulo: String(doc?.name || "Mapa mental"), tema: String(tema?.text ?? "Tema central"), topicos: tema ? arvore(tema.id, 1) : [] };
}

/** O mapa em texto, recuado por nível (o que a Lisa lê quando a pessoa conversa sobre ele). */
function descreverMapa(doc, { inteiro = false } = {}) {
  const aba = abasDe(doc)[0] || { shapes: [] };
  const nos = (aba.shapes || []).filter((s) => s && (s.type === "mmRoot" || s.type === "mmNode"));
  const tema = nos.find((s) => s.type === "mmRoot");
  if (!tema) return "";
  const linhas = [`MAPA MENTAL "${doc?.name || "Mapa mental"}" — ${nos.length} tópicos (cada um com o id entre colchetes; o recuo mostra quem é filho de quem)`, `[${tema.id}] TEMA: "${String(tema.text ?? "").slice(0, 200)}"`];
  const descer = (id, nivel) => {
    if (nivel > 12) return;
    for (const s of nos.filter((x) => x.type === "mmNode" && String(x.parent) === String(id))) {
      const cor = nivel === 1 && CORES[s.color] ? ` (galho ${nomeDaCor(s.color)})` : "";
      linhas.push(`${"  ".repeat(nivel)}- [${s.id}] "${String(s.text ?? "").replace(/\s+/g, " ").slice(0, 200)}"${cor}${s.collapsed ? " (recolhido)" : ""}`);
      descer(s.id, nivel + 1);
    }
  };
  descer(tema.id, 1);
  return linhas.join("\n").slice(0, inteiro ? 60_000 : 12_000);
}
