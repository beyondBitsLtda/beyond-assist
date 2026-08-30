// Corta um par substituto (surrogate pair — como emoji e outros caracteres fora do plano
// básico do Unicode, que em JS ocupam 2 "code units") empurra a posição 1 char pra trás, pra
// nunca separar a metade alta da metade baixa. Achado num caso real: um pedaço de
// index.html (repo Beyond-Interview) cortou bem no meio de um desses, produzindo uma
// "metade alta" solta no fim do pedaço — o JS deixa passar sem erro nenhum (JSON.stringify
// nem reclama), mas vira bytes UTF-8 inválidos quando sai pela rede, e o Postgres recusa
// com "invalid input syntax for type json" ao tentar gravar em `metadata`/pelo corpo da
// requisição inteira — sem indicar em nada que o problema era um emoji cortado ao meio.
function avoidSplitSurrogate(text, pos) {
  if (pos <= 0 || pos >= text.length) return pos;
  const code = text.charCodeAt(pos - 1);
  if (code >= 0xd800 && code <= 0xdbff) return pos - 1; // metade ALTA na última posição → empurra pra trás
  return pos;
}

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
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) end = avoidSplitSurrogate(clean, end);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = avoidSplitSurrogate(clean, end - overlap); // sobreposição — mesmo cuidado no início do próximo pedaço
  }
  return chunks;
}
