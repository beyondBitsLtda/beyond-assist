// Exercita o calendário do quadro (src/dominio/calendario.js).
//
// O defeito que este arquivo existe para pegar é o dia errado: um prazo que cai numa segunda
// à noite aparecendo na terça, porque alguém comparou datas em UTC. Por isso os testes medem
// em hora LOCAL — o mesmo relógio que o navegador de quem olha usa.

import { chaveDoDia, semanasDoMes, cardsPorDia, prazoNoDia } from "../src/dominio/calendario.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

console.log("\n1) a grade do mês");
{
  // Setembro de 2026 começa numa terça e termina numa quarta.
  const set = semanasDoMes(2026, 8);
  conferir("toda semana tem 7 dias", set.every((s) => s.length === 7));
  conferir("a grade começa na segunda anterior (31/08)", set[0][0].chave === "2026-08-31", set[0][0].chave);
  conferir("termina no domingo depois do fim do mês (04/10)", set.at(-1).at(-1).chave === "2026-10-04", set.at(-1).at(-1).chave);
  conferir("os 30 dias de setembro estão lá, e só eles marcados como do mês",
    set.flat().filter((d) => d.doMes).length === 30);
  conferir("dia 1 cai na terça (2ª casa)", set[0][1].chave === "2026-09-01" && set[0][1].doMes);

  // Junho de 2026 começa numa segunda: nada do mês anterior entra.
  const jun = semanasDoMes(2026, 5);
  conferir("mês que começa na segunda não puxa dia de fora", jun[0][0].chave === "2026-06-01" && jun[0][0].doMes);

  // Maio de 2026 termina num domingo: a última semana fecha no dia 31, sem semana extra.
  const mai = semanasDoMes(2026, 4);
  conferir("mês que termina no domingo não ganha semana a mais", mai.at(-1).at(-1).chave === "2026-05-31", mai.at(-1).at(-1).chave);

  // Fevereiro de 2027 começa numa segunda e tem 28 dias: exatamente 4 semanas.
  conferir("fevereiro certinho tem 4 semanas", semanasDoMes(2027, 1).length === 4);
}

console.log("\n2) em que dia o card aparece");
{
  const noite = new Date(2026, 8, 28, 22, 30); // segunda, 22h30 locais
  conferir("prazo às 22h30 de segunda fica na segunda", chaveDoDia(noite) === "2026-09-28", chaveDoDia(noite));

  const cards = [
    { id: "b", fimEm: new Date(2026, 8, 28, 17, 0).toISOString() },
    { id: "a", fimEm: new Date(2026, 8, 28, 9, 0).toISOString() },
    { id: "c", fimEm: null },
    { id: "d", fimEm: new Date(2026, 9, 2, 12, 0).toISOString() },
  ];
  const { porDia, semData } = cardsPorDia(cards);
  conferir("dois cards no mesmo dia, em ordem de horário",
    porDia.get("2026-09-28")?.map((c) => c.id).join() === "a,b", porDia.get("2026-09-28")?.map((c) => c.id).join());
  conferir("card sem entrega vai para a lista à parte, e não some", semData.length === 1 && semData[0].id === "c");
  conferir("card de outro mês fica no dia dele", porDia.get("2026-10-02")?.[0]?.id === "d");
}

console.log("\n3) arrastar para outro dia");
{
  const antes = new Date(2026, 8, 28, 17, 15).toISOString();
  const depois = new Date(prazoNoDia(antes, "2026-10-01"));
  conferir("o dia muda", chaveDoDia(depois) === "2026-10-01", chaveDoDia(depois));
  conferir("o horário fica (17h15)", depois.getHours() === 17 && depois.getMinutes() === 15, `${depois.getHours()}:${depois.getMinutes()}`);

  const semPrazo = new Date(prazoNoDia(null, "2026-10-05"));
  conferir("sem prazo antes, entra às 18h", chaveDoDia(semPrazo) === "2026-10-05" && semPrazo.getHours() === 18);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
