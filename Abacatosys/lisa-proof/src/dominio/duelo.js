// O Duelo de Lógica com a Lisa (03/11/2026, ideia dela: "um minijogo onde eu te desafio com testes rápidos de
// código e raciocínio; se você me vencer, rouba moedas do meu reino; se perder, fica sem recursos"). Puro: as
// perguntas, o sorteio delas, as respostas da Lisa, a correção e quem paga quem. O banco e as moedas ficam em
// src/lib/duelo.js. Testado em scripts/dominio-check.mjs (inclusive o gabarito de cada pergunta).

export const DUELO = {
  perguntas: 5,
  mistura: [1, 1, 2, 2, 3],         // as dificuldades das 5 perguntas
  segundosPorPergunta: 25,
  folgaSegundos: 10,                // a rede: depois disso, o duelo venceu e conta como derrota
  apostas: [20, 50, 100],
  porDia: 3,
  // a Lisa acerta com esta chance, pela dificuldade (em média ~3,7 de 5: para ganhar, tem que estudar)
  chanceDaLisa: { 1: 0.85, 2: 0.7, 3: 0.55 },
};

/**
 * As perguntas: `certa` é o índice da opção correta (só o servidor vê). `codigo` aparece num bloco de código.
 * Curtas de propósito: são 25 segundos cada.
 */
export const PERGUNTAS_DO_DUELO = [
  { id: "js-soma-texto", tipo: "codigo", dificuldade: 1, pergunta: "O que este JavaScript imprime?", codigo: 'console.log(2 + "2")', opcoes: ["4", "22", "NaN", "Dá erro"], certa: 1 },
  { id: "py-len", tipo: "codigo", dificuldade: 1, pergunta: "O que este Python imprime?", codigo: 'print(len("proof"))', opcoes: ["4", "5", "6", "Dá erro"], certa: 1 },
  { id: "seq-dobro", tipo: "logica", dificuldade: 1, pergunta: "Qual número continua a sequência 2, 4, 8, 16, …?", opcoes: ["24", "30", "32", "64"], certa: 2 },
  { id: "silogismo-gato", tipo: "logica", dificuldade: 1, pergunta: "Todo gato é felino. Tom é um gato. Então…", opcoes: ["Tom é felino", "Todo felino é gato", "Tom não é felino", "Nada se conclui"], certa: 0 },
  { id: "js-length", tipo: "codigo", dificuldade: 1, pergunta: "Quanto vale esta expressão em JavaScript?", codigo: "[1, 2, 3].length", opcoes: ["2", "3", "4", "undefined"], certa: 1 },
  { id: "py-div-inteira", tipo: "codigo", dificuldade: 2, pergunta: "O que este Python imprime?", codigo: "print(7 // 2)", opcoes: ["3", "3.5", "4", "1"], certa: 0 },
  { id: "js-typeof-null", tipo: "codigo", dificuldade: 2, pergunta: "O que este JavaScript imprime?", codigo: "console.log(typeof null)", opcoes: ['"null"', '"object"', '"undefined"', '"number"'], certa: 1 },
  { id: "seq-fibonacci", tipo: "logica", dificuldade: 2, pergunta: "Qual número continua a sequência 1, 1, 2, 3, 5, 8, …?", opcoes: ["11", "12", "13", "21"], certa: 2 },
  { id: "py-compreensao", tipo: "codigo", dificuldade: 2, pergunta: "O que este Python imprime?", codigo: "print([x * 2 for x in range(3)])", opcoes: ["[2, 4, 6]", "[0, 2, 4]", "[0, 1, 2]", "[0, 2, 4, 6]"], certa: 1 },
  { id: "bola-taco", tipo: "logica", dificuldade: 2, pergunta: "Uma bola e um taco custam R$ 1,10 juntos. O taco custa R$ 1,00 a mais que a bola. Quanto custa a bola?", opcoes: ["R$ 0,10", "R$ 0,05", "R$ 0,01", "R$ 1,00"], certa: 1 },
  { id: "sql-count-vazio", tipo: "codigo", dificuldade: 1, pergunta: "O que esta consulta SQL devolve?", codigo: "SELECT COUNT(*) FROM alunos WHERE 1 = 0;", opcoes: ["0", "1", "NULL", "Dá erro"], certa: 0 },
  { id: "js-ponto-flutuante", tipo: "codigo", dificuldade: 2, pergunta: "O que este JavaScript imprime?", codigo: "console.log(0.1 + 0.2 === 0.3)", opcoes: ["true", "false", "Dá erro", "undefined"], certa: 1 },
  { id: "seq-tres", tipo: "logica", dificuldade: 1, pergunta: "Qual número continua a sequência 3, 6, 9, 12, …?", opcoes: ["13", "14", "15", "18"], certa: 2 },
  { id: "js-referencia", tipo: "codigo", dificuldade: 3, pergunta: "O que este JavaScript imprime?", codigo: "let a = [1, 2, 3];\nlet b = a;\nb.push(4);\nconsole.log(a.length);", opcoes: ["3", "4", "Dá erro", "undefined"], certa: 1 },
  { id: "py-padrao-mutavel", tipo: "codigo", dificuldade: 3, pergunta: "O que este Python imprime?", codigo: "def f(x, lista=[]):\n    lista.append(x)\n    return len(lista)\n\nf(1)\nprint(f(2))", opcoes: ["1", "2", "Dá erro", "0"], certa: 1 },
  { id: "binario-1011", tipo: "logica", dificuldade: 2, pergunta: "Quanto é 1011 (binário) em decimal?", opcoes: ["9", "10", "11", "13"], certa: 2 },
  { id: "busca-binaria", tipo: "codigo", dificuldade: 2, pergunta: "Qual a complexidade da busca binária num vetor ordenado de n itens?", opcoes: ["O(1)", "O(log n)", "O(n)", "O(n²)"], certa: 1 },
  { id: "chuva-rua", tipo: "logica", dificuldade: 3, pergunta: "Se chove, a rua fica molhada. A rua está molhada. Então…", opcoes: ["Choveu, com certeza", "Não choveu", "Não dá para concluir que choveu", "A rua nunca seca"], certa: 2 },
  { id: "py-repete-texto", tipo: "codigo", dificuldade: 1, pergunta: "O que este Python imprime?", codigo: 'print("ab" * 3)', opcoes: ["ab3", "ababab", "Dá erro", "aaabbb"], certa: 1 },
  { id: "js-sort-texto", tipo: "codigo", dificuldade: 2, pergunta: "O que este JavaScript imprime?", codigo: "console.log([10, 1, 3].sort())", opcoes: ["[1, 3, 10]", "[1, 10, 3]", "[10, 3, 1]", "[3, 1, 10]"], certa: 1 },
  { id: "apertos-de-mao", tipo: "logica", dificuldade: 2, pergunta: "Numa sala com 5 pessoas, cada uma aperta a mão de todas as outras uma vez. Quantos apertos de mão?", opcoes: ["5", "10", "20", "25"], certa: 1 },
  { id: "py-or", tipo: "codigo", dificuldade: 3, pergunta: "O que este Python imprime?", codigo: 'print([] or 0 or "ok")', opcoes: ["False", "0", "ok", "[]"], certa: 2 },
  { id: "git-checkout-b", tipo: "codigo", dificuldade: 2, pergunta: "Qual comando cria uma branch nova e já muda para ela?", opcoes: ["git branch nova", "git checkout -b nova", "git merge nova", "git push nova"], certa: 1 },
  { id: "seq-n-n1", tipo: "logica", dificuldade: 3, pergunta: "Qual número continua a sequência 2, 6, 12, 20, 30, …?", opcoes: ["40", "42", "36", "44"], certa: 1 },
  { id: "html-link", tipo: "codigo", dificuldade: 1, pergunta: "Qual tag do HTML cria um link para outra página?", opcoes: ["<link>", "<a>", "<href>", "<url>"], certa: 1 },
  { id: "js-var-closure", tipo: "codigo", dificuldade: 3, pergunta: "O que este JavaScript imprime?", codigo: "for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}", opcoes: ["0 1 2", "3 3 3", "0 0 0", "Dá erro"], certa: 1 },
  { id: "dia-da-semana", tipo: "logica", dificuldade: 1, pergunta: "Hoje é segunda-feira. Que dia da semana será daqui a 10 dias?", opcoes: ["Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"], certa: 1 },
  { id: "sql-having", tipo: "codigo", dificuldade: 2, pergunta: "No SQL, qual cláusula filtra os grupos depois do GROUP BY?", opcoes: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], certa: 1 },
  { id: "lampadas-calor", tipo: "logica", dificuldade: 2, pergunta: "Três interruptores do lado de fora acendem três lâmpadas num quarto, e você só pode entrar uma vez. Além de acesa ou apagada, que pista resolve qual é qual?", opcoes: ["A cor da luz", "O calor da lâmpada", "O barulho", "O tamanho"], certa: 1 },
  { id: "py-set", tipo: "codigo", dificuldade: 2, pergunta: "O que este Python imprime?", codigo: "print({1, 2, 2, 3})", opcoes: ["{1, 2, 2, 3}", "{1, 2, 3}", "[1, 2, 3]", "Dá erro"], certa: 1 },
  { id: "horas-minutos", tipo: "logica", dificuldade: 1, pergunta: "Quantos minutos há em 2,5 horas?", opcoes: ["120", "125", "150", "250"], certa: 2 },
  { id: "laco-aninhado", tipo: "codigo", dificuldade: 3, pergunta: "Dois laços, um dentro do outro, cada um indo de 1 a n. Qual a complexidade?", opcoes: ["O(n)", "O(2n)", "O(n²)", "O(log n)"], certa: 2 },
];
export const perguntaPorId = (id) => PERGUNTAS_DO_DUELO.find((p) => p.id === id) || null;

/** Sorteia as perguntas do duelo, pela mistura de dificuldades, sem repetir. `s`: um sorteio (0–1). */
export function montarDuelo(s) {
  const usadas = new Set();
  return DUELO.mistura.map((dif) => {
    const opcoes = PERGUNTAS_DO_DUELO.filter((p) => p.dificuldade === dif && !usadas.has(p.id));
    const p = opcoes[Math.floor(s() * opcoes.length)];
    usadas.add(p.id);
    return p.id;
  });
}

/** As respostas da Lisa: acerta com a chance da dificuldade; quando erra, marca outra opção. */
export function respostasDaLisa(ids, s) {
  return ids.map((id) => {
    const p = perguntaPorId(id);
    if (s() < DUELO.chanceDaLisa[p.dificuldade]) return p.certa;
    const erradas = p.opcoes.map((_, i) => i).filter((i) => i !== p.certa);
    return erradas[Math.floor(s() * erradas.length)];
  });
}

/** A pergunta para a tela: sem o gabarito. */
export function perguntaParaTela(id) {
  const p = perguntaPorId(id);
  return { id: p.id, tipo: p.tipo, dificuldade: p.dificuldade, pergunta: p.pergunta, codigo: p.codigo || "", opcoes: p.opcoes };
}

/** Corrige: quantas a pessoa acertou (resposta ausente ou fora da lista é erro). */
export function corrigir(ids, respostas) {
  const lista = Array.isArray(respostas) ? respostas : [];
  const detalhe = ids.map((id, i) => {
    const p = perguntaPorId(id);
    const r = Number.isInteger(lista[i]) ? lista[i] : null;
    return { id, certa: p.certa, resposta: r, acertou: r === p.certa };
  });
  return { acertos: detalhe.filter((d) => d.acertou).length, detalhe };
}

export function resultadoDoDuelo(acertos, acertosDaLisa) {
  return acertos > acertosDaLisa ? "venceu" : acertos < acertosDaLisa ? "perdeu" : "empate";
}

/**
 * Quem paga quem no fim (a aposta já saiu do saldo da pessoa no começo): venceu, recebe a aposta de volta
 * mais a mesma quantia tirada do reino da Lisa; empate, recebe a aposta de volta; perdeu, a aposta vai para a Lisa.
 */
export function movimentosDoDuelo(resultado, aposta) {
  if (resultado === "venceu") return { jogador: aposta * 2, lisa: -aposta };
  if (resultado === "empate") return { jogador: aposta, lisa: 0 };
  return { jogador: 0, lisa: aposta };
}

/** Dá para começar um duelo? */
export function podeDuelar({ aposta, saldo, saldoDaLisa, feitosHoje, temAberto = false }) {
  if (!DUELO.apostas.includes(aposta)) return { ok: false, motivo: `escolha uma aposta: ${DUELO.apostas.join(", ")} moedas` };
  if (temAberto) return { ok: false, motivo: "termine o duelo que já está aberto" };
  if (feitosHoje >= DUELO.porDia) return { ok: false, motivo: `já foram os ${DUELO.porDia} duelos de hoje: amanhã tem mais` };
  if (saldo < aposta) return { ok: false, motivo: `faltam ${Math.ceil(aposta - saldo)} moedas para essa aposta` };
  if (saldoDaLisa < aposta) return { ok: false, motivo: "a Lisa não tem moedas para cobrir essa aposta agora" };
  return { ok: true };
}

/** O prazo: todas as perguntas mais a folga da rede. */
export const segundosDoDuelo = () => DUELO.perguntas * DUELO.segundosPorPergunta + DUELO.folgaSegundos;
