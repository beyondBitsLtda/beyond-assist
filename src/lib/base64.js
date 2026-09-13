// Base64 com APIs da web (atob/btoa/TextEncoder), sem `Buffer`.
//
// `Buffer` é do Node e não existe no Edge runtime do Cloudflare. Estas três funções fazem o
// mesmo e funcionam nos dois lugares — inclusive no navegador, o que permite mover trabalho pro
// cliente quando fizer sentido.
//
// Dois detalhes que quebram implementações ingênuas, e por isso estão tratados aqui:
//
//  - O GitHub devolve base64 com QUEBRAS DE LINHA a cada 60 caracteres. `atob` não aceita, então
//    o espaço em branco é removido antes.
//  - `btoa` só entende bytes, não texto. Acentos precisam virar bytes UTF-8 antes, senão
//    "configuração" vira lixo ou lança erro.

/** base64 → bytes. */
export function b64ParaBytes(b64) {
  const limpo = String(b64 || "").replace(/\s+/g, "");
  const bin = atob(limpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** base64 → texto UTF-8. */
export function b64ParaTexto(b64) {
  return new TextDecoder("utf-8").decode(b64ParaBytes(b64));
}

/**
 * texto UTF-8 → base64.
 *
 * Em pedaços porque `String.fromCharCode(...bytes)` espalha um argumento por byte e estoura a
 * pilha em arquivos de algumas centenas de KB — que é exatamente o tamanho dos arquivos que a
 * Lisa manda pro GitHub ao abrir um pull request.
 */
export function textoParaB64(texto) {
  const bytes = new TextEncoder().encode(String(texto ?? ""));
  const PEDACO = 8192;
  let bin = "";
  for (let i = 0; i < bytes.length; i += PEDACO) {
    bin += String.fromCharCode(...bytes.subarray(i, i + PEDACO));
  }
  return btoa(bin);
}
