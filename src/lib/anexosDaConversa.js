// As imagens que a pessoa anexa à conversa com a Lisa (o + da barra, Ctrl+V ou arrastar para a
// tela), preparadas no NAVEGADOR antes de ir para /api/ask: lidas, reduzidas a no máximo
// MAX_LADO_DO_ANEXO px no lado maior e codificadas em base64. Um print de tela pequeno vai como
// PNG (sem perda: letra de código fica nítida); o resto vira JPEG. Só navegador.

import { MAX_LADO_DO_ANEXO } from "./contextoDaConversa.js";

const MAX_ARQUIVO = 25 * 1024 * 1024;
const PNG_SEM_MEXER = 1.8 * 1024 * 1024;

function carregar(url) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error("não consegui abrir essa imagem"));
    img.src = url;
  });
}

function base64DoArquivo(arquivo) {
  return new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result).split(",")[1] || "");
    leitor.onerror = () => erro(new Error("não consegui ler o arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}

let contador = 0;

/** Um arquivo de imagem vira um anexo: { id, nome, mimeType, data, previa, largura, altura }. */
export async function imagemParaAnexo(arquivo, nomePadrao = "imagem colada") {
  if (!arquivo || !String(arquivo.type || "").startsWith("image/")) throw new Error("só dá para anexar imagens");
  if (arquivo.size > MAX_ARQUIVO) throw new Error("imagem grande demais (máximo 25 MB)");
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregar(url);
    const largura = img.naturalWidth, altura = img.naturalHeight;
    const escala = Math.min(1, MAX_LADO_DO_ANEXO / Math.max(largura, altura));
    const nome = arquivo.name || nomePadrao;
    let mimeType, data;
    if (arquivo.type === "image/png" && escala === 1 && arquivo.size <= PNG_SEM_MEXER) {
      mimeType = "image/png";
      data = await base64DoArquivo(arquivo);
    } else {
      const w = Math.max(1, Math.round(largura * escala)), h = Math.max(1, Math.round(altura * escala));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // PNG com fundo transparente vira JPEG sem ficar preto
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      // print de tela reduzido continua PNG (texto nítido); foto vira JPEG
      const ehPrint = arquivo.type === "image/png";
      mimeType = ehPrint ? "image/png" : "image/jpeg";
      data = canvas.toDataURL(mimeType, 0.9).split(",")[1];
      if (ehPrint && data.length > 3_500_000) { mimeType = "image/jpeg"; data = canvas.toDataURL(mimeType, 0.9).split(",")[1]; }
    }
    if (!data) throw new Error("não consegui preparar essa imagem");
    return { id: `anexo-${Date.now()}-${++contador}`, nome, mimeType, data, previa: `data:${mimeType};base64,${data}`, largura, altura };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** As imagens de um Ctrl+V (um print copiado, ou arquivos de imagem copiados no explorador). */
export function imagensDaColagem(evento) {
  const itens = [...(evento?.clipboardData?.items || [])];
  return itens.filter((i) => i.kind === "file" && i.type.startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean);
}

/** As imagens de um arrastar-e-soltar. */
export function imagensSoltas(evento) {
  return [...(evento?.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
}
