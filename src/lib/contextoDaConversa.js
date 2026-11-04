// O contexto que a pessoa põe na conversa com a Lisa, além do que ela fala (25/10/2026): imagens
// anexadas (o + da barra de mensagem, ou Ctrl+V) e repositórios vinculados (ver
// src/lib/repositorioNaConversa.js). Junto com a tela (Modo Tela) e a câmera (Modo Observância),
// tudo vai para a mesma pergunta — e a Lisa é instruída a relacionar uma coisa com a outra.
//
// Puro: serve à tela (o que mandar) e à rota /api/ask (o que aceitar e como explicar ao modelo).

export const MAX_ANEXOS = 6;            // imagens anexadas pela pessoa
export const MAX_IMAGENS = 9;           // por pedido: os anexos + a tela + a câmera
export const MAX_LADO_DO_ANEXO = 1600;  // px — o anexo é reduzido no navegador antes de ir
const MAX_BASE64 = 7_000_000;           // ~5 MB por imagem, já reduzida
const TIPOS = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"]);
const ORIGENS = new Set(["anexo", "tela", "camera"]);

const limparNome = (n) => String(n || "").replace(/[^\p{L}\p{N} ._()-]+/gu, "").trim().slice(0, 80);

/** As imagens que valem num pedido, cada uma com a origem: { mimeType, data, origem, nome }. */
export function imagensValidas(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((img) => img && typeof img.data === "string" && img.data.length > 0 && img.data.length <= MAX_BASE64 && TIPOS.has(img.mimeType))
    .slice(0, MAX_IMAGENS)
    .map((img) => ({
      mimeType: img.mimeType,
      data: img.data,
      // as antigas (sem origem) são a câmera e a tela do jeito de antes
      origem: ORIGENS.has(img.origem) ? img.origem : null,
      nome: limparNome(img.nome),
    }));
}

/**
 * O aviso ao modelo do que é cada imagem, na ordem em que vão. Sem ele, o Gemini não sabe que pode
 * (e deve) olhar para elas — nem que o print colado e a tela ao vivo são coisas diferentes.
 */
export function notaDasImagens(imagens) {
  if (!imagens?.length) return null;
  const descricao = (img) => {
    if (img.origem === "anexo") return `uma imagem que o usuário ANEXOU à conversa${img.nome ? ` ("${img.nome}")` : ""} — um print, uma foto, um diagrama ou um erro que ele quer que você veja`;
    if (img.origem === "tela") return "a captura da TELA do computador do usuário, tirada agora (Modo Tela)";
    if (img.origem === "camera") return "uma foto da CÂMERA do usuário, tirada agora (postura, roupa, gesto, expressão — Modo Observância)";
    return "uma imagem tirada agora: a câmera do usuário (Modo Observância) ou a tela do computador dele (Modo Tela)";
  };
  const linhas = imagens.map((img, i) => `${i + 1}. ${descricao(img)}`);
  return [
    `Há ${imagens.length > 1 ? `${imagens.length} IMAGENS anexadas` : "uma IMAGEM anexada"}, nesta ordem:`,
    ...linhas,
    "Use o que você vê nelas como contexto da conversa: se a pergunta for sobre elas (ou sobre algo que aparece nelas),",
    "responda com base NAS IMAGENS de verdade — não invente. Relacione as imagens entre si e com o resto do contexto",
    "(o código de um repositório vinculado, a conversa). Se a pergunta não tiver nada a ver com as imagens, ignore-as.",
  ].join("\n");
}
