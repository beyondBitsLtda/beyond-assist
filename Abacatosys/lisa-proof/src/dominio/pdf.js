// Um PDF de uma página com uma imagem JPEG ocupando a página inteira — o certificado do Modo
// Domínio (24/10/2026), desenhado na tela e baixado como PDF. Escrito à mão (o formato é simples
// para uma imagem só) para não trazer uma biblioteca de PDF inteira para o navegador. Puro.
//
// O JPEG entra como está (filtro DCTDecode): o PDF é a moldura e o leitor de PDF decodifica.

const enc = new TextEncoder();

/**
 * O PDF (Uint8Array) com `jpeg` (bytes de um JPEG RGB de `largura`×`altura` pixels) cobrindo uma
 * página de `larguraPt`×`alturaPt` pontos (A4 deitado = 842×595).
 */
export function pdfDeJpeg(jpeg, largura, altura, { larguraPt = 842, alturaPt = 595, titulo = "Certificado" } = {}) {
  if (!(jpeg instanceof Uint8Array) || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("a imagem precisa ser um JPEG");
  const partes = [];
  const offsets = [];
  let tamanho = 0;
  const escrever = (p) => { const b = typeof p === "string" ? enc.encode(p) : p; partes.push(b); tamanho += b.length; };
  const objeto = (n, corpo) => { offsets[n] = tamanho; escrever(`${n} 0 obj\n`); for (const c of [].concat(corpo)) escrever(c); escrever("\nendobj\n"); };

  // título só com ASCII seguro (o dicionário Info aceita texto simples)
  const tituloSeguro = String(titulo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");
  const conteudo = `q ${larguraPt} 0 0 ${alturaPt} 0 0 cm /Im0 Do Q`;

  escrever("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${larguraPt} ${alturaPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  objeto(4, [`<< /Type /XObject /Subtype /Image /Width ${largura} /Height ${altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, "\nendstream"]);
  objeto(5, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
  objeto(6, `<< /Title (${tituloSeguro}) /Producer (Lisa_Proof) >>`);

  const inicioDoXref = tamanho;
  escrever(`xref\n0 7\n0000000000 65535 f \n`);
  for (let n = 1; n <= 6; n++) escrever(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  escrever(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${inicioDoXref}\n%%EOF\n`);

  const pdf = new Uint8Array(tamanho);
  let p = 0;
  for (const b of partes) { pdf.set(b, p); p += b.length; }
  return pdf;
}
