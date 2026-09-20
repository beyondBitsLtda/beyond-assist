// Tarefas que se repetem.
//
// A decisão de fundo: cada repetição vira um CARD DE VERDADE, e o que fica guardado é só o
// molde. O caminho fácil seria um card mágico que muda de data sozinho ao ser concluído — e aí
// "quantas vezes isso foi feito em agosto" deixa de ter resposta, porque só existe um card e
// ele só sabe a última vez. Com cards de verdade, o histórico é o próprio quadro.
//
// Nada aqui fala com o banco: recebe uma regra e uma data, devolve a próxima data. É o que
// permite o `npm run dominio-check` exercitar virada de mês, ano bissexto e dia 31 em
// fevereiro sem subir nada.

/**
 * A gramática das regras, em texto, guardada numa coluna `text`:
 *
 *   diaria              todo dia
 *   semanal:1,3,5       segunda, quarta e sexta   (1 = segunda … 7 = domingo, como na ISO)
 *   mensal:15           todo dia 15
 *   mensal:ultimo       o último dia de cada mês
 *
 * Texto e não três colunas porque acrescentar "a cada duas semanas" depois deve ser um caso
 * novo aqui dentro, não uma migração de esquema num banco que já está em uso.
 */
export function lerRegra(regra) {
  const bruto = String(regra || "").trim().toLowerCase();
  const [tipo, resto] = bruto.split(":");

  if (tipo === "diaria") return { tipo: "diaria" };

  if (tipo === "semanal") {
    const dias = (resto || "")
      .split(",")
      .map((d) => Number(d.trim()))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    // Sem dia nenhum a regra nunca dispararia, e um card recorrente que nunca aparece é pior
    // que nenhum: ele fica na lista parecendo que funciona.
    if (!dias.length) return null;
    return { tipo: "semanal", dias: [...new Set(dias)].sort((a, b) => a - b) };
  }

  if (tipo === "mensal") {
    if (resto === "ultimo") return { tipo: "mensal", dia: "ultimo" };
    const dia = Number(resto);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null;
    return { tipo: "mensal", dia };
  }

  return null;
}

/** A regra em português, para a tela. */
export function regraEmPalavras(regra) {
  const r = lerRegra(regra);
  if (!r) return "regra inválida";
  if (r.tipo === "diaria") return "todo dia";
  if (r.tipo === "semanal") {
    const nomes = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
    const lista = r.dias.map((d) => nomes[d]);
    if (lista.length === 1) return `toda ${lista[0]}`;
    return `toda ${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
  }
  if (r.dia === "ultimo") return "no último dia do mês";
  return `todo dia ${r.dia}`;
}

const DIA = 24 * 60 * 60 * 1000;

/** Segunda = 1 … domingo = 7. O `getDay()` do JavaScript usa domingo = 0, que é a origem de
 *  metade dos erros de um dia em código de calendário. */
function diaIso(d) {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Meia-noite local do mesmo dia, preservando a hora escolhida pelo usuário. */
function comHorarioDe(molde, alvo) {
  const d = new Date(alvo);
  d.setHours(molde.getHours(), molde.getMinutes(), 0, 0);
  return d;
}

/**
 * A próxima vez depois de `desde`.
 *
 * "Depois" é estrito: chamada com a data da ocorrência atual, devolve a SEGUINTE, nunca a
 * mesma. Sem isso, materializar uma tarefa atrasada entraria num laço criando o mesmo card
 * para sempre.
 */
export function proximaOcorrencia(regra, desde) {
  const r = lerRegra(regra);
  if (!r) return null;
  const base = new Date(desde);

  if (r.tipo === "diaria") return comHorarioDe(base, new Date(base.getTime() + DIA));

  if (r.tipo === "semanal") {
    // No máximo sete passos: algum dia da semana sempre cai dentro de uma semana.
    for (let i = 1; i <= 7; i++) {
      const tentativa = new Date(base.getTime() + i * DIA);
      if (r.dias.includes(diaIso(tentativa))) return comHorarioDe(base, tentativa);
    }
    return null;
  }

  // Mensal. O dia 31 não existe em todo mês, e fevereiro não tem dia 30: quando o dia pedido
  // não cabe no mês, a tarefa cai no último dia dele. A alternativa — pular o mês — faria uma
  // tarefa de dia 31 sumir em quatro meses do ano sem ninguém entender por quê.
  for (let salto = 1; salto <= 13; salto++) {
    const mes = new Date(base.getFullYear(), base.getMonth() + salto, 1);
    const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const dia = r.dia === "ultimo" ? ultimoDia : Math.min(r.dia, ultimoDia);
    const tentativa = new Date(mes.getFullYear(), mes.getMonth(), dia);
    if (tentativa.getTime() > base.getTime()) return comHorarioDe(base, tentativa);
  }
  return null;
}

/**
 * Quantas ocorrências venceram até agora, e qual seria a próxima depois delas.
 *
 * Uma tarefa diária num quadro que ficou duas semanas sem ser aberto tem catorze ocorrências
 * vencidas. Criar as catorze enterraria a coluna; criar só uma perderia o histórico. O meio
 * termo é um teto: cria até `teto` e joga o relógio para a frente, porque o que interessa é
 * "isto está pendente", não encenar duas semanas que ninguém viveu.
 */
export function ocorrenciasVencidas(regra, proximaEm, agora = new Date(), teto = 5) {
  // A regra é conferida ANTES do laço. Sem isto, uma regra inválida cuja data já passou gerava
  // uma ocorrência — o laço só descobria o problema ao tentar calcular a SEGUINTE, e o card
  // já tinha sido contado. Uma regra que ninguém sabe cumprir não deve produzir tarefa nenhuma.
  if (!lerRegra(regra)) return { vencidas: [], proxima: null };

  const vencidas = [];
  let marco = new Date(proximaEm);
  let guarda = 0;

  while (marco.getTime() <= agora.getTime() && guarda < 400) {
    if (vencidas.length < teto) vencidas.push(new Date(marco));
    const seguinte = proximaOcorrencia(regra, marco);
    if (!seguinte) return { vencidas, proxima: null };
    marco = seguinte;
    guarda++;
  }

  return { vencidas, proxima: marco };
}
