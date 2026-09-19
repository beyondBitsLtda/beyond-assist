// Acha o que está exportado e não está explicado.
//
// Existe porque "documente este arquivo" é um pedido vago: o modelo tende a reescrever o que
// já está bom e a inventar comentário onde o código já fala por si. Entregar a ELE a lista do
// que realmente falta transforma um pedido difuso numa tarefa com bordas.
//
// A detecção é por expressão regular, não por AST, seguindo o que o resto do projeto já faz
// (ver importGraph.js). Um parser acertaria mais nos casos exóticos, mas traria uma dependência
// pesada para dentro do Worker da Cloudflare, onde este código também roda — e o ganho seria
// sobre um punhado de declarações que quase nunca aparecem neste repositório.

/** Uma coisa exportada, do jeito que ela aparece escrita. */
const DECLARACOES = [
  { tipo: "função", re: /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
  { tipo: "classe", re: /^export\s+class\s+([A-Za-z_$][\w$]*)/ },
  { tipo: "constante", re: /^export\s+const\s+([A-Za-z_$][\w$]*)/ },
  { tipo: "componente", re: /^export\s+default\s+function\s+([A-Za-z_$][\w$]*)/ },
];

/**
 * A linha anterior já explica isto?
 *
 * Aceita tanto `/** ... *\/` quanto `//`, porque este projeto usa os dois: bloco para o "porquê"
 * longo, barra dupla para a nota curta ao lado da linha. Exigir um formato específico marcaria
 * como indocumentado justamente o que já está bem explicado do jeito da casa.
 */
function temComentarioAcima(linhas, indice) {
  for (let i = indice - 1; i >= 0; i--) {
    const linha = linhas[i].trim();
    if (!linha) continue;                    // linha em branco entre o comentário e o código
    if (linha.startsWith("//")) return true;
    if (linha.endsWith("*/")) return true;   // fim de um bloco /** ... */
    if (linha.startsWith("*")) return true;  // meio de um bloco
    return false;                            // achou código — não há comentário colado
  }
  return false;
}

/**
 * O que está exportado sem explicação nenhuma.
 *
 * Devolve `{ nome, tipo, linha }` de cada um, com a linha contada a partir de 1, que é como o
 * editor mostra — devolver a partir de 0 obrigaria quem usa a lembrar de somar, e alguém
 * eventualmente esqueceria.
 */
export function exportacoesSemDoc(codigo) {
  const linhas = String(codigo || "").split("\n");
  const faltando = [];

  linhas.forEach((linha, i) => {
    for (const { tipo, re } of DECLARACOES) {
      const m = re.exec(linha);
      if (!m) continue;
      if (!temComentarioAcima(linhas, i)) faltando.push({ nome: m[1], tipo, linha: i + 1 });
      break; // uma declaração por linha; `export default function` casaria duas vezes
    }
  });

  return faltando;
}

/**
 * Quanto do arquivo está explicado, em uma frase.
 *
 * Serve para a Lisa dizer "esse arquivo já está bem documentado" em vez de sair propondo
 * comentários que ninguém pediu — o caso mais comum em um repositório cuidado como este.
 */
export function resumoDaDocumentacao(codigo) {
  const linhas = String(codigo || "").split("\n");
  let total = 0;
  linhas.forEach((linha) => {
    if (DECLARACOES.some(({ re }) => re.test(linha))) total++;
  });
  const semDoc = exportacoesSemDoc(codigo);
  return { total, semDoc: semDoc.length, documentados: total - semDoc.length, itens: semDoc };
}
