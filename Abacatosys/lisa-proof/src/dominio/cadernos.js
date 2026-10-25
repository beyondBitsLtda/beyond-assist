// Os cadernos de anotações (pedido de 25/10/2026): "um caderno de notas tipo Notepad++, com
// identificação de sintaxe… vários cadernos… linkar com trilhas, cursos, torres de domínio, até
// páginas e módulos específicos do caderno".
//
// Um caderno tem MÓDULOS (seções) e PÁGINAS; a página mora na raiz ou dentro de um módulo (um
// nível só — mais que isso vira gaveta dentro de gaveta, e ninguém acha nada). Cada página tem a
// linguagem dela, que dá a cor da sintaxe no editor.
//
// Puro: sem banco, sem rede.

export const LIMITES_DO_CADERNO = {
  titulo: 120,
  tituloDaPagina: 160,
  descricao: 400,
  conteudo: 1_000_000, // caracteres; o banco confere 1 MB
  paginas: 600, // por caderno, módulos incluídos
  cadernos: 200, // por pessoa
};

export const CORES_DO_CADERNO = ["vermelho", "azul", "laranja", "verde", "marinho", "grafite"];
export const ICONES_DO_CADERNO = ["📓", "📘", "📗", "📙", "📕", "🧠", "💡", "🧪", "🛠️", "🗂️", "🧩", "🚀"];

/** As linguagens de uma página: a chave vai para o editor (src/componentes/codigo/linguagens.js). */
export const LINGUAGENS_DO_CADERNO = [
  { chave: "markdown", rotulo: "Markdown", extensoes: ["md", "markdown"] },
  { chave: "texto", rotulo: "Texto puro", extensoes: ["txt", "log"] },
  { chave: "javascript", rotulo: "JavaScript", extensoes: ["js", "mjs", "cjs"] },
  { chave: "typescript", rotulo: "TypeScript", extensoes: ["ts"] },
  { chave: "jsx", rotulo: "JSX", extensoes: ["jsx"] },
  { chave: "tsx", rotulo: "TSX", extensoes: ["tsx"] },
  { chave: "python", rotulo: "Python", extensoes: ["py"] },
  { chave: "java", rotulo: "Java", extensoes: ["java"] },
  { chave: "csharp", rotulo: "C#", extensoes: ["cs"] },
  { chave: "cpp", rotulo: "C/C++", extensoes: ["c", "cpp", "cc", "h", "hpp"] },
  { chave: "go", rotulo: "Go", extensoes: ["go"] },
  { chave: "rust", rotulo: "Rust", extensoes: ["rs"] },
  { chave: "php", rotulo: "PHP", extensoes: ["php"] },
  { chave: "ruby", rotulo: "Ruby", extensoes: ["rb"] },
  { chave: "kotlin", rotulo: "Kotlin", extensoes: ["kt", "kts"] },
  { chave: "swift", rotulo: "Swift", extensoes: ["swift"] },
  { chave: "dart", rotulo: "Dart", extensoes: ["dart"] },
  { chave: "sql", rotulo: "SQL", extensoes: ["sql"] },
  { chave: "html", rotulo: "HTML", extensoes: ["html", "htm", "xml", "svg"] },
  { chave: "css", rotulo: "CSS", extensoes: ["css", "scss", "less"] },
  { chave: "json", rotulo: "JSON", extensoes: ["json"] },
  { chave: "yaml", rotulo: "YAML", extensoes: ["yml", "yaml"] },
  { chave: "shell", rotulo: "Terminal", extensoes: ["sh", "bash", "zsh", "ps1"] },
];
const CHAVES = new Set(LINGUAGENS_DO_CADERNO.map((l) => l.chave));

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

/** Texto de uma linha só, sem espaços sobrando, cortado no limite. */
export function textoCurto(valor, limite) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
}

/** A linguagem pela extensão do título ("closures.js" → javascript), ou null se não tem extensão conhecida. */
export function linguagemDoTitulo(titulo) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(String(titulo || "").trim());
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return LINGUAGENS_DO_CADERNO.find((l) => l.extensoes.includes(ext))?.chave || null;
}

export function linguagemValida(chave) {
  return CHAVES.has(chave) ? chave : "markdown";
}

export function rotuloDaLinguagemDoCaderno(chave) {
  return LINGUAGENS_DO_CADERNO.find((l) => l.chave === chave)?.rotulo || "Texto";
}

/** Confere um caderno novo ou editado. Nunca lança: `{ ok, erros, caderno }`. */
export function validarCaderno(bruto, { parcial = false } = {}) {
  const erros = [];
  const caderno = {};
  if (!parcial || bruto?.titulo !== undefined) {
    caderno.titulo = textoCurto(bruto?.titulo, LIMITES_DO_CADERNO.titulo);
    if (!caderno.titulo) erros.push("dê um nome ao caderno");
  }
  if (!parcial || bruto?.descricao !== undefined) caderno.descricao = textoCurto(bruto?.descricao, LIMITES_DO_CADERNO.descricao);
  if (!parcial || bruto?.cor !== undefined) caderno.cor = CORES_DO_CADERNO.includes(bruto?.cor) ? bruto.cor : CORES_DO_CADERNO[0];
  if (!parcial || bruto?.icone !== undefined) caderno.icone = ICONES_DO_CADERNO.includes(bruto?.icone) ? bruto.icone : ICONES_DO_CADERNO[0];
  return { ok: erros.length === 0, erros, caderno };
}

/**
 * Confere uma página ou um módulo. A linguagem, quando não vem, sai da extensão do título
 * ("rotas.py" já nasce Python) e, sem extensão, é Markdown — o jeito natural de anotar.
 */
export function validarPagina(bruto, { parcial = false } = {}) {
  const erros = [];
  const pagina = {};
  if (!parcial || bruto?.tipo !== undefined) pagina.tipo = bruto?.tipo === "modulo" ? "modulo" : "pagina";
  if (!parcial || bruto?.titulo !== undefined) {
    pagina.titulo = textoCurto(bruto?.titulo, LIMITES_DO_CADERNO.tituloDaPagina);
    if (!pagina.titulo) erros.push(pagina.tipo === "modulo" ? "dê um nome ao módulo" : "dê um nome à página");
  }
  if (bruto?.linguagem !== undefined) pagina.linguagem = linguagemValida(bruto.linguagem);
  else if (!parcial) pagina.linguagem = linguagemDoTitulo(pagina.titulo) || "markdown";
  // renomear para "rotas.py" troca a cor para Python (como "salvar como" no Notepad++); sem extensão, fica a de antes
  else if (pagina.titulo && linguagemDoTitulo(pagina.titulo)) pagina.linguagem = linguagemDoTitulo(pagina.titulo);
  if (bruto?.conteudo !== undefined) {
    const c = String(bruto.conteudo ?? "");
    if (c.length > LIMITES_DO_CADERNO.conteudo) erros.push(`a página passou de ${LIMITES_DO_CADERNO.conteudo.toLocaleString("pt-BR")} caracteres — divida em duas`);
    pagina.conteudo = c.slice(0, LIMITES_DO_CADERNO.conteudo);
  }
  return { ok: erros.length === 0, erros, pagina };
}

const porOrdem = (a, b) => (a.ordem - b.ordem) || String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""));

/**
 * A árvore do caderno: a raiz em ordem (módulos e páginas soltas misturados, como a pessoa
 * arrumou), e cada módulo com as páginas dele. Página cujo módulo sumiu volta para a raiz.
 */
export function montarArvore(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  const modulos = new Map(lista.filter((i) => i.tipo === "modulo").map((m) => [m.id, { ...m, paginas: [] }]));
  const raiz = [];
  for (const i of lista) {
    if (i.tipo === "modulo") raiz.push(modulos.get(i.id));
    else if (i.moduloId && modulos.has(i.moduloId)) modulos.get(i.moduloId).paginas.push(i);
    else raiz.push({ ...i, moduloId: null });
  }
  for (const m of modulos.values()) m.paginas.sort(porOrdem);
  return raiz.sort(porOrdem);
}

/** As páginas na ordem de leitura (de cima para baixo na árvore), sem os módulos. */
export function paginasEmOrdem(arvore) {
  return arvore.flatMap((i) => (i.tipo === "modulo" ? i.paginas : [i]));
}

/** A ordem para um item novo no fim de uma lista de irmãos. */
export function ordemNoFim(irmaos) {
  return (irmaos || []).reduce((max, i) => Math.max(max, Number(i.ordem) || 0), 0) + 1024;
}

/**
 * Subir ou descer um item entre os irmãos: devolve as ordens novas (só as que mudaram). Renumera
 * tudo de 1024 em 1024 — com poucas dezenas de itens é barato e acaba com empates.
 */
export function moverEntreIrmaos(irmaos, id, direcao) {
  const lista = [...(irmaos || [])].sort(porOrdem);
  const i = lista.findIndex((x) => x.id === id);
  const j = i + (direcao === "cima" ? -1 : 1);
  if (i < 0 || j < 0 || j >= lista.length) return [];
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista
    .map((x, n) => ({ id: x.id, ordem: (n + 1) * 1024, antes: x.ordem }))
    .filter((x) => x.ordem !== x.antes)
    .map(({ id: itemId, ordem }) => ({ id: itemId, ordem }));
}

/** Linhas, palavras e caracteres — a barra de status do editor. */
export function estatisticasDoTexto(texto) {
  const t = String(texto || "");
  return {
    linhas: t ? t.split("\n").length : 1,
    palavras: (t.match(/[\p{L}\p{N}_]+/gu) || []).length,
    caracteres: t.length,
  };
}

// ---------------------------------------------------------------- vínculos

/** Onde um caderno (ou uma página dele) pode ser ligado. `numero`: o andar da torre ou a página do livro. */
export const TIPOS_DE_ALVO = {
  trilha: { rotulo: "Trilha", artigo: "a", icone: "🧭", numero: "nenhum" },
  assunto: { rotulo: "Assunto", artigo: "o", icone: "📌", numero: "nenhum" },
  torre: { rotulo: "Torre", artigo: "a", icone: "🗼", numero: "nenhum" },
  andar: { rotulo: "Andar", artigo: "o", icone: "⚔️", numero: "obrigatorio" },
  livro: { rotulo: "Livro", artigo: "o", icone: "📖", numero: "opcional" },
};

/** "não achei a torre entre as suas" — a mensagem de alvo que não existe (ou é de outra pessoa). */
export function alvoNaoEncontrado(tipo) {
  const regra = TIPOS_DE_ALVO[tipo];
  if (!regra) return "não achei esse destino";
  return `não achei ${regra.artigo} ${regra.rotulo.toLowerCase()} entre ${regra.artigo === "a" ? "as suas" : "os seus"}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValido = (v) => UUID.test(String(v || ""));

/**
 * Confere o alvo de um vínculo: tipo conhecido, id que parece id, e o número só onde ele faz
 * sentido (andar de 1 a 100; página do livro a partir de 1). Quem confere se o alvo é da pessoa é
 * o servidor (src/lib/vinculos.js) — aqui é só a forma.
 */
export function normalizarAlvo(bruto) {
  const tipo = String(bruto?.tipo || "");
  const regra = TIPOS_DE_ALVO[tipo];
  if (!regra) return { ok: false, erro: "tipo de vínculo desconhecido" };
  if (!uuidValido(bruto?.id)) return { ok: false, erro: "vínculo sem destino" };
  const n = Number.parseInt(bruto?.numero, 10);
  let numero = null;
  if (regra.numero === "obrigatorio") {
    if (!Number.isFinite(n) || n < 1 || n > 100) return { ok: false, erro: "escolha o andar" };
    numero = n;
  } else if (regra.numero === "opcional" && Number.isFinite(n) && n >= 1) {
    numero = limitar(n, 1, 5000);
  }
  return { ok: true, alvo: { tipo, id: String(bruto.id).toLowerCase(), numero } };
}

/** O endereço do alvo dentro do Proof. `trilhaId` só é usado no assunto (o assunto abre no mapa da trilha). */
export function enderecoDoAlvo({ tipo, id, numero, trilhaId }) {
  if (tipo === "trilha") return `/trilhas/${id}`;
  if (tipo === "assunto") return trilhaId ? `/trilhas/${trilhaId}?assunto=${id}` : null;
  if (tipo === "torre") return `/dominio/${id}`;
  if (tipo === "andar") return `/dominio/${id}?andar=${numero}`;
  if (tipo === "livro") return `/biblioteca/${id}${numero ? `?pagina=${numero}` : ""}`;
  return null;
}

/** O texto do alvo num chip: "⚔️ Andar 7 · Golem do Callback", "📖 Clean Code · p. 45". */
export function rotuloDoAlvo({ tipo, numero, nome }) {
  const regra = TIPOS_DE_ALVO[tipo];
  if (!regra) return String(nome || "");
  const base = nome || regra.rotulo;
  if (tipo === "andar") return `Andar ${numero}${nome ? ` · ${nome}` : ""}`;
  if (tipo === "livro" && numero) return `${base} · p. ${numero}`;
  return base;
}

export const enderecoDaPagina = (cadernoId, paginaId) => `/cadernos/${cadernoId}${paginaId ? `?pagina=${paginaId}` : ""}`;

/**
 * O título de uma página nova criada a partir de um alvo ("Anotar aqui" no assunto, na torre, no
 * livro): curto, e dizendo de onde veio.
 */
export function tituloDaAnotacao({ tipo, nome, numero }) {
  const nomeCurto = textoCurto(nome, 90);
  if (tipo === "andar") return textoCurto(`Andar ${numero}${nomeCurto ? ` — ${nomeCurto}` : ""}`, LIMITES_DO_CADERNO.tituloDaPagina);
  if (tipo === "livro" && numero) return textoCurto(`${nomeCurto || "Livro"} — p. ${numero}`, LIMITES_DO_CADERNO.tituloDaPagina);
  return textoCurto(`Notas — ${nomeCurto || TIPOS_DE_ALVO[tipo]?.rotulo || "anotação"}`, LIMITES_DO_CADERNO.tituloDaPagina);
}

/**
 * O trecho que vai para o caderno quando a pessoa manda uma marcação do livro: a citação, de onde
 * ela veio (com o link que volta à página do leitor) e a nota, se tiver.
 */
export function citacaoDoLivro({ livroId, livroTitulo, pagina, texto, nota }) {
  const linhas = String(texto || "").replace(/\s+/g, " ").trim();
  const partes = [];
  if (linhas) partes.push(`> ${linhas}`);
  partes.push(`> — [${textoCurto(livroTitulo, 120) || "Livro"}, p. ${pagina}](/biblioteca/${livroId}?pagina=${pagina})`);
  if (String(nota || "").trim()) partes.push("", String(nota).trim());
  return partes.join("\n");
}

/** Junta um trecho no fim do conteúdo, com uma linha em branco entre os dois. */
export function anexarAoConteudo(conteudo, trecho) {
  const base = String(conteudo || "").replace(/\s+$/, "");
  return base ? `${base}\n\n${trecho}\n` : `${trecho}\n`;
}
