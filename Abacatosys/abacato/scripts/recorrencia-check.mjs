// Exercita as regras de repetição.
//
// Elas merecem um script próprio porque calendário mente: fevereiro não tem dia 30, nem todo
// ano tem 29 de fevereiro, o `getDay()` do JavaScript começa no domingo e o horário de verão
// faz um dia ter 23 ou 25 horas. Cada um desses é um jeito de a tarefa recorrente simplesmente
// não aparecer — e um card que não aparece não dá erro nenhum, só não existe.

import { lerRegra, regraEmPalavras, proximaOcorrencia, ocorrenciasVencidas } from "../src/dominio/recorrencia.js";
import { linhasDeItens } from "../src/dominio/colar.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

/** Data local, para comparar com o que as funções devolvem (que também é local). */
const dia = (a, m, d, h = 9, min = 0) => new Date(a, m - 1, d, h, min, 0, 0);
const comoTexto = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "null");

console.log("\n1) ler a regra");
{
  conferir("diaria", lerRegra("diaria")?.tipo === "diaria");
  conferir("semanal com dias", JSON.stringify(lerRegra("semanal:1,3,5")?.dias) === "[1,3,5]");
  conferir("semanal ordena e tira repetido", JSON.stringify(lerRegra("semanal:5,1,5,3")?.dias) === "[1,3,5]");
  conferir("mensal com dia", lerRegra("mensal:15")?.dia === 15);
  conferir("mensal ultimo", lerRegra("mensal:ultimo")?.dia === "ultimo");

  // Tudo que não dá para cumprir tem de virar null AQUI, antes de chegar ao banco. Uma regra
  // inválida gravada vira uma tarefa que nunca dispara e que ninguém consegue diagnosticar.
  conferir("semanal sem dia nenhum é inválida", lerRegra("semanal:") === null);
  conferir("semanal com dia 0 é inválida", lerRegra("semanal:0") === null);
  conferir("semanal com dia 8 é inválida", lerRegra("semanal:8") === null);
  conferir("mensal:0 é inválida", lerRegra("mensal:0") === null);
  conferir("mensal:32 é inválida", lerRegra("mensal:32") === null);
  conferir("regra inventada é inválida", lerRegra("quinzenal") === null);
  conferir("vazio é inválido", lerRegra("") === null);
  conferir("nulo não quebra", lerRegra(null) === null);
}

console.log("\n2) a regra em português");
{
  conferir("diaria", regraEmPalavras("diaria") === "todo dia");
  conferir("um dia só", regraEmPalavras("semanal:3") === "toda quarta");
  conferir("vários dias", regraEmPalavras("semanal:1,3,5") === "toda segunda, quarta e sexta",
    regraEmPalavras("semanal:1,3,5"));
  conferir("mensal", regraEmPalavras("mensal:15") === "todo dia 15");
  conferir("último dia", regraEmPalavras("mensal:ultimo") === "no último dia do mês");
  conferir("inválida diz que é inválida", regraEmPalavras("semanal:") === "regra inválida");
}

console.log("\n3) diária");
{
  const p = proximaOcorrencia("diaria", dia(2026, 9, 20, 14, 30));
  conferir("pula um dia", comoTexto(p) === "2026-09-21 14:30", comoTexto(p));

  const viraMes = proximaOcorrencia("diaria", dia(2026, 9, 30));
  conferir("vira o mês", comoTexto(viraMes) === "2026-10-01 09:00", comoTexto(viraMes));

  const viraAno = proximaOcorrencia("diaria", dia(2026, 12, 31));
  conferir("vira o ano", comoTexto(viraAno) === "2027-01-01 09:00", comoTexto(viraAno));
}

console.log("\n4) semanal");
{
  // 2026-09-20 é um DOMINGO. Se o código usasse o getDay() cru (domingo = 0), isto daria o dia
  // errado — é exatamente o erro de um dia que este caso existe para pegar.
  conferir("20/09/2026 é mesmo domingo", dia(2026, 9, 20).getDay() === 0);

  const seg = proximaOcorrencia("semanal:1", dia(2026, 9, 20));
  conferir("do domingo, a próxima segunda é o dia seguinte", comoTexto(seg) === "2026-09-21 09:00", comoTexto(seg));

  const dom = proximaOcorrencia("semanal:7", dia(2026, 9, 20));
  conferir("de domingo para domingo dá uma semana", comoTexto(dom) === "2026-09-27 09:00", comoTexto(dom));

  const tres = proximaOcorrencia("semanal:1,3,5", dia(2026, 9, 21));  // segunda
  conferir("de segunda, a próxima de 1,3,5 é a quarta", comoTexto(tres) === "2026-09-23 09:00", comoTexto(tres));

  const sexta = proximaOcorrencia("semanal:1,3,5", dia(2026, 9, 25));  // sexta
  conferir("da sexta, volta para a segunda", comoTexto(sexta) === "2026-09-28 09:00", comoTexto(sexta));
}

console.log("\n5) mensal — onde o calendário mente");
{
  const q = proximaOcorrencia("mensal:15", dia(2026, 9, 15));
  conferir("do dia 15 vai para o 15 seguinte", comoTexto(q) === "2026-10-15 09:00", comoTexto(q));

  // Dia 31 em fevereiro: a tarefa cai no último dia do mês em vez de sumir. Pular faria uma
  // tarefa de dia 31 desaparecer em quatro meses do ano sem ninguém entender por quê.
  const fev = proximaOcorrencia("mensal:31", dia(2027, 1, 31));
  conferir("dia 31 em fevereiro cai no dia 28", comoTexto(fev) === "2027-02-28 09:00", comoTexto(fev));

  const bissexto = proximaOcorrencia("mensal:31", dia(2028, 1, 31));
  conferir("em ano bissexto, cai no 29", comoTexto(bissexto) === "2028-02-29 09:00", comoTexto(bissexto));

  const trinta = proximaOcorrencia("mensal:30", dia(2027, 1, 30));
  conferir("dia 30 em fevereiro também cai no 28", comoTexto(trinta) === "2027-02-28 09:00", comoTexto(trinta));

  const ultimo = proximaOcorrencia("mensal:ultimo", dia(2027, 1, 31));
  conferir("último dia de janeiro leva ao de fevereiro", comoTexto(ultimo) === "2027-02-28 09:00", comoTexto(ultimo));

  const ultimoAbril = proximaOcorrencia("mensal:ultimo", dia(2026, 3, 31));
  conferir("último de março leva ao de abril (30)", comoTexto(ultimoAbril) === "2026-04-30 09:00", comoTexto(ultimoAbril));
}

console.log("\n6) nunca devolve a mesma data");
{
  // Se devolvesse, materializar uma tarefa atrasada entraria num laço criando o mesmo card
  // para sempre — e o quadro encheria sozinho.
  for (const regra of ["diaria", "semanal:1,3,5", "semanal:7", "mensal:15", "mensal:ultimo", "mensal:31"]) {
    const base = dia(2026, 9, 20);
    const p = proximaOcorrencia(regra, base);
    conferir(`"${regra}" anda para a frente`, p && p.getTime() > base.getTime(), comoTexto(p));
  }
}

console.log("\n7) o que venceu enquanto ninguém olhava");
{
  const agora = dia(2026, 9, 20, 12, 0);

  const nada = ocorrenciasVencidas("diaria", dia(2026, 9, 21), agora);
  conferir("nada vencido ainda", nada.vencidas.length === 0);

  const tres = ocorrenciasVencidas("diaria", dia(2026, 9, 18, 9, 0), agora);
  conferir("três dias parados geram três", tres.vencidas.length === 3, `gerou ${tres.vencidas.length}`);
  conferir("e a próxima fica no futuro", tres.proxima.getTime() > agora.getTime(), comoTexto(tres.proxima));

  // Um mês sem abrir o quadro. O teto evita enterrar a coluna em trinta cards iguais, mas o
  // relógio anda até hoje — senão na próxima abertura viriam mais trinta.
  const mes = ocorrenciasVencidas("diaria", dia(2026, 8, 20, 9, 0), agora, 5);
  conferir("um mês parado respeita o teto de 5", mes.vencidas.length === 5, `gerou ${mes.vencidas.length}`);
  conferir("mas o relógio anda até depois de agora", mes.proxima.getTime() > agora.getTime(), comoTexto(mes.proxima));

  const invalida = ocorrenciasVencidas("semanal:", dia(2026, 9, 1), agora);
  conferir("regra inválida não gera nada e não trava", invalida.vencidas.length === 0 && invalida.proxima === null);
}

console.log("\n8) colar uma lista pronta dentro de uma checklist");
{
  const um = linhasDeItens("comprar cabo");
  conferir("uma linha vira um item", um.length === 1 && um[0] === "comprar cabo");

  const varias = linhasDeItens("comprar cabo\ntrocar fonte\ntestar");
  conferir("três linhas viram três itens", varias.length === 3, JSON.stringify(varias));

  // Cada fonte cola o próprio marcador junto. Guardá-lo dentro do texto faria a checklist
  // aparecer com dois marcadores: o do sistema e o que veio de fora.
  const marcados = linhasDeItens("- hífen\n* asterisco\n• bolinha\n1. numerado\n2) outro\n[ ] caixa\n[x] marcada");
  conferir("tira todos os marcadores", marcados.length === 7 && marcados[0] === "hífen" && marcados[5] === "caixa",
    JSON.stringify(marcados));

  const vazias = linhasDeItens("um\n\n\n   \ndois");
  conferir("linhas em branco somem", vazias.length === 2, JSON.stringify(vazias));

  const windows = linhasDeItens("um\r\ndois");
  conferir("quebra de linha do Windows também", windows.length === 2, JSON.stringify(windows));

  conferir("texto vazio não gera item", linhasDeItens("   \n  ").length === 0);
  conferir("nulo não quebra", linhasDeItens(null).length === 0);

  // Um traço no MEIO da frase não é marcador: "revisar o pós-venda" tem de chegar inteiro.
  const meio = linhasDeItens("revisar o pós-venda");
  conferir("hífen no meio da frase fica", meio[0] === "revisar o pós-venda", JSON.stringify(meio));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
