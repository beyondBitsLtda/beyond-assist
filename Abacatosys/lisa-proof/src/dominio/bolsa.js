// A BOLSA DO REINO (pedido de 23/10/2026): "um sistema de bolsa de investimento, uma espécie de
// banco, em que qualquer jogador pode investir em ações, vender e comprar; a Lisa cria todo dia
// ações novas e decide quais estão caindo ou subindo; tem que valer e ser a mesma para todos".
// Puro, como o resto de src/dominio — o banco e a IA moram em src/lib/bolsa.js.
//
// O mercado é UM SÓ: as mesmas ações e os mesmos preços para todo mundo. Uma vez por dia (o
// primeiro acesso depois da meia-noite abre o PREGÃO), a Lisa olha as empresas e o que aconteceu
// no jogo na véspera, decide quanto cada ação sobe ou cai (até VARIACAO_MAXIMA), escreve a notícia
// de cada uma e lança empresas novas. Sem a IA, um sorteio do dia faz o mesmo (pregaoDeReserva) —
// o mercado nunca trava.
//
// HORA A HORA (23/10/2026, "deixe as ações variarem de hora em hora para ver o movimento nos
// gráficos"): a Lisa decide onde cada ação FECHA o dia; ao longo do dia o preço anda hora a hora
// da abertura até lá, com o sobe-e-desce do mercado no meio (caminhoDoDia: uma ponte aleatória
// com semente fixa — a ação e o dia —, então todo mundo vê o mesmo preço na mesma hora, e nada
// precisa de relógio no servidor). O preço da hora tem centavos — e o dinheiro também (moedas.js):
// o total de uma ordem, a corretagem e o custo da carteira são contados centavo por centavo.
//
// Comprar e vender custa a corretagem (TAXA_DA_CORRETAGEM, no mínimo 1 moeda), então comprar e
// vender no mesmo dia nunca dá lucro: o preço só muda no pregão seguinte. Empresa que chega a
// PRECO_MINIMO vai à FALÊNCIA (as ações dela viram pó). Com mais de MAXIMO_DE_ACOES na bolsa, a
// mais antiga FECHA O CAPITAL: quem tem ações dela recebe o preço do dia por cada uma.
//
// O HORÁRIO DO PREGÃO (23/10/2026: "na bolsa de valores deixe aberta entre as 07:00 e as 17:00"):
// compra e venda só das ABRE_AS às FECHA_AS (horário de Brasília). O preço anda de hora em hora só
// dentro do pregão: às 07:00 ele é a abertura (o fechamento de ontem) e às 17:00 chega ao fechamento
// que a Lisa decidiu. Fora do horário dá para acompanhar, mas não negociar.

import { centavos, faltam } from "./moedas.js";
import { somarDias } from "./datas.js";

export const VARIACAO_MAXIMA = 30;        // % por pregão, para cima ou para baixo
export const PRECO_MINIMO = 2;            // chegou aqui: falência
export const PRECO_INICIAL = [10, 80];    // o preço de lançamento de uma empresa nova
export const TAXA_DA_CORRETAGEM = 0.01;
export const MAXIMO_DE_ACOES = 12;
export const NOVAS_POR_DIA = 2;
export const ACOES_DO_PRIMEIRO_DIA = 6;
export const MAXIMO_POR_ORDEM = 500;      // ações numa compra ou venda
export const ABRE_AS = 7;                  // o pregão abre às 07:00...
export const FECHA_AS = 17;                // ...e fecha às 17:00 (horário de Brasília)
export const PASSOS_DO_DIA = FECHA_AS - ABRE_AS; // um preço novo por hora de pregão
export const VOLATILIDADE_DA_HORA = 0.018; // o tamanho típico do sobe-e-desce de uma hora (1,8%)
export const SETORES = [
  "Mineração", "Armas e defesas", "Transportes", "Alimentos", "Magia", "Tecnologia",
  "Construção", "Turismo", "Tesouros do mar", "Energia vulcânica", "Exploração espacial", "Educação",
];

const inteiro = (x) => Math.round(Number(x) || 0);
const limitar = (x, a, b) => Math.max(a, Math.min(b, x));

/** A corretagem de uma ordem: 1% do valor (em centavos, para cima), no mínimo 1 moeda. */
export const corretagem = (valor) => Math.max(1, Math.ceil(Math.max(0, valor) * TAXA_DA_CORRETAGEM * 100 - 1e-9) / 100);

/** O preço depois do pregão: a variação limitada a ±30%, em moedas inteiras, nunca abaixo do mínimo. */
export function precoDepois(preco, variacao) {
  const v = limitar(inteiro(variacao), -VARIACAO_MAXIMA, VARIACAO_MAXIMA);
  return Math.max(PRECO_MINIMO, Math.round(preco * (1 + v / 100)));
}
export const variacaoReal = (de, para) => (de > 0 ? Math.round(((para - de) / de) * 1000) / 10 : 0);

/** O valor de `quantidade` ações ao preço da hora, centavo por centavo (comprar e vender: a mesma conta). */
export const valorDaCompra = (preco, quantidade) => centavos(preco * quantidade);
export const valorDaVenda = (preco, quantidade) => centavos(preco * quantidade);

/** Comprar `quantidade` ações a `preco`: o total, a corretagem e se dá com o saldo. */
export function podeComprarAcao({ acao, quantidade, saldo }) {
  if (!acao || acao.status !== "ativa") return { ok: false, motivo: "essa ação não está na bolsa" };
  const q = Number(quantidade);
  if (!Number.isInteger(q) || q < 1) return { ok: false, motivo: "escolha quantas ações quer comprar" };
  if (q > MAXIMO_POR_ORDEM) return { ok: false, motivo: `no máximo ${MAXIMO_POR_ORDEM} ações por ordem` };
  const valor = valorDaCompra(acao.preco, q);
  const taxa = corretagem(valor);
  const total = centavos(valor + taxa);
  if ((saldo || 0) < total) return { ok: false, valor, taxa, total, motivo: faltam(total, saldo) };
  return { ok: true, quantidade: q, valor, taxa, total };
}

/** Vender: precisa ter as ações; recebe o preço do dia menos a corretagem. */
export function podeVenderAcao({ acao, posicao, quantidade }) {
  if (!acao || acao.status !== "ativa") return { ok: false, motivo: "essa ação não está mais na bolsa" };
  const q = Number(quantidade);
  const tem = posicao?.quantidade || 0;
  if (!Number.isInteger(q) || q < 1) return { ok: false, motivo: "escolha quantas ações quer vender" };
  if (q > tem) return { ok: false, motivo: tem ? `você tem ${tem} ação(ões) dessa empresa` : "você não tem ações dessa empresa" };
  const valor = valorDaVenda(acao.preco, q);
  const taxa = Math.min(valor, corretagem(valor));
  return { ok: true, quantidade: q, valor, taxa, total: centavos(valor - taxa) };
}

/**
 * A posição depois de uma compra ou venda. `custo` é quanto a pessoa pagou pelas ações que ainda
 * tem (para o preço médio e o lucro); vender tira o custo proporcional.
 */
export function posicaoDepois(posicao, { tipo, quantidade, total }) {
  const q = Number(posicao?.quantidade) || 0, c = Number(posicao?.custo) || 0;
  if (tipo === "compra") return { quantidade: q + quantidade, custo: centavos(c + total) };
  const resta = Math.max(0, q - quantidade);
  return { quantidade: resta, custo: resta ? centavos((c * resta) / q) : 0 };
}

/** A carteira: quanto vale hoje, quanto custou e o lucro (ou prejuízo). */
export function resumoDaCarteira(posicoes, precoDe) {
  let valor = 0, custo = 0;
  for (const p of posicoes || []) {
    if (!(p.quantidade > 0)) continue;
    valor += p.quantidade * (precoDe(p.acao_id) || 0);
    custo += Number(p.custo) || 0;
  }
  return { valor: centavos(valor), custo: centavos(custo), lucro: centavos(valor - custo) };
}

// ------------------------------------------------------------------ o preço hora a hora

/** A semente do caminho de uma ação num dia (o mesmo para todo mundo). */
export function sementeDaAcao(ticker, dia) {
  let h = 0x811c9dc5;
  for (const ch of `${ticker}|${dia}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * O caminho do preço no dia, hora a hora: PASSOS_DO_DIA + 1 pontos, das ABRE_AS (a abertura) às
 * FECHA_AS (o fechamento, que vira a abertura de amanhã). No meio, o sobe-e-desce do mercado: um
 * passeio aleatório "amarrado" nas duas pontas (ponte), sobre a linha que leva da abertura ao
 * fechamento. `volatilidade` muda o tamanho do sobe-e-desce (o traço das previsões dos consultores).
 */
export function caminhoDoDia({ abertura, fechamento, semente, volatilidade = VOLATILIDADE_DA_HORA }) {
  const r = sorteio(semente);
  const n = PASSOS_DO_DIA;
  const a = Math.max(1, abertura || 1), f = Math.max(1, fechamento || 1);
  const passeio = [0];
  // soma de 3 sorteios: quase normal, sem seno nem logaritmo
  for (let i = 1; i <= n; i++) passeio.push(passeio[i - 1] + (r() + r() + r() - 1.5) * 2 * volatilidade);
  const fim = passeio[n];
  return passeio.map((w, i) => {
    const ponte = w - (i / n) * fim;
    const linha = a * Math.pow(f / a, i / n);
    return Math.max(1, Math.round(linha * (1 + ponte) * 100) / 100);
  });
}

/** A vela (candle) de um pedaço do caminho: abertura, máxima, mínima e o preço em `ate`. */
export function velaDe(caminho, ate = caminho.length - 1) {
  const parte = caminho.slice(0, Math.max(1, ate + 1));
  return { abertura: parte[0], maxima: Math.max(...parte), minima: Math.min(...parte), fechamento: parte[parte.length - 1] };
}

/** O pregão está aberto nesta hora (0 a 23, em Brasília)? Das 07:00 às 16:59. */
export const pregaoAberto = (hora) => hora >= ABRE_AS && hora < FECHA_AS;

/** Quantos passos do caminho já andaram na hora `hora`: nenhum antes de abrir, todos depois de fechar. */
export const passosAte = (hora) => limitar(Math.floor(Number(hora) || 0) - ABRE_AS, 0, PASSOS_DO_DIA);

/** O preço do caminho na hora `hora` (antes de abrir, a abertura; depois de fechar, o fechamento). */
export const precoNaHora = (caminho, hora) => caminho[Math.min(caminho.length - 1, passosAte(hora))];

/** A hora do relógio de cada ponto do caminho (o ponto 0 é a abertura, às ABRE_AS). */
export const horaDoPasso = (i) => ABRE_AS + i;

/**
 * Quando o preço (ou o pregão) muda de novo: antes de abrir, na abertura; no pregão, na hora
 * seguinte (às FECHA_AS ele fecha); depois de fechar, na abertura de amanhã. Devolve o instante
 * em ISO, no fuso de Brasília.
 */
export function proximaVirada(dia, hora) {
  const v = hora < ABRE_AS ? { dia, hora: ABRE_AS } : hora < FECHA_AS ? { dia, hora: hora + 1 } : { dia: somarDias(dia, 1), hora: ABRE_AS };
  return `${v.dia}T${String(v.hora).padStart(2, "0")}:00:00-03:00`;
}

// ------------------------------------------------------------------ o pregão

const TICKER = /^[A-Z]{3,5}$/;
const texto = (x, max) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Confere o pregão que a Lisa mandou: uma variação para CADA ação ativa (a que faltar, fica 0%),
 * notícias curtas, e empresas novas com ticker único (3 a 5 letras), setor da lista e preço de
 * lançamento dentro da faixa. Nada da IA vai para o banco sem passar por aqui.
 */
export function validarPregao(resposta, ativas, { novas = NOVAS_POR_DIA, existentes = [] } = {}) {
  const porTicker = new Map((resposta?.movimentos || []).map((m) => [String(m?.ticker || "").toUpperCase(), m]));
  const movimentos = ativas.map((a) => {
    const m = porTicker.get(a.id);
    const variacao = limitar(inteiro(m?.variacao), -VARIACAO_MAXIMA, VARIACAO_MAXIMA);
    return { acao: a.id, variacao, noticia: texto(m?.noticia, 160) || (variacao > 0 ? "Dia de alta." : variacao < 0 ? "Dia de baixa." : "Dia calmo.") };
  });
  // ticker de empresa que já saiu da bolsa também não volta (o histórico dela é dela)
  const usados = new Set([...ativas.map((a) => a.id), ...existentes]);
  const lancadas = [];
  for (const n of resposta?.novas || []) {
    if (lancadas.length >= novas) break;
    const id = String(n?.ticker || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (!TICKER.test(id) || usados.has(id)) continue;
    const nome = texto(n?.nome, 40);
    if (nome.length < 3) continue;
    usados.add(id);
    lancadas.push({
      id, nome,
      setor: SETORES.includes(n?.setor) ? n.setor : SETORES[0],
      emoji: texto(n?.emoji, 8) || "🏢",
      descricao: texto(n?.descricao, 160) || nome,
      preco: limitar(inteiro(n?.preco) || PRECO_INICIAL[0], PRECO_INICIAL[0], PRECO_INICIAL[1]),
    });
  }
  return { manchete: texto(resposta?.manchete, 140) || "O pregão abriu.", movimentos, novas: lancadas };
}

// ---- o pregão de reserva: sem a IA, um sorteio do dia (o mesmo para todos, porque a semente é o dia)
// (o sorteio com semente também serve aos consultores: src/dominio/projecoes.js)

export function sorteio(semente) {
  let a = (semente >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function semente(textoDaSemente) {
  let h = 0x811c9dc5;
  for (const ch of textoDaSemente) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** As empresas que a reserva sabe lançar (a Lisa inventa as dela; estas só quando a IA falha). */
export const EMPRESAS_DE_RESERVA = [
  { ticker: "PEPT", nome: "Pepitas & Cia", setor: "Mineração", emoji: "⛏️", descricao: "Compra o ouro das minas de todos os reinos." },
  { ticker: "BARC", nome: "Barcos Voadores S.A.", setor: "Transportes", emoji: "⛵", descricao: "Fabrica os barcos que levam as tropas às expedições." },
  { ticker: "FORJ", nome: "Forja do Dragão", setor: "Armas e defesas", emoji: "⚔️", descricao: "Espadas, canhões e muralhas para qualquer reino." },
  { ticker: "COGU", nome: "Cogumelos do Bosque", setor: "Alimentos", emoji: "🍄", descricao: "O cogumelo mais gostoso de todas as ilhas." },
  { ticker: "VARI", nome: "Varinhas Mágicas Ltda.", setor: "Magia", emoji: "🪄", descricao: "Feitiços prontos, entregues em casa." },
  { ticker: "ZORG", nome: "Zorg Tecnologia", setor: "Tecnologia", emoji: "👽", descricao: "Engenharia alienígena trazida dos planetoides." },
  { ticker: "PERO", nome: "Pérolas do Recife", setor: "Tesouros do mar", emoji: "🐚", descricao: "Mergulha atrás das pérolas dos reinos submersos." },
  { ticker: "MAGM", nome: "Magma Energia", setor: "Energia vulcânica", emoji: "🌋", descricao: "Transforma lava em energia para as torres." },
  { ticker: "TIJO", nome: "Tijolo Real", setor: "Construção", emoji: "🧱", descricao: "Constrói as torres e os cofres dos reinos." },
  { ticker: "LIVR", nome: "Biblioteca Aberta", setor: "Educação", emoji: "📚", descricao: "Livros e cursos para quem estuda todo dia." },
  { ticker: "ESTR", nome: "Rota das Estrelas", setor: "Exploração espacial", emoji: "🚀", descricao: "Viagens de nave até os planetoides." },
  { ticker: "PICO", nome: "Picos Gelados Turismo", setor: "Turismo", emoji: "🏔️", descricao: "Passeios de dirigível até o topo das montanhas." },
];

/** O pregão sem a IA: cada ação anda um sorteio de até ±12% (o mesmo para todo mundo naquele dia). */
export function pregaoDeReserva(dia, ativas, { novas = NOVAS_POR_DIA, existentes = [] } = {}) {
  const r = sorteio(semente(`bolsa|${dia}`));
  const movimentos = ativas.map((a) => {
    const v = Math.round((r() + r() + r() - 1.5) * 16); // de −24 a +24, quase sempre perto de 0
    return { ticker: a.id, variacao: Math.max(-12, Math.min(12, v)), noticia: v > 3 ? "Investidores animados." : v < -3 ? "Investidores desconfiados." : "Dia sem novidades." };
  });
  const usados = new Set([...ativas.map((a) => a.id), ...existentes]);
  const livres = EMPRESAS_DE_RESERVA.filter((e) => !usados.has(e.ticker));
  const lancadas = [];
  while (lancadas.length < novas && livres.length) {
    const [e] = livres.splice(Math.floor(r() * livres.length), 1);
    lancadas.push({ ...e, preco: PRECO_INICIAL[0] + Math.floor(r() * (PRECO_INICIAL[1] - PRECO_INICIAL[0])) });
  }
  return validarPregao({ manchete: "Pregão automático: a Lisa não conseguiu abrir o pregão hoje.", movimentos, novas: lancadas }, ativas, { novas, existentes });
}

/**
 * Depois de aplicar as variações: quem faliu (chegou ao preço mínimo) e quem fecha o capital (as
 * mais antigas, se a bolsa passar de MAXIMO_DE_ACOES contando as novas).
 */
export function saidasDaBolsa(depois, quantasNovas) {
  const faliram = depois.filter((a) => a.preco <= PRECO_MINIMO).map((a) => a.id);
  const ficam = depois.filter((a) => !faliram.includes(a.id)).sort((a, b) => String(a.criada_em).localeCompare(String(b.criada_em)) || a.id.localeCompare(b.id));
  const sobra = Math.max(0, ficam.length + quantasNovas - MAXIMO_DE_ACOES);
  return { faliram, fecham: ficam.slice(0, sobra).map((a) => a.id) };
}
