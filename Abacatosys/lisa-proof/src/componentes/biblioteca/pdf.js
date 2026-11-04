"use client";

// O pdf.js no navegador (25/10/2026): abrir o PDF, ler o sumário, desenhar a capa, tirar o texto de
// cada página e enviar o arquivo. Só roda no navegador — o pacote é carregado na hora (import
// dinâmico), então nem entra no Worker nem pesa nas telas que não leem PDF.

let pdfjsPromessa = null;

/** O pdf.js, com o worker dele (o desenho das páginas roda fora da thread da tela). */
export function carregarPdfjs() {
  if (!pdfjsPromessa) {
    pdfjsPromessa = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return pdfjs;
    });
  }
  return pdfjsPromessa;
}

/** Abre um PDF: `{ data: ArrayBuffer }` (arquivo do computador) ou `{ url }` (o endereço assinado). */
export async function abrirPdf(fonte) {
  const pdfjs = await carregarPdfjs();
  return pdfjs.getDocument({ ...fonte, isEvalSupported: false, rangeChunkSize: 262144 }).promise;
}

async function paginaDoDestino(pdf, destino) {
  try {
    const dest = typeof destino === "string" ? await pdf.getDestination(destino) : destino;
    if (!Array.isArray(dest) || !dest.length) return null;
    const ref = dest[0];
    if (ref && typeof ref === "object") return (await pdf.getPageIndex(ref)) + 1;
    if (Number.isInteger(ref)) return ref + 1;
  } catch {
    // destino quebrado: o item fica sem página e sai do sumário
  }
  return null;
}

/** O sumário (marcadores do PDF) achatado: [{ titulo, pagina, nivel }], no máximo 800 itens. */
export async function sumarioDoPdf(pdf) {
  const raiz = await pdf.getOutline().catch(() => null);
  const saida = [];
  async function percorrer(itens, nivel) {
    for (const item of itens || []) {
      if (saida.length >= 800) return;
      const pagina = await paginaDoDestino(pdf, item.dest);
      if (pagina && item.title?.trim()) saida.push({ titulo: item.title.trim(), pagina, nivel });
      if (item.items?.length && nivel < 6) await percorrer(item.items, nivel + 1);
    }
  }
  await percorrer(raiz, 1);
  return saida;
}

/** Título e autor gravados no PDF (quando existem). */
export async function metadadosDoPdf(pdf) {
  const m = await pdf.getMetadata().catch(() => null);
  return { titulo: m?.info?.Title || "", autor: m?.info?.Author || "" };
}

/** A capa: a 1ª página em miniatura, em JPEG pequeno (cabe no banco, sem arquivo à parte). */
export async function capaDoPdf(pdf, largura = 240) {
  try {
    const pagina = await pdf.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: largura / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvas, viewport }).promise;
    for (const q of [0.78, 0.6, 0.45]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= 150_000) return url;
    }
  } catch {
    // sem capa: a estante mostra a lombada com o título
  }
  return null;
}

/** O texto de uma página, com as quebras de linha do PDF. */
export async function textoDaPagina(pdf, numero) {
  const pagina = await pdf.getPage(numero);
  const conteudo = await pagina.getTextContent();
  let texto = "";
  for (const item of conteudo.items) {
    if (typeof item.str !== "string") continue;
    texto += item.str;
    if (item.hasEOL) texto += "\n";
  }
  pagina.cleanup();
  return texto;
}

/**
 * Tira o texto de todas as páginas e manda em lotes para o servidor (o último fecha o livro como
 * "pronto"). `aoAvancar(feitas, total)` a cada página. Pode ser chamado de novo sem estragar nada:
 * o servidor regrava a página.
 */
export async function enviarTextoDoLivro({ pdf, livroId, aoAvancar, lote = 40, enviar }) {
  const total = pdf.numPages;
  let pacote = [];
  for (let n = 1; n <= total; n++) {
    let texto = "";
    try { texto = await textoDaPagina(pdf, n); } catch { /* página que não se deixa ler: segue sem texto */ }
    pacote.push({ numero: n, texto });
    aoAvancar?.(n, total);
    if (pacote.length >= lote || n === total) {
      await enviar(`/api/biblioteca/${livroId}/texto`, { paginas: pacote, fim: n === total });
      pacote = [];
    }
  }
}

/** Manda o arquivo direto para o armazenamento, no endereço assinado, com o andamento. */
export function enviarArquivo(url, arquivo, aoAvancar) {
  return new Promise((ok, falha) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "application/pdf");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) aoAvancar?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? ok() : falha(new Error(`o armazenamento recusou o arquivo (${xhr.status}) ${String(xhr.responseText || "").slice(0, 160)}`)));
    xhr.onerror = () => falha(new Error("não consegui enviar o arquivo (rede ou bloqueio do armazenamento)"));
    xhr.send(arquivo);
  });
}
