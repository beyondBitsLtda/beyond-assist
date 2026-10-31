// O EXERCÍCIO DE DESENHAR (pedido de 31/10/2026): em cursos de ciência da computação, arquitetura de
// software e áreas próximas, o exercício do dia pode ser desenhar um fluxo de processo, um modelo de
// dados, uma arquitetura de software ou de nuvem. A pessoa desenha no quadro (o ProcessMap embutido,
// em public/diagramas) e a Lisa avalia o desenho pelos requisitos do cenário.
//
// A Lisa não "vê" o quadro: o desenho vai para ela como TEXTO (descreverDiagrama) — cada forma com
// o tipo e o que está escrito, cada ligação com origem → destino, as pontas (cardinalidade, herança)
// e os rótulos, e o que está dentro de cada agrupador (raia, fronteira, cluster). É mais preciso que
// uma imagem e não depende do zoom. Puro: sem banco, sem rede, sem DOM.

export const TIPOS_DE_DIAGRAMA = {
  fluxograma: { nome: "Fluxograma de processo", colecao: "flow" },
  bpmn: { nome: "Processo em BPMN", colecao: "bpmn" },
  atividades: { nome: "Diagrama de atividades (UML)", colecao: "uml" },
  classes: { nome: "Diagrama de classes (UML)", colecao: "uml" },
  casos_de_uso: { nome: "Casos de uso (UML)", colecao: "usecase" },
  dados: { nome: "Modelo de dados (entidade-relacionamento)", colecao: "db" },
  arquitetura: { nome: "Arquitetura de software", colecao: "arch" },
  nuvem: { nome: "Arquitetura de nuvem e infraestrutura", colecao: "cloud" },
  c4: { nome: "Modelo C4 (contexto, contêineres, componentes)", colecao: "c4" },
};
export const ORDEM_DOS_DIAGRAMAS = Object.keys(TIPOS_DE_DIAGRAMA);

/** Como cada tipo se desenha NESTE quadro: vai no pedido do desafio e no da avaliação. */
export const NOTACAO_DO_TIPO = {
  fluxograma: "início e fim com a forma de início/fim; cada passo num processo; decisão no losango, com as saídas rotuladas nas ligações (Sim/Não); setas no sentido do fluxo; raias para dizer quem faz cada etapa, se houver mais de um responsável.",
  bpmn: "evento de início e de fim; tarefas (de usuário quando é uma pessoa, de serviço quando é o sistema); gateway exclusivo (XOR) para escolhas, com as saídas rotuladas, e paralelo (AND) para abrir e fechar caminhos simultâneos; evento de tempo ou de mensagem para esperas; raias para os participantes.",
  atividades: "nó inicial e nó final; ações; decisão/junção com a condição de cada saída no rótulo da ligação ([aprovado]); barra de fork/join para o que acontece em paralelo; raias por responsável.",
  classes: "cada classe com o nome na 1ª linha, \"--\", os atributos (- privado, + público, com tipo), \"--\" e os métodos; herança com a ponta de triângulo apontando para a classe mãe; interface realizada com linha tracejada e triângulo; agregação e composição com o losango na ponta da origem (o todo); multiplicidade nos rótulos da origem e do destino (1, 0..*).",
  casos_de_uso: "atores fora do limite do sistema; casos de uso (verbo + objeto) dentro dele; associação ator–caso sem ponta; «include» e «extend» com linha tracejada, seta aberta e o rótulo.",
  dados: "uma tabela por entidade, com o NOME na 1ª linha e uma coluna por linha (PK, FK, UQ e o tipo: \"PK id: int\", \"FK id_cliente: int\"); relacionamentos ligando as tabelas com as pontas de cardinalidade (um e somente um, muitos, zero ou muitos); N:N resolvido com uma tabela associativa.",
  arquitetura: "quem usa (ator, aplicação web, app mobile), os serviços/APIs, os bancos, filas e sistemas externos; a fronteira para agrupar o que roda junto; o rótulo de cada ligação diz o que trafega e como (HTTP/REST, evento, SQL).",
  nuvem: "o caminho da requisição (usuários → DNS/CDN → firewall → balanceador ou API gateway → serviços em contêiner ou função) e os dados (cache, banco, bucket, fila ou tópico, ETL, data lake/warehouse); cluster/VPC para agrupar o que fica na mesma rede; monitoramento e CI/CD quando o cenário pedir; rótulos nas ligações.",
  c4: "no nível que o cenário pedir (contexto ou contêineres): pessoas, o sistema, os contêineres (2ª linha com a tecnologia entre colchetes: [React], [API Node], [PostgreSQL]) dentro da fronteira do sistema, e os sistemas externos; cada ligação com o rótulo do que faz e como (\"envia pedidos [HTTPS/JSON]\").",
};

/** O nome de cada forma do quadro (o `type` do JSON), como a Lisa vai ler. */
export const NOMES_DAS_FORMAS = {
  terminal: "início/fim", process: "processo", decision: "decisão", data: "entrada/saída de dados", document: "documento",
  subprocess: "subprocesso", database: "banco de dados", delay: "espera", manual: "operação manual", connector: "conector",
  note: "anotação", lane: "raia", laneV: "raia vertical", freeText: "texto", ink: "desenho à mão", code: "bloco de código", image: "imagem",
  umlInitial: "nó inicial", umlFinal: "nó final", umlAction: "ação", umlDecision: "decisão/junção", umlBar: "barra de fork/join",
  umlObject: "objeto", umlSend: "enviar sinal", umlAccept: "receber evento", umlSwimlane: "raia", umlNote: "nota",
  umlClass: "classe", umlInterface: "interface", umlPackage: "pacote",
  ucActor: "ator", ucCase: "caso de uso", ucSystem: "limite do sistema",
  dbTable: "tabela", dbView: "view", dbSchema: "esquema",
  archBrowser: "aplicação web", archMobile: "app mobile", archService: "serviço/API", archComponent: "componente",
  archQueue: "fila/mensageria", archServer: "servidor", archCloud: "nuvem/serviço externo", archExternal: "sistema externo", archBoundary: "fronteira/contêiner",
  bpmnStart: "evento de início", bpmnIntermediate: "evento intermediário", bpmnTimer: "evento de tempo", bpmnMessageEvent: "evento de mensagem",
  bpmnEnd: "evento de fim", bpmnTask: "tarefa", bpmnUserTask: "tarefa de usuário", bpmnServiceTask: "tarefa de serviço",
  bpmnSubprocess: "subprocesso", bpmnGatewayX: "gateway exclusivo (XOR)", bpmnGatewayParallel: "gateway paralelo (AND)",
  bpmnGatewayInclusive: "gateway inclusivo (OR)", bpmnDataObject: "objeto de dados",
  cloudLoadBalancer: "balanceador de carga", cloudGateway: "API gateway", cloudCache: "cache", cloudCdn: "CDN", cloudDns: "DNS",
  cloudContainer: "contêiner (Docker)", cloudFunction: "função serverless", cloudBucket: "armazenamento (bucket)",
  cloudTopic: "tópico/barramento de eventos", cloudMonitor: "monitoramento", cloudFirewall: "firewall", cloudUsers: "grupo de usuários",
  cloudWarehouse: "data warehouse", cloudLake: "data lake", cloudEtl: "ETL/pipeline de dados", cloudMl: "modelo de IA/ML",
  cloudRepo: "repositório Git", cloudCicd: "CI/CD", cloudIot: "dispositivo IoT", cloudCluster: "cluster/VPC/região",
  c4Person: "pessoa (C4)", c4System: "sistema de software (C4)", c4Container: "contêiner (C4)", c4Component: "componente (C4)", c4External: "sistema externo (C4)",
  mmRoot: "tema central", mmNode: "tópico",
};
/** As formas que agrupam outras (o que está dentro delas importa). */
const AGRUPADORES = new Set(["lane", "laneV", "umlSwimlane", "umlPackage", "ucSystem", "dbSchema", "archBoundary", "cloudCluster"]);
const NOMES_DAS_PONTAS = {
  arrow: "seta", open: "seta aberta", triangle: "herança", diamond: "agregação", diamondFill: "composição",
  one: "um", oneOnly: "um e somente um", many: "muitos", oneMany: "um ou muitos", zeroMany: "zero ou muitos", zeroOne: "zero ou um",
};

export const LIMITES_DO_DIAGRAMA = { caracteres: 400_000, formas: 300, ligacoes: 500, textoDaForma: 600 };

const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const lista = (v, max, cada) => (Array.isArray(v) ? v : []).map((x) => texto(x, cada)).filter(Boolean).slice(0, max);
const ehNumero = (n) => Number.isFinite(Number(n));

/** O desafio que a IA devolveu, conferido. */
export function validarDesafioDeDiagrama(bruto) {
  const tipo = TIPOS_DE_DIAGRAMA[bruto?.tipo] ? bruto.tipo : "fluxograma";
  const cenario = texto(bruto?.cenario, 2500);
  if (!cenario) throw new Error("a IA não devolveu o cenário do desenho — tente de novo");
  const requisitos = lista(bruto?.requisitos, 7, 260);
  if (requisitos.length < 3) throw new Error("a IA não devolveu os requisitos do desenho — tente de novo");
  return {
    motor: "diagrama",
    titulo: texto(bruto?.titulo, 120) || TIPOS_DE_DIAGRAMA[tipo].nome,
    tipo, colecao: TIPOS_DE_DIAGRAMA[tipo].colecao,
    cenario, requisitos,
    criterios: lista(bruto?.criterios, 5, 240),
    dicas: lista(bruto?.dicas, 3, 240),
  };
}

/** As abas do documento do quadro (o formato 4 tem `pages`; os antigos, `shapes` direto). */
const abasDe = (doc) => (Array.isArray(doc?.pages) && doc.pages.length ? doc.pages : [{ name: "Página 1", shapes: doc?.shapes, connections: doc?.connections }]);

/**
 * Confere o documento que a tela mandou e devolve uma cópia limpa para guardar: sem o conteúdo das
 * imagens coladas (pesado, e a Lisa lê só o texto) e dentro dos limites.
 */
export function conferirDiagrama(doc) {
  if (!doc || typeof doc !== "object") return { ok: false, motivo: "o desenho não chegou — tente de novo" };
  if (JSON.stringify(doc).length > LIMITES_DO_DIAGRAMA.caracteres) return { ok: false, motivo: "o desenho ficou grande demais — tire imagens coladas ou abas que não fazem parte da resposta" };
  const abas = abasDe(doc).map((a) => ({
    id: texto(a?.id, 40) || undefined,
    name: texto(a?.name, 80) || "Página",
    viewport: a?.viewport,
    shapes: (Array.isArray(a?.shapes) ? a.shapes : []).filter((s) => s && typeof s === "object" && s.id != null)
      .map((s) => (s.type === "image" ? { ...s, src: "" } : s)),
    connections: (Array.isArray(a?.connections) ? a.connections : []).filter((c) => c && c.from != null && c.to != null),
  }));
  const formas = abas.reduce((t, a) => t + a.shapes.length, 0);
  const ligacoes = abas.reduce((t, a) => t + a.connections.length, 0);
  if (formas > LIMITES_DO_DIAGRAMA.formas) return { ok: false, motivo: `o desenho passou de ${LIMITES_DO_DIAGRAMA.formas} formas` };
  if (ligacoes > LIMITES_DO_DIAGRAMA.ligacoes) return { ok: false, motivo: `o desenho passou de ${LIMITES_DO_DIAGRAMA.ligacoes} ligações` };
  const comTexto = abas.flatMap((a) => a.shapes).filter((s) => !["ink", "image"].includes(s.type));
  if (comTexto.length < 2) return { ok: false, motivo: "desenhe o diagrama antes de enviar (pelo menos duas formas)" };
  return {
    ok: true, formas, ligacoes,
    doc: { format: "processmap", version: 4, name: texto(doc.name, 120) || "Diagrama", mode: doc.mode === "mindmap" ? "mindmap" : "diagram", activePage: doc.activePage, pages: abas },
  };
}

const centro = (s) => ({ x: Number(s.x) + Number(s.w) / 2, y: Number(s.y) + Number(s.h) / 2 });
const dentro = (p, c) => p.x >= Number(c.x) && p.x <= Number(c.x) + Number(c.w) && p.y >= Number(c.y) && p.y <= Number(c.y) + Number(c.h);

/** Como a forma aparece no texto: o tipo e o que está escrito (tabela e classe, com as linhas). */
function rotuloDaForma(s) {
  const nome = NOMES_DAS_FORMAS[s.type] || s.type || "forma";
  const bruto = String(s.text ?? "").trim();
  if (!bruto) return nome;
  const multilinha = ["dbTable", "dbView", "umlClass", "umlInterface", "code", "note", "umlNote", "c4Person", "c4System", "c4Container", "c4Component", "c4External"].includes(s.type);
  const conteudo = multilinha ? bruto.slice(0, LIMITES_DO_DIAGRAMA.textoDaForma).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" | ") : texto(bruto, 200);
  return `${nome}${s.type === "code" && s.lang ? ` (${s.lang})` : ""}: "${conteudo}"`;
}

/**
 * O desenho em texto, para a Lisa avaliar: por aba, as formas (com o que está dentro de cada
 * agrupador) e as ligações (origem → destino, pontas, rótulos e cardinalidades).
 */
export function descreverDiagrama(doc) {
  const partes = [];
  for (const aba of abasDe(doc)) {
    const formas = (aba.shapes || []).filter((s) => s.type !== "ink");
    if (!formas.length) continue;
    const porId = new Map(formas.map((s) => [String(s.id), s]));
    // nas ligações, a forma pelo tipo e a 1ª linha do texto (o nome da tabela, da classe, do passo)
    const nomeCurto = (id) => {
      const s = porId.get(String(id));
      if (!s) return `[${id}]`;
      const linha = texto(String(s.text ?? "").split(/\r?\n/)[0], 60);
      return `[${s.id}] ${NOMES_DAS_FORMAS[s.type] || s.type || "forma"}${linha ? ` "${linha}"` : ""}`;
    };
    const agrupadores = formas.filter((s) => AGRUPADORES.has(s.type) && ehNumero(s.w));
    partes.push(`ABA "${texto(aba.name, 80) || "Página"}" — ${formas.length} formas, ${(aba.connections || []).length} ligações`);
    partes.push("Formas:");
    for (const s of formas) {
      let linha = `- [${s.id}] ${rotuloDaForma(s)}`;
      if (AGRUPADORES.has(s.type) && ehNumero(s.w)) {
        const filhos = formas.filter((f) => f !== s && !AGRUPADORES.has(f.type) && ehNumero(f.w) && dentro(centro(f), s)).map((f) => `[${f.id}]`);
        if (filhos.length) linha += ` — contém: ${filhos.join(", ")}`;
      } else if (ehNumero(s.w)) {
        const pai = agrupadores.filter((g) => dentro(centro(s), g)).sort((a, b) => Number(a.w) * Number(a.h) - Number(b.w) * Number(b.h))[0];
        if (pai) linha += ` (dentro de [${pai.id}])`;
      }
      partes.push(linha);
    }
    const ligacoes = aba.connections || [];
    if (ligacoes.length) {
      partes.push("Ligações:");
      for (const c of ligacoes) {
        const fim = NOMES_DAS_PONTAS[c.arrow ?? "arrow"] || (c.arrow === "none" ? "sem ponta" : c.arrow);
        const inicio = c.arrowStart && c.arrowStart !== "none" ? NOMES_DAS_PONTAS[c.arrowStart] || c.arrowStart : "";
        const extras = [
          `ponta no destino: ${fim || "sem ponta"}`,
          inicio ? `ponta na origem: ${inicio}` : "",
          c.label ? `rótulo "${texto(c.label, 80)}"` : "",
          c.labelFrom ? `na origem "${texto(c.labelFrom, 20)}"` : "",
          c.labelTo ? `no destino "${texto(c.labelTo, 20)}"` : "",
          c.dashed ? "tracejada" : "",
        ].filter(Boolean).join("; ");
        partes.push(`- ${nomeCurto(c.from)} → ${nomeCurto(c.to)} (${extras})`);
      }
    } else {
      partes.push("Ligações: nenhuma.");
    }
    partes.push("");
  }
  return partes.join("\n").trim() || "(o desenho está vazio)";
}

/** As formas da barra de cada tipo (a coleção que abre no quadro), para o desafio pedir o que existe. */
const FORMAS_DA_COLECAO = {
  flow: ["terminal", "process", "decision", "data", "document", "subprocess", "database", "manual", "delay", "connector", "lane", "laneV", "note"],
  uml: ["umlInitial", "umlAction", "umlDecision", "umlBar", "umlFinal", "umlSend", "umlAccept", "umlObject", "umlSwimlane", "umlClass", "umlInterface", "umlPackage", "umlNote"],
  usecase: ["ucActor", "ucCase", "ucSystem", "umlNote"],
  db: ["dbTable", "dbView", "dbSchema", "database", "note"],
  arch: ["ucActor", "archBrowser", "archMobile", "archService", "archComponent", "database", "archQueue", "archServer", "archCloud", "archExternal", "archBoundary", "note"],
  bpmn: ["bpmnStart", "bpmnIntermediate", "bpmnTimer", "bpmnMessageEvent", "bpmnEnd", "bpmnTask", "bpmnUserTask", "bpmnServiceTask", "bpmnSubprocess", "bpmnGatewayX", "bpmnGatewayParallel", "bpmnGatewayInclusive", "bpmnDataObject", "database", "lane"],
  cloud: ["cloudUsers", "archBrowser", "archMobile", "cloudDns", "cloudCdn", "cloudFirewall", "cloudLoadBalancer", "cloudGateway", "archService", "cloudFunction", "cloudContainer", "cloudCache", "database", "cloudBucket", "archQueue", "cloudTopic", "cloudEtl", "cloudWarehouse", "cloudLake", "cloudMl", "cloudMonitor", "cloudRepo", "cloudCicd", "cloudIot", "archExternal", "cloudCluster"],
  c4: ["c4Person", "c4System", "c4Container", "c4Component", "c4External", "database", "archQueue", "archBoundary"],
};
export const formasDoTipo = (tipo) => (FORMAS_DA_COLECAO[TIPOS_DE_DIAGRAMA[tipo]?.colecao] || []).map((f) => NOMES_DAS_FORMAS[f] || f);

// ---------------------------------------------------------------- quando o exercício é de desenhar

// O ASSUNTO do dia pede desenho: o exercício de desenhar vem primeiro (e o outro, na rodada extra).
const ASSUNTO_DE_DIAGRAMA = /arquitetura|fluxograma|fluxo de (processo|dados|trabalho)|mapeamento de processo|processos? de neg[oó]cio|\bbpm\b|\bbpmn\b|\buml\b|diagrama|modelagem|modelo (de dados|entidade|conceitual|l[oó]gico|f[ií]sico|relacional)|entidades?[- ]relacionamento|\bder\b|\bmer\b|normaliza[cç][aã]o|formas normais|casos? de uso|orienta[cç][aã]o a objetos|design de sistemas|system design|microsservi|mon[oó]lito|sistemas distribu|mensageria|event[- ]driven|orientad[ao] a eventos|\bddd\b|domain[- ]driven|\bc4\b|computa[cç][aã]o em nuvem|cloud computing|\baws\b|azure|\bgcp\b|infraestrutura|kubernetes|escalabilidade|alta disponibilidade|balanceamento de carga|requisitos (de software|funcionais)|integra[cç][aã]o (de|entre) sistemas|pipeline de dados|\betl\b|data warehouse|data lake|padr[oõ]es de (projeto|arquitetura)|design patterns|clean architecture|arquitetura limpa|hexagonal|cliente[- ]servidor|\bmvc\b/i;
// O CURSO é da área (ciência da computação, engenharia e arquitetura de software, sistemas, dados,
// nuvem, processos): de vez em quando o exercício é de desenhar, mesmo num assunto de código.
const CURSO_DE_DIAGRAMA = /arquitetura|ci[eê]ncia da computa[cç][aã]o|engenharia de (software|dados|computa[cç][aã]o)|sistemas de informa[cç][aã]o|an[aá]lise (e desenvolvimento )?de sistemas|an[aá]lise de requisitos|modelagem|\buml\b|\bbpmn?\b|processos de neg[oó]cio|gest[aã]o de processos|bancos? de dados|cloud|nuvem|devops|\baws\b|azure|kubernetes|microsservi|system design|design de sistemas|sistemas distribu|integra[cç][aã]o de sistemas/i;

const textoDoAssunto = (assunto) => `${assunto?.titulo || ""} ${assunto?.descricao || ""}`;

/** O curso ou o assunto pede desenhar (fluxos, modelos, arquiteturas)? */
export const pedeDiagrama = ({ tema = "", assunto = null } = {}) => ASSUNTO_DE_DIAGRAMA.test(textoDoAssunto(assunto)) || CURSO_DE_DIAGRAMA.test(String(tema));

/**
 * Onde o desenho entra na roda dos motores do perfil (programação e livre): o assunto de desenho põe
 * o diagrama primeiro; o curso da área, num assunto que não é de desenho, põe um diagrama a cada
 * três dias. Fora da área, os motores ficam como estavam.
 */
export function motoresComDiagrama(motores, { tema = "", assunto = null } = {}) {
  if (ASSUNTO_DE_DIAGRAMA.test(textoDoAssunto(assunto))) return ["diagrama", ...motores];
  if (CURSO_DE_DIAGRAMA.test(String(tema))) return motores.length === 1 ? [motores[0], motores[0], "diagrama"] : [...motores, "diagrama"];
  return motores;
}

// O tipo de diagrama que combina com o assunto (a IA escolhe, mas recebe a sugestão primeiro).
const PISTAS_DO_TIPO = [
  ["bpmn", /\bbpmn?\b|processos? de neg[oó]cio|mapeamento de processo|gest[aã]o de processos/i],
  ["classes", /classe|orienta[cç][aã]o a objetos|heran[cç]a|polimorfismo|encapsulamento|padr[oõ]es de projeto|design patterns|\bsolid\b/i],
  ["casos_de_uso", /casos? de uso|requisitos|\batores\b/i],
  ["dados", /modelo (de dados|entidade|conceitual|l[oó]gico|f[ií]sico|relacional)|entidade|relacionamento|\bder\b|\bmer\b|normaliza|formas normais|chave (prim[aá]ria|estrangeira)|\bsql\b|bancos? de dados/i],
  ["c4", /\bc4\b/i],
  ["nuvem", /nuvem|cloud|\baws\b|azure|\bgcp\b|kubernetes|devops|infraestrutura|\bcdn\b|balanceamento|alta disponibilidade|escalabilidade|serverless|pipeline de dados|\betl\b|data (lake|warehouse)/i],
  ["arquitetura", /arquitetura|microsservi|mon[oó]lito|camadas|cliente[- ]servidor|\bmvc\b|\bapis?\b|mensageria|orientad[ao] a eventos|event[- ]driven|hexagonal|clean architecture|sistemas distribu|integra[cç][aã]o/i],
  ["atividades", /diagrama de atividades|concorr[eê]ncia|paralelismo/i],
  ["fluxograma", /fluxograma|fluxo de (processo|trabalho)|algoritmo|l[oó]gica de programa|estruturas? de (decis[aã]o|repeti[cç][aã]o)|condicionais/i],
];

/** Os tipos sugeridos para o assunto (e o curso), na ordem de preferência; nunca vazio. */
export function tiposSugeridos({ tema = "", assunto = null } = {}) {
  const peloAssunto = PISTAS_DO_TIPO.filter(([, re]) => re.test(textoDoAssunto(assunto))).map(([t]) => t);
  const peloCurso = PISTAS_DO_TIPO.filter(([, re]) => re.test(String(tema))).map(([t]) => t);
  const todos = [...new Set([...peloAssunto, ...peloCurso])];
  return todos.length ? todos : ["fluxograma", "arquitetura"];
}
