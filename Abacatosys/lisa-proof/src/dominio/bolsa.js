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
// Comprar e vender custa a corretagem (TAXA_DA_CORRETAGEM, no mínimo 1 moeda), então comprar e
// vender no mesmo dia nunca dá lucro: o preço só muda no pregão seguinte. Empresa que chega a
// PRECO_MINIMO vai à FALÊNCIA (as ações dela viram pó). Com mais de MAXIMO_DE_ACOES na bolsa, a
// mais antiga FECHA O CAPITAL: quem tem ações dela recebe o preço do dia por cada uma.

export const VARIACAO_MAXIMA = 30;        // % por pregão, para cima ou para baixo
export const PRECO_MINIMO = 2;            // chegou aqui: falência
export const PRECO_INICIAL = [10, 80];    // o preço de lançamento de uma empresa nova
export const TAXA_DA_CORRETAGEM = 0.01;
export const MAXIMO_DE_ACOES = 12;
export const NOVAS_POR_DIA = 2;
export const ACOES_DO_PRIMEIRO_DIA = 6;
export const MAXIMO_POR_ORDEM = 500;      // ações numa compra ou venda
export const SETORES = [
  "Mineração", "Armas e defesas", "Transportes", "Alimentos", "Magia", "Tecnologia",
  "Construção", "Turismo", "Tesouros do mar", "Energia vulcânica", "Exploração espacial", "Educação",
];

const inteiro = (x) => Math.round(Number(x) || 0);
const limitar = (x, a, b) => Math.max(a, Math.min(b, x));

/** A corretagem de uma ordem: 1% do valor, no mínimo 1 moeda. */
export const corretagem = (valor) => Math.max(1, Math.ceil(Math.max(0, valor) * TAXA_DA_CORRETAGEM));

/** O preço depois do pregão: a variação limitada a ±30%, em moedas inteiras, nunca abaixo do mínimo. */
export function precoDepois(preco, variacao) {
  const v = limitar(inteiro(variacao), -VARIACAO_MAXIMA, VARIACAO_MAXIMA);
  return Math.max(PRECO_MINIMO, Math.round(preco * (1 + v / 100)));
}
export const variacaoReal = (de, para) => (de > 0 ? Math.round(((para - de) / de) * 1000) / 10 : 0);

/** Comprar `quantidade` ações a `preco`: o total, a corretagem e se dá com o saldo. */
export function podeComprarAcao({ acao, quantidade, saldo }) {
  if (!acao || acao.status !== "ativa") return { ok: false, motivo: "essa ação não está na bolsa" };
  const q = Number(quantidade);
  if (!Number.isInteger(q) || q < 1) return { ok: false, motivo: "escolha quantas ações quer comprar" };
  if (q > MAXIMO_POR_ORDEM) return { ok: false, motivo: `no máximo ${MAXIMO_POR_ORDEM} ações por ordem` };
  const valor = acao.preco * q;
  const taxa = corretagem(valor);
  const total = valor + taxa;
  if ((saldo || 0) < total) return { ok: false, valor, taxa, total, motivo: `faltam ${total - (saldo || 0)} moeda(s)` };
  return { ok: true, quantidade: q, valor, taxa, total };
}

/** Vender: precisa ter as ações; recebe o preço do dia menos a corretagem. */
export function podeVenderAcao({ acao, posicao, quantidade }) {
  if (!acao || acao.status !== "ativa") return { ok: false, motivo: "essa ação não está mais na bolsa" };
  const q = Number(quantidade);
  const tem = posicao?.quantidade || 0;
  if (!Number.isInteger(q) || q < 1) return { ok: false, motivo: "escolha quantas ações quer vender" };
  if (q > tem) return { ok: false, motivo: tem ? `você tem ${tem} ação(ões) dessa empresa` : "você não tem ações dessa empresa" };
  const valor = acao.preco * q;
  const taxa = Math.min(valor, corretagem(valor));
  return { ok: true, quantidade: q, valor, taxa, total: valor - taxa };
}

/**
 * A posição depois de uma compra ou venda. `custo` é quanto a pessoa pagou pelas ações que ainda
 * tem (para o preço médio e o lucro); vender tira o custo proporcional.
 */
export function posicaoDepois(posicao, { tipo, quantidade, total }) {
  const q = posicao?.quantidade || 0, c = posicao?.custo || 0;
  if (tipo === "compra") return { quantidade: q + quantidade, custo: c + total };
  const resta = Math.max(0, q - quantidade);
  return { quantidade: resta, custo: resta ? Math.round((c * resta) / q) : 0 };
}

/** A carteira: quanto vale hoje, quanto custou e o lucro (ou prejuízo). */
export function resumoDaCarteira(posicoes, precoDe) {
  let valor = 0, custo = 0;
  for (const p of posicoes || []) {
    if (!(p.quantidade > 0)) continue;
    valor += p.quantidade * (precoDe(p.acao_id) || 0);
    custo += p.custo || 0;
  }
  return { valor, custo, lucro: valor - custo };
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

function sorteio(semente) {
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
