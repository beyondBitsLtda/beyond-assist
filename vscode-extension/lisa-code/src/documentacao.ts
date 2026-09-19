// Cópia da detecção do servidor, para a extensão executar sem ida à rede.
//
// A ferramenta find_undocumented roda do lado do CLIENTE, como todas as outras: é o arquivo do
// usuário que está sendo lido, e ele nunca sai da máquina dele. Por isso a lógica precisa
// existir dos dois lados — o servidor só DECLARA a ferramenta, quem executa é aqui.
//
// Se um dia divergir do original (src/lib/documentacao.js), quem percebe é
// `npm run documentacao-check`, que roda a mesma bateria contra os dois.

const DECLARACOES: Array<{ tipo: string; re: RegExp }> = [
  { tipo: "função", re: /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
  { tipo: "classe", re: /^export\s+class\s+([A-Za-z_$][\w$]*)/ },
  { tipo: "constante", re: /^export\s+const\s+([A-Za-z_$][\w$]*)/ },
  { tipo: "componente", re: /^export\s+default\s+function\s+([A-Za-z_$][\w$]*)/ },
];

function temComentarioAcima(linhas: string[], indice: number): boolean {
  for (let i = indice - 1; i >= 0; i--) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    if (linha.startsWith("//")) return true;
    if (linha.endsWith("*/")) return true;
    if (linha.startsWith("*")) return true;
    return false;
  }
  return false;
}

export type SemDoc = { nome: string; tipo: string; linha: number };

export function exportacoesSemDoc(codigo: string): SemDoc[] {
  const linhas = String(codigo || "").split("\n");
  const faltando: SemDoc[] = [];
  linhas.forEach((linha, i) => {
    for (const { tipo, re } of DECLARACOES) {
      const m = re.exec(linha);
      if (!m) continue;
      if (!temComentarioAcima(linhas, i)) faltando.push({ nome: m[1], tipo, linha: i + 1 });
      break;
    }
  });
  return faltando;
}

export function resumoDaDocumentacao(codigo: string) {
  const linhas = String(codigo || "").split("\n");
  let total = 0;
  linhas.forEach((linha) => {
    if (DECLARACOES.some(({ re }) => re.test(linha))) total++;
  });
  const semDoc = exportacoesSemDoc(codigo);
  return { total, semDoc: semDoc.length, documentados: total - semDoc.length, itens: semDoc };
}
