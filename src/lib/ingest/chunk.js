/**
 * Divide um texto longo em pedaços com sobreposição, para embeddar.
 * Cards de Trello costumam ser curtos (1 chunk); notas do Brain podem ser longas.
 */
export function chunkText(text, { size = 1200, overlap = 200 } = {}) {
  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap; // sobreposição
  }
  return chunks;
}
