/**
 * O calendário do quadro, em funções puras (BEYOND-0003).
 *
 * Tudo aqui é HORA LOCAL de quem olha, de propósito. O calendário roda no navegador, e o dia
 * em que um prazo cai é o dia do relógio da pessoa: um prazo às 22h de segunda, em Brasília,
 * é segunda — em UTC já seria terça, e o card apareceria no dia errado sem erro nenhum.
 */

const p2 = (n) => String(n).padStart(2, "0");

/** "AAAA-MM-DD" do dia LOCAL de uma data. É a chave que junta cards e casas do calendário. */
export function chaveDoDia(data) {
  const d = data instanceof Date ? data : new Date(data);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** A data local (meia-noite) de uma chave "AAAA-MM-DD". */
export function diaDaChave(chave) {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/**
 * As semanas de um mês, de segunda a domingo, sempre completas.
 *
 * O mês raramente começa numa segunda: os dias do mês anterior e do seguinte entram para
 * completar a primeira e a última semana, marcados com `doMes: false`. Uma grade com buracos
 * mudaria de formato a cada mês e desalinharia os dias da semana.
 *
 * `mes` vai de 0 a 11, como no `Date`.
 */
export function semanasDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  // getDay(): 0 = domingo. Aqui a semana começa na segunda, que é como o Brasil lê a agenda.
  const recuo = (primeiro.getDay() + 6) % 7;
  const inicio = new Date(ano, mes, 1 - recuo);

  const semanas = [];
  const cursor = new Date(inicio);
  do {
    const semana = [];
    for (let i = 0; i < 7; i++) {
      semana.push({ chave: chaveDoDia(cursor), dia: cursor.getDate(), doMes: cursor.getMonth() === mes });
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(semana);
  } while (cursor.getMonth() === mes);
  return semanas;
}

/**
 * Os cards de cada dia, pela ENTREGA (`fimEm`) — é o prazo que o calendário responde: "o que
 * vence quando?". Dentro do dia, em ordem de horário. Cards sem entrega voltam à parte, porque
 * não têm casa no calendário, e sumir com eles esconderia trabalho.
 */
export function cardsPorDia(cards) {
  const porDia = new Map();
  const semData = [];
  for (const c of cards) {
    if (!c.fimEm) { semData.push(c); continue; }
    const chave = chaveDoDia(c.fimEm);
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave).push(c);
  }
  for (const lista of porDia.values()) lista.sort((a, b) => new Date(a.fimEm) - new Date(b.fimEm));
  return { porDia, semData };
}

/**
 * O prazo novo de um card solto noutro dia: o DIA muda, o horário fica.
 *
 * Um card com entrega às 17h, arrastado de segunda para quinta, continua às 17h. Zerar a hora
 * adiantaria o prazo para a meia-noite — o começo do dia, e não o fim — sem ninguém pedir.
 * Sem prazo anterior, entra às 18h, o fim do expediente.
 */
export function prazoNoDia(fimAntes, chave) {
  const dia = diaDaChave(chave);
  const antes = fimAntes ? new Date(fimAntes) : null;
  dia.setHours(antes ? antes.getHours() : 18, antes ? antes.getMinutes() : 0, 0, 0);
  return dia.toISOString();
}

export const NOMES_DOS_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
