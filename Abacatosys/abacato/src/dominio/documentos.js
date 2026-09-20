// O que é um documento aqui, e como cada tipo abre.
//
// Nada neste arquivo fala com banco nem com rede: recebe nome e tipo, devolve decisões. É o que
// permite o `documento-check` exercitar os casos esquisitos — arquivo sem extensão, nome com
// barra, planilha que o navegador chama de zip — sem subir nada.

/**
 * Como este arquivo se abre na tela.
 *
 *   "proprio"   o navegador desenha sozinho, numa moldura: PDF, imagem, som, vídeo.
 *   "texto"     a gente lê e mostra: txt, md, csv, json, código.
 *   "html"      desenha numa moldura ISOLADA — ver o aviso abaixo, que é o ponto mais
 *               delicado deste sistema inteiro.
 *   "baixar"    não há como mostrar: excel, word, zip. Oferece baixar e para de prometer.
 */
const POR_TIPO = [
  { jeito: "html", tipos: ["text/html", "application/xhtml+xml"], extensoes: ["html", "htm"] },
  { jeito: "proprio", tipos: ["application/pdf"], extensoes: ["pdf"] },
  { jeito: "proprio", tipos: ["image/"], extensoes: ["png", "jpg", "jpeg", "webp", "avif", "gif", "svg"] },
  { jeito: "proprio", tipos: ["audio/", "video/"], extensoes: ["mp3", "wav", "m4a", "mp4", "webm", "mov"] },
  {
    jeito: "texto",
    tipos: ["text/", "application/json", "application/xml"],
    extensoes: ["txt", "md", "markdown", "csv", "json", "xml", "log", "sql", "js", "ts", "css", "yml", "yaml"],
  },
];

/** A extensão, em minúsculas, sem o ponto. */
export function extensaoDe(nome) {
  const limpo = String(nome || "").trim();
  const ponto = limpo.lastIndexOf(".");
  // Ponto no comecinho é nome escondido (".gitignore"), não extensão.
  if (ponto <= 0 || ponto === limpo.length - 1) return "";
  return limpo.slice(ponto + 1).toLowerCase();
}

/**
 * Como abrir.
 *
 * O TIPO declarado vem primeiro, e a extensão é o desempate. Os dois erram sozinhos: o
 * navegador manda `application/octet-stream` para arquivo que ele não reconhece, e chama .xlsx
 * de `application/zip` (porque tecnicamente é um zip). Só o nome também não basta — um .txt
 * renomeado para .pdf não vira PDF.
 */
export function comoAbrir({ tipo, nome }) {
  const t = String(tipo || "").toLowerCase();
  const ext = extensaoDe(nome);

  // A extensão vence quando o tipo é o genérico "não sei o que é isto".
  const tipoInutil = !t || t === "application/octet-stream" || t === "binary/octet-stream";

  if (!tipoInutil) {
    for (const regra of POR_TIPO) {
      if (regra.tipos.some((p) => (p.endsWith("/") ? t.startsWith(p) : t === p))) return regra.jeito;
    }
  }
  for (const regra of POR_TIPO) {
    if (regra.extensoes.includes(ext)) return regra.jeito;
  }
  return "baixar";
}

/** Uma etiqueta curta para a tela: "PDF", "XLSX", "Documento". */
export function selo({ tipo, nome }) {
  const ext = extensaoDe(nome);
  if (ext) return ext.toUpperCase().slice(0, 5);
  const t = String(tipo || "");
  if (t.startsWith("image/")) return "IMG";
  if (t.startsWith("video/")) return "VÍDEO";
  if (t.startsWith("audio/")) return "ÁUDIO";
  return "ARQ";
}

/** Tamanho em palavras. Bytes crus não dizem nada a quem está escolhendo um arquivo. */
export function tamanhoEmPalavras(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
  return `${(n / 1073741824).toFixed(1)} GB`;
}

/**
 * Um nome de arquivo que pode virar caminho no armazenamento.
 *
 * Barra, `..` e acento viram problema em lugares diferentes: a barra cria pasta onde não se
 * quer, o `..` sobe de pasta, e o acento quebra em clientes de S3 mais antigos. O nome ORIGINAL
 * continua guardado no banco e é o que aparece na tela — isto aqui é só o nome do arquivo no
 * disco.
 */
export function nomeSeguro(nome) {
  const ext = extensaoDe(nome);
  const base = String(nome || "arquivo")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  const limpo = base || "arquivo";
  return ext ? `${limpo}.${ext.replace(/[^a-z0-9]/g, "").slice(0, 10)}` : limpo;
}

// ---------------------------------------------------------------- a árvore de pastas

/**
 * Monta a árvore a partir da lista plana de pastas.
 *
 * Pastas cujo pai não está na lista (pai arquivado, ou uma volta de A→B→A vinda de um erro)
 * entram na RAIZ em vez de desaparecer. Sumir com a pasta faria o documento dentro dela ficar
 * inalcançável sem nada na tela explicando por quê.
 */
export function montarArvore(pastas) {
  const porId = new Map();
  for (const p of pastas || []) porId.set(p.id, { ...p, filhas: [] });

  const raiz = [];
  for (const p of porId.values()) {
    const pai = p.pai_id ? porId.get(p.pai_id) : null;
    if (pai && pai.id !== p.id) pai.filhas.push(p);
    else raiz.push(p);
  }

  const ordenar = (lista) => {
    lista.sort((a, b) => (a.posicao - b.posicao) || a.nome.localeCompare(b.nome, "pt-BR"));
    for (const p of lista) ordenar(p.filhas);
    return lista;
  };
  return ordenar(raiz);
}

/** O caminho até uma pasta, da raiz até ela: ["Obra", "Contratos", "2026"]. */
export function caminhoAte(pastaId, pastas) {
  const porId = new Map((pastas || []).map((p) => [p.id, p]));
  const caminho = [];
  let atual = porId.get(pastaId);
  // O teto protege de uma volta no banco (A é pai de B, B é pai de A), que travaria a tela
  // inteira num laço sem nenhuma mensagem.
  let guarda = 0;
  while (atual && guarda++ < 50) {
    caminho.unshift(atual);
    atual = atual.pai_id ? porId.get(atual.pai_id) : null;
  }
  return caminho;
}

/**
 * Mover esta pasta para dentro daquela criaria uma volta?
 *
 * Mover "Contratos" para dentro da própria subpasta "2026" desliga as duas da árvore: elas
 * passam a ser pai uma da outra e somem da tela, com os documentos dentro.
 */
export function moverCriaVolta(pastaId, destinoId, pastas) {
  if (!destinoId) return false;
  if (pastaId === destinoId) return true;
  return caminhoAte(destinoId, pastas).some((p) => p.id === pastaId);
}

/** As categorias sugeridas. Texto livre no banco — isto é só o que a tela oferece pronto. */
export const CATEGORIAS = [
  "Contrato", "Proposta", "Projeto", "Relatório", "Planilha",
  "Ata", "Procedimento", "Nota fiscal", "Foto", "Outro",
];
