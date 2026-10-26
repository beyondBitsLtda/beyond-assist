// AS PROJEÇÕES DOS CONSULTORES (26/10/2026) — o segredo da Mesa dos Consultores. Puro, como o resto
// de src/dominio, mas SÓ O SERVIDOR importa este arquivo (src/lib/bolsa.js e os testes): aqui está
// o jeito de errar de cada consultor, e no navegador ele viraria cola. Quem eles são (história,
// personalidade, a faixa que DIZEM ter) mora em src/dominio/consultores.js.
//
// Como funciona: a Lisa decide onde cada ação FECHA logo no primeiro acesso do dia, e esse
// fechamento fica guardado no servidor (a tela nunca recebe). Cada consultor "projeta" o fechamento
// a partir dele, errando do seu jeito:
//
//   projeção = exagero × variação de verdade + viés + ruído
//
// - o RUÍDO tem um tamanho que muda TODO DIA (humorDoDia): é a margem de erro do dia, que ninguém vê;
// - o EXAGERO é o Barão achando que tudo anda pouco (< 1) ou a Madame achando que tudo anda muito (> 1);
// - o VIÉS é a Luna vendo alta em tudo e o Gorgo vendo crise em tudo;
// - há o DIA RUIM (o modelo do Corvo quebra) e as faixas da Madame (dias de visão clara, de neblina);
// - a Dona Zuleica entende de comida e arredonda tudo.
//
// Tudo sai de sorteios com semente (o consultor, a ação e o dia): a mesma projeção para todo mundo,
// sem guardar nada no banco — o placar dos dias passados é recalculado a partir dos preços. (Mudar
// os números daqui muda também as projeções antigas no placar; é o preço de não guardar.)
//
// A tela só recebe a projeção, a faixa declarada e a frase. O fechamento de verdade, o erro e o
// placar do dia só aparecem depois que o pregão fecha (FECHA_AS).

import { CONSULTORES, consultorPorId } from "./consultores.js";
import { sorteio, sementeDaAcao, variacaoReal, VARIACAO_MAXIMA } from "./bolsa.js";
import { centavos } from "./moedas.js";

/** Quantos pregões passados entram no placar da mesa. */
export const PREGOES_NO_PLACAR = 7;

// ---------------------------------------------------------------- o segredo de cada consultor
//
// erro: faixas [peso, de, até] do tamanho do ruído do dia, em pontos percentuais (o desvio típico).
// exagero e vies: [de, até], sorteados por dia. diaRuim: a chance de um dia ruim, que multiplica o
// erro por multRuim. erroDoSetor / viesDoSetor: o que muda num setor. aposta: o que ele recomenda.

const ESTILOS = {
  ametista: { erro: [[0.15, 0.8, 2], [0.45, 5, 10], [0.4, 10, 18]], exagero: [1.3, 1.6], vies: [-1, 1], aposta: "maior" },
  barao: { erro: [[1, 1.5, 5]], exagero: [0.35, 0.6], vies: [-1, 0.3], diaRuim: 0.1, multRuim: 2.5, aposta: "maior" },
  luna: { erro: [[1, 3, 7]], exagero: [1.05, 1.3], vies: [2, 5], viesDoSetor: { "Tecnologia": 3, "Exploração espacial": 3 }, diaRuim: 0.12, multRuim: 2, aposta: "alta" },
  corvo: { erro: [[1, 1.5, 4.5]], exagero: [0.85, 1], vies: [-0.5, 0.5], diaRuim: 0.08, multRuim: 3.5, aposta: "maior" },
  zuleica: { erro: [[1, 1.5, 12]], exagero: [0.8, 1.2], vies: [-1, 1], erroDoSetor: { "Alimentos": 0.5 }, arredonda: true, aposta: "maior" },
  gorgo: { erro: [[1, 3, 8]], exagero: [0.9, 1.2], vies: [-6, -2.5], diaRuim: 0.1, multRuim: 2, aposta: "queda" },
};

// ---------------------------------------------------------------- o que cada um fala
//
// {t} o código da ação, {n} o nome da empresa, {p} a variação projetada ("+4,2%").
// Os rumos: disparar (≥ 8%), subir (≥ 2%), lado, cair (≤ −2%), despencar (≤ −8%).

const FALAS = {
  ametista: {
    disparar: ["As cartas gritam: {t} vai aos céus, {p}!", "Vejo ouro jorrando de {n}… {p} antes do sol se pôr.", "A Estrela e o Sol na mesma tirada: {t} dispara {p}."],
    subir: ["Uma brisa favorável sopra para {t}: {p}.", "A bola de cristal brilha em dourado para {n} ({p}).", "Vejo sorrisos no cais: {t} sobe {p}."],
    lado: ["A neblina cobre {t}… nada se move ({p}).", "As cartas de {n} se calam hoje: {p}.", "O Eremita apareceu para {t}: um dia parado ({p})."],
    cair: ["Nuvens escuras sobre {t}… {p}.", "A Torre invertida! {n} escorrega {p}.", "Sinto um arrepio quando penso em {t}: {p}."],
    despencar: ["A Morte apareceu três vezes para {t}: {p}!", "Vejo um naufrágio! {n} afunda {p}.", "Fujam de {t}! As gaivotas voam para longe ({p})."],
    comentarios: ["Acendi as velas, embaralhei as cartas e a bola de cristal falou. Ela nunca se engana.", "A lua está em Peixes, o que é ótimo para quem escuta Madame Ametista.", "Sonhei com o pregão de hoje inteirinho. Anotei tudo antes de esquecer.", "Hoje a bola de cristal está mais clara do que nunca. Como sempre."],
    aposta: { alta: "Minha visão mais forte do dia: {t}, {p}. Está escrito.", queda: "Minha visão mais forte do dia: fujam de {t}, {p}. Está escrito." },
  },
  barao: {
    disparar: ["{n} deve subir {p}. Não vejo tanta animação desde 1987.", "Hum. {t} com {p}. Euforia demais para o meu gosto, mas os números mandam.", "Subida forte em {t}: {p}. Guarde parte do lucro no cofre."],
    subir: ["{n}: alta moderada de {p}. Como deve ser.", "{t} sobe {p}. Nada de exageros, por favor.", "Prevejo {p} para {t}. Sólido como uma barra de ouro."],
    lado: ["{t} fica onde está ({p}). Como um bom cofre.", "{n}: dia calmo, {p}. Os melhores dias são assim.", "Nada a declarar sobre {t} ({p}). Sigo tomando meu café."],
    cair: ["{t} recua {p}. Um ajuste saudável, eu diria.", "{n} perde {p}. Nada que um pouco de paciência não resolva.", "Prudência com {t}: {p}."],
    despencar: ["{t} cai {p}. Em 1952 foi pior, mas não muito.", "Tempos difíceis para {n}: {p}. Mantenha a calma e o monóculo.", "Recolha as velas em {t}: {p}."],
    comentarios: ["Bom dia. Conferi o livro-caixa três vezes e tomei meu café sem açúcar. Podemos começar.", "O mercado sempre exagera, meu jovem. Eu, não.", "Na minha época, uma ação subia 1% e já era notícia de jornal.", "Revisei as contas à luz de velas. Os números não têm pressa — e eu também não."],
    aposta: { alta: "Se me permite uma única recomendação: {t}, {p}. Com moderação.", queda: "Se me permite um único conselho: cautela com {t}, {p}." },
  },
  luna: {
    disparar: ["{t} VAI PRA LUA 🚀🚀 {p} e olhe lá!", "Gente, {n}… {p}. Eu tô tremendo!", "Se você não comprar {t} hoje vai chorar amanhã: {p} 🚀"],
    subir: ["{t} tá subindo de foguete, {p} fácil 📈", "Vibe boa demais em {n}: {p}!", "O chat inteiro tá comprando {t}: {p} 🔥"],
    lado: ["{t} tá abastecendo o foguete… {p} hoje, amanhã decola!", "{n} tá de boa, {p}. Calmaria antes da explosão 🚀", "Hoje {t} só respira ({p}). Paciência, galera."],
    cair: ["{t} vai cair {p}? Desconto, gente! Promoção!", "{n} {p}, mas isso é só o foguete fazendo curva 🛸", "Respira: {t} {p} é só uma correçãozinha."],
    despencar: ["Tá, {t} {p}… mas quem tem fé não vende!", "{n} {p}?! É o mercado testando quem tem mão de diamante 💎", "Eu nem queria {t} mesmo ({p}). Bora pra próxima!"],
    comentarios: ["BOM DIA, FOGUETEIROS! 🚀 Hoje o chat tá pegando fogo!", "Acordei sentindo cheiro de alta. Confia!", "Live começando! Já separei as ações que vão pra lua hoje.", "Quem chegou agora: aqui a gente só pensa em subir 📈"],
    aposta: { alta: "A MINHA FAVORITA DE HOJE: {t} {p} 🚀🚀🚀", queda: "Hoje até eu tô com medo de {t}: {p} 😬" },
  },
  corvo: {
    disparar: ["{t}: {p}. Estatisticamente raro, mas os dados insistem.", "Projeção para {n}: {p}. Revisei duas vezes. Crá.", "Estimativa pontual de {t}: {p}. Um desvio fora do comum."],
    subir: ["{t}: {p}, dentro do esperado.", "Modelo para {n}: {p}. Os resíduos estão comportados.", "Média móvel favorável: {t} com {p}."],
    lado: ["{t}: {p}. Ruído, apenas ruído.", "Sem sinal estatístico em {n}: {p}.", "Variação esperada de {t}: {p}. Nada que mereça uma pena."],
    cair: ["{t}: {p}. A regressão não perdoa.", "Projeção negativa para {n}: {p}.", "{t} com {p}: a tendência é clara para quem lê a tabela."],
    despencar: ["{t}: {p}. Recomendo revisar a exposição. Crá.", "Queda acentuada em {n}: {p}. Os dados são cruéis.", "{t} com {p}. Fora do intervalo habitual — e mesmo assim provável."],
    comentarios: ["Calibrei o modelo com os pregões anteriores. Margem de erro sob controle. Crá.", "Lembrete: uma projeção não é uma promessa. É uma estimativa com variância.", "Os dados de ontem já estão na planilha. Vamos aos números.", "Hoje testei três modelos e fiquei com o de menor erro. Naturalmente."],
    aposta: { alta: "Maior sinal do dia: {t}, {p}. Significância aceitável.", queda: "Maior sinal do dia: {t}, {p}. Reduza a exposição." },
  },
  zuleica: {
    disparar: ["Ih, {t} vai subir que nem pão no forno: uns {p}!", "Meu joelho nem doeu hoje: {n} {p}, pode apostar.", "Fila na banca é sinal de festa: {t} {p}!"],
    subir: ["{t} tá igual tomate na safra: subindo, uns {p}.", "O povo tá comprando à vista, meu bem: {n} {p}.", "Freguês feliz, ação feliz: {t} {p}."],
    lado: ["{t} tá morna feito chá da tarde: {p}.", "Nem sobe nem desce, igual feira de terça: {n} {p}.", "{t}? Fica quietinha hoje, meu filho: {p}."],
    cair: ["Tomate passou do ponto: {t} {p}.", "O povo tá comprando fiado… {n} {p}.", "Quem muito sobe, um dia desce: {t} {p}."],
    despencar: ["Ai, meu Deus, {t} vai murchar que nem alface no sol: {p}!", "Meu joelho tá doendo de chuva forte: {n} {p}.", "Xi, {t} {p}. Vende antes que estrague, meu filho!"],
    comentarios: ["Bom dia, meu bem! A feira hoje começou cedo, e eu já tenho meus palpites.", "O tomate subiu dez centavos. Isso diz muita coisa, viu?", "Passei um café e conversei com os fregueses. Já sei de tudo.", "Meu joelho tá quieto hoje. Bom sinal… ou não."],
    aposta: { alta: "Se fosse tomate, eu levava {t}: uns {p}. Escuta a Zuleica.", queda: "Se fosse tomate, eu nem tocava em {t}: uns {p}. Escuta a Zuleica." },
  },
  gorgo: {
    disparar: ["{t} {p}?! Isso é bolha. Vai estourar… amanhã, talvez.", "Grr. Até eu admito: {n} {p}. Não se acostume.", "{t} vai subir {p}. Aproveite antes da crise."],
    subir: ["{t} {p}. Sobe hoje pra cair amanhã.", "{n} com {p}. Não se empolgue.", "Hum. {t} {p}. Por enquanto."],
    lado: ["{t} parada ({p}). A calmaria antes da tempestade.", "{n} {p}. Até o tédio é suspeito.", "Nada acontece com {t} ({p}). Ainda."],
    cair: ["Eu avisei: {t} {p}.", "{n} {p}. E isso é só o começo.", "{t} {p}. O cheiro de medo não engana."],
    despencar: ["CRISE! {t} {p}! Corram para as cavernas!", "{n} {p}. Eu vi isso na Grande Queda das Pepitas.", "{t} {p}. Hiberne e não olhe o pregão."],
    comentarios: ["Grr. Mais um dia, mais uma bolha.", "O céu amanheceu cinzento. O pregão também vai.", "Não me venham com otimismo antes do café.", "Já vi esse filme. Termina mal."],
    aposta: { alta: "Nem eu acho que {t} cai hoje: {p}. Grr.", queda: "O que eu venderia hoje: {t}, {p}. De nada." },
  },
};

// ---------------------------------------------------------------- a conta

const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
const umaCasa = (x) => Math.round(x * 10) / 10;
const entre = (r, [de, ate]) => de + r() * (ate - de);
/** Um sorteio quase normal (média 0, desvio 1): a soma de 6 sorteios, sem seno nem logaritmo. */
const normal = (r) => (r() + r() + r() + r() + r() + r() - 3) * Math.SQRT2;
const escolher = (r, lista) => lista[Math.floor(r() * lista.length) % lista.length];

/** "+4,2%" / "−3%" / "0%": com o sinal de menos tipográfico, como o resto da bolsa. */
export function pctDaFala(v) {
  const a = Math.abs(v);
  const n = Number.isInteger(a) ? String(a) : a.toFixed(1).replace(".", ",");
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${n}%`;
}

/** O rumo de uma variação, para escolher a fala. */
export const rumoDaFala = (v) => (v >= 8 ? "disparar" : v >= 2 ? "subir" : v > -2 ? "lado" : v > -8 ? "cair" : "despencar");

/** Para que lado andou (ou vai andar): menos de 1% para qualquer lado é "de lado". */
const lado = (v) => (v >= 1 ? 1 : v <= -1 ? -1 : 0);

const falar = (modelo, acao, v) => modelo.replaceAll("{t}", acao.id).replaceAll("{n}", acao.nome || acao.id).replaceAll("{p}", pctDaFala(v));

/**
 * O humor de um consultor num dia — O SEGREDO: o tamanho do erro (desvio típico do ruído, em
 * pontos percentuais), o exagero, o viés e se é um dia ruim. Nunca vai para a tela.
 */
export function humorDoDia(id, dia) {
  const e = ESTILOS[id];
  if (!e) throw new Error(`consultor desconhecido: ${id}`);
  const r = sorteio(sementeDaAcao(`humor|${id}`, dia));
  let x = r(), faixa = e.erro[e.erro.length - 1];
  for (const f of e.erro) { if (x < f[0]) { faixa = f; break; } x -= f[0]; }
  let erro = entre(r, [faixa[1], faixa[2]]);
  const ruim = r() < (e.diaRuim || 0);
  if (ruim) erro *= e.multRuim || 2;
  return { erro, exagero: entre(r, e.exagero), vies: entre(r, e.vies), ruim };
}

/**
 * A projeção de um consultor para o fechamento de uma ação num dia. `acao`: { id, nome, setor,
 * abertura, fechamento } — o fechamento é o de verdade (o segredo do dia), e não sai daqui.
 */
export function projetar(id, dia, acao) {
  const e = ESTILOS[id];
  const h = humorDoDia(id, dia);
  const real = variacaoReal(acao.abertura, acao.fechamento);
  const r = sorteio(sementeDaAcao(`${id}|${acao.id}`, dia));
  const erroDoSetor = e.erroDoSetor?.[acao.setor] ?? 1;
  let v = h.exagero * real + h.vies + (e.viesDoSetor?.[acao.setor] || 0) + normal(r) * h.erro * erroDoSetor;
  v = limitar(v, -(VARIACAO_MAXIMA + 10), VARIACAO_MAXIMA + 10);
  v = e.arredonda ? Math.round(v) : umaCasa(v);
  if (Object.is(v, -0)) v = 0;
  const faixa = consultorPorId(id).faixaDeclarada;
  const precoEm = (x) => Math.max(0.01, centavos(acao.abertura * (1 + x / 100)));
  return {
    acao: acao.id,
    variacao: v,
    preco: precoEm(v),
    faixa: { de: precoEm(v - faixa), ate: precoEm(v + faixa) },
    frase: falar(escolher(r, FALAS[id][rumoDaFala(v)]), acao, v),
  };
}

/** Como a projeção se saiu: o erro (em pontos percentuais), se acertou o lado e se caiu na faixa que ele declarou. */
export function avaliar(id, projecao, real) {
  const erro = umaCasa(Math.abs(projecao.variacao - real));
  return { erro, direcao: lado(projecao.variacao) === lado(real), naFaixa: erro <= consultorPorId(id).faixaDeclarada + 1e-9 };
}

/** A nota do dia (0 a 10): 10 menos o erro médio, em pontos percentuais. */
export const notaPeloErro = (erroMedio) => umaCasa(limitar(10 - erroMedio, 0, 10));

/** O placar de um consultor num dia já fechado: as projeções e como cada uma se saiu. */
function placarDe(id, dia, acoes) {
  const linhas = acoes.map((a) => {
    const real = variacaoReal(a.abertura, a.fechamento);
    return { a, real, p: projetar(id, dia, a), av: null };
  });
  for (const l of linhas) l.av = avaliar(id, l.p, l.real);
  const total = linhas.length;
  const somaDoErro = linhas.reduce((s, l) => s + l.av.erro, 0);
  const erroMedio = total ? umaCasa(somaDoErro / total) : 0;
  return {
    linhas, total, somaDoErro, erroMedio, nota: notaPeloErro(erroMedio),
    acertos: linhas.filter((l) => l.av.direcao).length,
    naFaixa: linhas.filter((l) => l.av.naFaixa).length,
  };
}

/** A recomendação do dia: a maior projeção (Luna só vê alta; Gorgo só vê queda, se houver). */
function apostaDe(id, projecoes, acoes) {
  if (!projecoes.length) return null;
  const tipo = ESTILOS[id].aposta;
  const porTamanho = [...projecoes].sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));
  let p = porTamanho[0];
  if (tipo === "alta") { const m = [...projecoes].sort((a, b) => b.variacao - a.variacao)[0]; if (m.variacao >= 1) p = m; }
  if (tipo === "queda") { const m = [...projecoes].sort((a, b) => a.variacao - b.variacao)[0]; if (m.variacao <= -1) p = m; }
  const acao = acoes.find((a) => a.id === p.acao);
  return { acao: p.acao, variacao: p.variacao, preco: p.preco, frase: falar(FALAS[id].aposta[p.variacao < 0 ? "queda" : "alta"], acao, p.variacao) };
}

/**
 * O relatório da mesa, do jeito que a tela recebe — SEM o segredo: nada do humor do dia e nada do
 * fechamento de hoje enquanto o pregão não fecha.
 *
 *   hoje      o dia de hoje (AAAA-MM-DD)
 *   revelado  o pregão de hoje já fechou (dá para mostrar como cada um se saiu)
 *   dias      [{ dia, acoes: [{ id, nome, emoji, setor, abertura, fechamento }] }] — hoje e os
 *             pregões passados (sem as estreias, que não têm o que projetar)
 */
export function relatorioDaMesa({ hoje, revelado = false, dias = [] }) {
  const deHoje = dias.find((d) => d.dia === hoje)?.acoes || [];
  const passados = dias.filter((d) => d.dia < hoje && d.acoes.length).sort((a, b) => (a.dia < b.dia ? 1 : -1)).slice(0, PREGOES_NO_PLACAR);
  const fechados = (revelado && deHoje.length ? [{ dia: hoje, acoes: deHoje }] : []).concat(passados);

  // o placar de cada dia fechado, para todos os consultores (e quem foi o melhor do dia)
  const placares = fechados.map(({ dia, acoes }) => {
    const porConsultor = new Map(CONSULTORES.map((c) => [c.id, placarDe(c.id, dia, acoes)]));
    let melhor = null;
    for (const c of CONSULTORES) if (!melhor || porConsultor.get(c.id).erroMedio < porConsultor.get(melhor).erroMedio) melhor = c.id;
    return { dia, porConsultor, melhor };
  });
  const resumoDoDia = (pl, id) => {
    const x = pl.porConsultor.get(id);
    return { dia: pl.dia, nota: x.nota, erroMedio: x.erroMedio, acertos: x.acertos, naFaixa: x.naFaixa, total: x.total, melhor: pl.melhor === id };
  };

  const consultores = CONSULTORES.map((c) => {
    const projecoes = deHoje.map((a) => {
      const p = projetar(c.id, hoje, a);
      if (!revelado) return p;
      const real = variacaoReal(a.abertura, a.fechamento);
      return { ...p, resultado: { variacao: real, preco: a.fechamento, ...avaliar(c.id, p, real) } };
    });
    const historico = placares.map((pl) => resumoDoDia(pl, c.id));
    const doPlacar = placares.map((pl) => pl.porConsultor.get(c.id));
    const total = doPlacar.reduce((s, x) => s + x.total, 0);
    const erroMedio = total ? umaCasa(doPlacar.reduce((s, x) => s + x.somaDoErro, 0) / total) : null;
    const r = sorteio(sementeDaAcao(`fala|${c.id}`, hoje));
    return {
      id: c.id,
      comentario: escolher(r, FALAS[c.id].comentarios),
      aposta: apostaDe(c.id, projecoes, deHoje),
      projecoes,
      hoje: revelado && placares[0]?.dia === hoje ? resumoDoDia(placares[0], c.id) : null,
      historico,
      resumo: total ? {
        pregoes: placares.length, total, erroMedio, nota: notaPeloErro(erroMedio),
        acertos: doPlacar.reduce((s, x) => s + x.acertos, 0),
        naFaixa: doPlacar.reduce((s, x) => s + x.naFaixa, 0),
        vitorias: placares.filter((pl) => pl.melhor === c.id).length,
      } : null,
    };
  });

  const ultimo = placares.find((pl) => pl.dia < hoje);
  const ranking = (pl) => CONSULTORES.map((c) => ({ id: c.id, ...resumoDoDia(pl, c.id) })).sort((a, b) => a.erroMedio - b.erroMedio);
  return {
    dia: hoje,
    revelado: Boolean(revelado && deHoje.length),
    temProjecoes: deHoje.length > 0,
    consultores,
    placarDeHoje: revelado && placares[0]?.dia === hoje ? { dia: hoje, ranking: ranking(placares[0]) } : null,
    ultimoPregao: ultimo ? { dia: ultimo.dia, ranking: ranking(ultimo) } : null,
  };
}
