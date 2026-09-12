// A ROTINA da Lisa — o que ela faz, e a que horas.
//
// Antes isto era um sorteio: um saco embaralhado de atividades, tirado a cada poucos segundos.
// Funcionava como variedade e falhava como VIDA — ela regava a horta às três da manhã e ia
// olhar as estrelas ao meio-dia, e o resultado parecia aleatório porque era.
//
// Agora o dia tem forma. Cada faixa de horas tem um punhado de ações que fazem sentido naquela
// hora, e o sorteio acontece DENTRO da faixa: dois dias nunca são idênticos, mas a manhã sempre
// parece manhã. É isso que faz parecer que tem alguém com uma vida ali, e não um gerador.
//
// A hora é a de verdade do aparelho. Abrir às três da tarde mostra ela na oficina; abrir de
// madrugada mostra a casa apagada. O Modo Deus consegue acelerar o relógio pra você ver o dia
// inteiro em poucos minutos.

/**
 * As ações possíveis. `em` é onde acontece (chave de construção, "casa", ou um tile fixo);
 * `anim` é a animação que o desenho usa; `precisa` é a construção necessária — sem ela a ação
 * simplesmente não entra no dia.
 */
export const ACOES = {
  acordar:   { label: "acordando",                anim: "espreguicar", em: "casa",     ms: 6000,  dentro: true },
  cafe:      { label: "tomando café",             anim: "beber",       em: "casa",     ms: 9000,  dentro: true },
  janela:    { label: "abrindo a janela",         anim: "abrir",       em: "casa",     ms: 5000,  dentro: true },
  regar:     { label: "regando a horta",          anim: "regar",       em: "horta",    ms: 14000, precisa: "horta" },
  colher:    { label: "colhendo da horta",        anim: "agachar",     em: "horta",    ms: 11000, precisa: "horta" },
  estufa:    { label: "cuidando da estufa",       anim: "regar",       em: "estufa",   ms: 12000, precisa: "estufa" },
  flores:    { label: "cuidando das flores",      anim: "agachar",     em: "flores",   ms: 10000, precisa: "flores" },
  almoco:    { label: "almoçando",                anim: "comer",       em: "casa",     ms: 16000, dentro: true },
  oficina:   { label: "consertando algo na oficina", anim: "martelar", em: "oficina",  ms: 16000, precisa: "oficina" },
  bancada:   { label: "mexendo na bancada",       anim: "martelar",    em: "oficina",  ms: 13000, precisa: "oficina" },
  varrer:    { label: "varrendo o quintal",       anim: "varrer",      em: [11, 17],   ms: 14000 },
  varal:     { label: "estendendo roupa",         anim: "estender",    em: "varal",    ms: 13000, precisa: "varal" },
  nala:      { label: "brincando com a Nala",     anim: "lancar",      em: [13, 21],   ms: 18000 },
  poco:      { label: "tirando água do poço",     anim: "manivela",    em: "poco",     ms: 11000, precisa: "poco" },
  correio:   { label: "vendo se chegou carta",    anim: "abrir",       em: "correio",  ms: 8000,  precisa: "correio" },
  radio:     { label: "ouvindo música",           anim: "balancar",    em: "radio",    ms: 16000, precisa: "radio" },
  banco:     { label: "sentada no banco",         anim: "sentar",      em: "banco",    ms: 15000, precisa: "banco" },
  piscina:   { label: "na beira da piscina",      anim: "sentar",      em: "piscina",  ms: 14000, precisa: "piscina" },
  mesa:      { label: "jantando lá fora",         anim: "comer",       em: "mesa",     ms: 15000, precisa: "mesa" },
  churras:   { label: "acendendo a churrasqueira", anim: "abanar",     em: "churras",  ms: 14000, precisa: "churras" },
  fogueira:  { label: "na fogueira",              anim: "sentar",      em: "fogueira", ms: 18000, precisa: "fogueira" },
  estrelas:  { label: "olhando as estrelas",      anim: "olharCima",   em: [19, 24],   ms: 14000 },
  mirante:   { label: "no mirante",               anim: "olharCima",   em: "mirante",  ms: 13000, precisa: "mirante" },
  lago:      { label: "olhando o lago",           anim: "sentar",      em: "lago",     ms: 13000, precisa: "lago" },
  poente:    { label: "vendo o sol se pôr",       anim: "olharCima",   em: [20, 22],   ms: 12000 },
  // a antena é o que traz o Steve: ele só aparece depois que ela levanta a antena lá fora
  steve:     { label: "recebendo o Steve",        anim: "abrir",       em: [9, 12],    ms: 18000, precisa: "antena" },
  passear:   { label: "dando uma volta",          anim: "andar",       em: null,       ms: 9000 },
  dormir:    { label: "dormindo",                 anim: "dormir",      em: "casa",     ms: 60000, dentro: true },
};

/**
 * O dia. `de`/`ate` em horas (a última faixa cruza a meia-noite de propósito).
 *
 * Fora a madrugada, toda faixa tem DUAS ações que não dependem de construção nenhuma. Uma só não
 * basta: num terreno recém-aberto ela ficava três horas seguidas olhando as estrelas, porque era
 * a única coisa que a noite oferecia sem nada construído. Duas já fazem o sorteio alternar, e
 * cada construção nova vai engrossando a faixa.
 */
export const BLOCOS = [
  { de: 6,  ate: 8,  nome: "manhã cedo",   acoes: ["acordar", "janela", "cafe"] },
  { de: 8,  ate: 11, nome: "manhã",        acoes: ["regar", "colher", "estufa", "varrer", "correio", "passear"] },
  { de: 11, ate: 13, nome: "almoço",       acoes: ["almoco", "passear"] },
  { de: 13, ate: 16, nome: "tarde",        acoes: ["oficina", "bancada", "poco", "passear", "varrer"] },
  { de: 16, ate: 18, nome: "fim de tarde", acoes: ["nala", "varal", "varrer", "flores", "steve"] },
  { de: 18, ate: 20, nome: "anoitecer",    acoes: ["poente", "radio", "banco", "piscina", "mesa", "churras", "nala"] },
  { de: 20, ate: 23, nome: "noite",        acoes: ["fogueira", "estrelas", "mirante", "lago", "radio", "passear"] },
  { de: 23, ate: 6,  nome: "madrugada",    acoes: ["dormir"] },
];

/** Em que faixa do dia cai esta hora. */
export function blocoDa(hora) {
  const h = ((hora % 24) + 24) % 24;
  return BLOCOS.find((b) => (b.de < b.ate ? h >= b.de && h < b.ate : h >= b.de || h < b.ate)) || BLOCOS[0];
}

/** As ações que ela consegue fazer nesta hora, com o que já existe construído. */
export function acoesDaHora(hora, construido = []) {
  const tem = new Set(construido);
  const bloco = blocoDa(hora);
  const possiveis = bloco.acoes.filter((k) => {
    const a = ACOES[k];
    return a && (!a.precisa || tem.has(a.precisa));
  });
  // nenhuma faixa pode ficar vazia: sem nada construído ela ainda passeia pelo terreno
  return possiveis.length ? possiveis : ["passear"];
}

/**
 * Sorteia dentro da faixa sem repetir a última — o dia tem forma fixa, mas não é o mesmo filme
 * toda vez.
 */
export function proximaAcao(hora, construido, ultima = null) {
  const opcoes = acoesDaHora(hora, construido);
  if (opcoes.length === 1) return opcoes[0];
  const sem = opcoes.filter((k) => k !== ultima);
  return sem[Math.floor(Math.random() * sem.length)];
}

/** É noite pro desenho (céu escuro, poste aceso). */
export const ehNoite = (hora) => hora < 6 || hora >= 19;

/**
 * A hora do mundo: `base` mais o tempo passado desde então, no ritmo de `aceleracao`. Com
 * aceleração 1 é o relógio de verdade do aparelho — o dia dela é o seu. Com aceleração alta o
 * relógio corre e dá pra ver um dia inteiro em dois minutos, que é o "acelerar o dia" do Modo
 * Deus. `base` e `desde` juntos também permitem pular a hora (virar dia, virar noite).
 */
export function horaDoMundo({ base, desde, agora, aceleracao = 1 }) {
  const h = base + ((agora - desde) / 3600000) * aceleracao;
  return ((h % 24) + 24) % 24;
}
