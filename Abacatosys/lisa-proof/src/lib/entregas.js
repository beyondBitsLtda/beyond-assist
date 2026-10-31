// A entrega por evidências chega como formulário (multipart), com os arquivos em binário: base64
// dentro de um JSON pesaria um terço a mais e custaria CPU do Worker para ler. Aqui o formulário vira
// o objeto que src/lib/pratica.js (entregarEvidencia) confere e manda para a IA.
//
// Campos: texto, video (link do YouTube), imagem (até 3 arquivos), miniatura (uma por imagem, data
// URL pequena de JPEG, feita no navegador), audio (WAV) e segundos (a duração do áudio).
// Nada é gravado: as fotos e o áudio só passam por aqui a caminho da IA.

import { ErroDeAcesso } from "./sessao.js";
import { LIMITES_DA_EVIDENCIA } from "@/dominio/motores.js";

// O maior formulário aceito: 3 fotos no limite e o áudio mais longo, com folga.
const MAXIMO_DO_FORMULARIO = LIMITES_DA_EVIDENCIA.imagens * LIMITES_DA_EVIDENCIA.bytesPorImagem
  + (LIMITES_DA_EVIDENCIA.segundosDeAudio.projeto + 2) * LIMITES_DA_EVIDENCIA.bytesPorSegundoDeAudio + 512_000;

const ehArquivo = (v) => v && typeof v === "object" && typeof v.arrayBuffer === "function";
const emBase64 = async (arquivo) => Buffer.from(await arquivo.arrayBuffer()).toString("base64");

export async function lerEntrega(req) {
  const tamanho = Number(req.headers.get("content-length") || 0);
  if (tamanho > MAXIMO_DO_FORMULARIO) throw new ErroDeAcesso(413, "a entrega passou do tamanho máximo — fotos menores ou um áudio mais curto");
  let form;
  try {
    form = await req.formData();
  } catch {
    throw new ErroDeAcesso(400, "pedido inválido");
  }
  const miniaturas = form.getAll("miniatura").map((m) => String(m));
  const arquivosDeImagem = form.getAll("imagem").filter(ehArquivo);
  if (arquivosDeImagem.length > LIMITES_DA_EVIDENCIA.imagens) throw new ErroDeAcesso(400, `no máximo ${LIMITES_DA_EVIDENCIA.imagens} fotos`);
  const imagens = await Promise.all(arquivosDeImagem.map(async (arquivo, i) => ({
    tipo: arquivo.type, bytes: arquivo.size, miniatura: miniaturas[i] || null,
    // arquivo grande demais nem é lido: a conferência recusa pelo tamanho
    data: arquivo.size <= LIMITES_DA_EVIDENCIA.bytesPorImagem ? await emBase64(arquivo) : "",
  })));
  const arquivoDeAudio = form.get("audio");
  const audio = ehArquivo(arquivoDeAudio) && arquivoDeAudio.size > 0
    ? {
      tipo: arquivoDeAudio.type, bytes: arquivoDeAudio.size, segundos: Number(form.get("segundos")) || 0,
      data: arquivoDeAudio.size <= MAXIMO_DO_FORMULARIO ? await emBase64(arquivoDeAudio) : "",
    }
    : null;
  return { texto: String(form.get("texto") || ""), video: String(form.get("video") || ""), imagens, audio };
}
