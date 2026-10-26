// O Modo Domínio (pedido de 24/10/2026): a pessoa traz um repositório público (GitHub ou GitLab),
// a Lisa lê o código, diz se ele aguenta um desafio e monta uma TORRE de 10 a 100 andares — do
// básico ao difícil — para dominar aquele repositório e as tecnologias dele. Cada andar tem um
// chefão; a entrega é um commit na branch do desafio, a Lisa avalia, o Neuro ganha atributos e
// luta com o chefão: nota 60+ vence e sobe, abaixo disso tenta de novo. No topo, o certificado.
//
// Puro (sem banco, sem rede, sem IA): os níveis de complexidade, o elenco de chefões, os pontos,
// os atributos do Neuro, o roteiro da luta, os prêmios de cada marco e a conferência do que a IA
// devolve. Testado por `npm run dominio-check`.

import { TROPAS, capacidadeDoExercito, capacidadeDaGuarnicao, lotacaoDoAcampamento, espacoUsado } from "./tropas.js";
import { ORDEM_DOS_VEICULOS, veiculosDe } from "./veiculos.js";
import { MULTIPLICADOR_DE_RECOMPENSAS } from "./pontos.js";

// ---------------------------------------------------------------- os níveis de complexidade

/**
 * O nível do repositório (a Lisa decide lendo o código) manda em duas coisas: até quantos andares
 * a torre pode ter (um repositório pequeno não sustenta 100 desafios) e o que dá para ganhar —
 * quanto mais complexo, mais o prêmio vale (pedido: "balanceado pelo nível do repositório").
 */
export const NIVEIS = {
  1: { nome: "Iniciante", maxAndares: 15, fator: 1.0, recompensas: ["moedas"] },
  2: { nome: "Básico", maxAndares: 30, fator: 1.15, recompensas: ["moedas", "tropas"] },
  3: { nome: "Intermediário", maxAndares: 50, fator: 1.3, recompensas: ["moedas", "tropas", "defesas"] },
  4: { nome: "Avançado", maxAndares: 75, fator: 1.5, recompensas: ["moedas", "tropas", "defesas", "veiculo"] },
  5: { nome: "Mestre", maxAndares: 100, fator: 1.75, recompensas: ["moedas", "tropas", "defesas", "veiculo", "avatar"] },
};
export const MIN_ANDARES = 10;
export const MAX_ANDARES = 100;
export const NOTA_PARA_VENCER = 60;

export const nivelValido = (n) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));

/** Quantos andares a pessoa pode escolher para um repositório desse nível. */
export function andaresPermitidos(nivel) {
  return { min: MIN_ANDARES, max: NIVEIS[nivelValido(nivel)].maxAndares };
}

/** O número de andares pedido, dentro do permitido (ou null, se não é número). */
export function andaresEscolhidos(pedido, nivel) {
  const n = Math.round(Number(pedido));
  if (!Number.isFinite(n)) return null;
  const { min, max } = andaresPermitidos(nivel);
  return Math.min(max, Math.max(min, n));
}

/** A dificuldade esperada (1 a 5) do andar `i` de `n`: sobe do básico ao difícil. */
export function dificuldadeEsperada(i, n) {
  const p = n > 1 ? (i - 1) / (n - 1) : 1;
  return Math.min(5, 1 + Math.floor(p * 5));
}

// ---------------------------------------------------------------- o elenco de chefões

/**
 * Os chefões, do mais fraco ao mais forte. O desenho é um dos monstros de papel do Reino
 * (src/componentes/reino/monstrosDePapel.js). A Lisa dá a cada um um epíteto com o tema do
 * andar ("Golem do Callback"). O chefão FINAL de uma torre de nível Mestre vira avatar: o
 * personagem `chefao-<id>` no Reino.
 */
export const CHEFOES = [
  { id: "golem", nome: "Golem", emoji: "🗿", descricao: "Pedra sobre pedra, como o código legado." },
  { id: "ent", nome: "Ent", emoji: "🌳", descricao: "Raízes por toda parte, como dependências." },
  { id: "ogro", nome: "Ogro", emoji: "👹", descricao: "Grande e pesado, como um monólito." },
  { id: "ciborgue", nome: "Ciborgue", emoji: "🤖", descricao: "Metade gente, metade automação." },
  { id: "cerbero", nome: "Cérbero", emoji: "🐺", descricao: "Três cabeças: desenvolvimento, homologação e produção." },
  { id: "golemDeMagma", nome: "Golem de Magma", emoji: "🌋", descricao: "Ferve a cada deploy de sexta-feira." },
  { id: "kraken", nome: "Kraken", emoji: "🐙", descricao: "Tentáculos em tudo, como o acoplamento." },
  { id: "giganteDeGelo", nome: "Gigante de Gelo", emoji: "🧊", descricao: "Congela tudo o que ninguém ousa mexer." },
  { id: "rainhaAlien", nome: "Rainha Alienígena", emoji: "👾", descricao: "Comanda um enxame de requisitos novos." },
  { id: "dragaoDeLava", nome: "Dragão de Lava", emoji: "🐉", descricao: "O guardião do topo: o sistema em produção." },
];
/** Os que podem guardar o topo (e virar avatar): os quatro mais fortes. */
export const CHEFOES_FINAIS = CHEFOES.slice(6);
export const chefaoPorId = (id) => CHEFOES.find((c) => c.id === id) || null;
export const personagemDoChefao = (id) => `chefao-${id}`;
export const chefaoDoPersonagem = (personagem) => {
  const m = /^chefao-(.+)$/.exec(String(personagem || ""));
  return m && chefaoPorId(m[1]) ? m[1] : null;
};

/** Uma semente estável de um texto (FNV-1a), para a mesma torre sempre sortear igual. */
export function sementeDe(texto) {
  let h = 0x811c9dc5;
  for (const ch of String(texto)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h || 1;
}
function sorteio(semente) {
  let a = semente >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Os chefões de uma torre de `n` andares: ficam mais fortes conforme sobe, com um pouco de
 * variação; o do topo é um dos quatro mais fortes, sorteado pela semente — cada repositório tem o
 * SEU chefão final (e o seu avatar).
 */
export function chefoesDaTorre(n, semente) {
  const r = sorteio(semente);
  const final = 6 + Math.floor(r() * 4);
  const lista = [];
  for (let i = 1; i <= n; i++) {
    if (i === n) { lista.push(CHEFOES[final].id); break; }
    const p = n > 1 ? (i - 1) / (n - 1) : 0;
    let k = Math.round(p * 8) + Math.floor(r() * 3) - 1;
    k = Math.min(9, Math.max(0, k));
    if (k === final) k = Math.max(0, k - 1);
    lista.push(CHEFOES[k].id);
  }
  return lista;
}

/** O nome do chefão de um andar: a criatura e o epíteto que a Lisa deu ("Golem do Callback"). */
export function nomeDoChefao(id, epiteto) {
  const base = chefaoPorId(id)?.nome || "Chefão";
  const e = String(epiteto || "").trim();
  return e ? `${base} ${e}`.slice(0, 80) : base;
}

// ---------------------------------------------------------------- pontos, atributos e a luta

// As recompensas dos andares valem o triplo desde 26/10/2026 (MULTIPLICADOR_DE_RECOMPENSAS, em
// pontos.js): os pontos de cada andar, o bônus dos marcos, o do topo e as moedas no lugar de prêmio.

/** Os pontos de um andar (viram moedas, ranking e ofensiva): dificuldade × nível × nota. */
export function pontosDoAndar(nota, dificuldade, nivel) {
  const base = (15 + 10 * Math.min(5, Math.max(1, dificuldade || 1))) * MULTIPLICADOR_DE_RECOMPENSAS;
  return Math.round(base * NIVEIS[nivelValido(nivel)].fator * Math.max(0, Math.min(100, nota || 0)) / 100);
}

/** O bônus de chegar ao topo. */
export const pontosDoTopo = (nivel, n) => Math.round(40 * MULTIPLICADOR_DE_RECOMPENSAS * nivelValido(nivel) * Math.sqrt(Math.max(MIN_ANDARES, n) / 10));

/** As habilidades que a Lisa mede em cada entrega — e que o Neuro ganha. */
export const ATRIBUTOS = [
  { id: "logica", nome: "Lógica", emoji: "🧠" },
  { id: "arquitetura", nome: "Arquitetura", emoji: "🏛️" },
  { id: "testes", nome: "Testes", emoji: "🧪" },
  { id: "qualidade", nome: "Qualidade", emoji: "✨" },
  { id: "dominio", nome: "Domínio da stack", emoji: "⚙️" },
];

/**
 * Os atributos do Neuro: a média de cada habilidade nas melhores entregas dos andares vencidos,
 * pesada pela dificuldade (um andar difícil pesa mais). O nível sobe com a soma das dificuldades.
 * `avaliacoes`: [{ atributos: { logica: 0–100, … }, dificuldade }].
 */
export function atributosDoNeuro(avaliacoes) {
  const valores = {};
  let experiencia = 0;
  for (const a of ATRIBUTOS) {
    let soma = 0, pesos = 0;
    for (const av of avaliacoes || []) {
      const v = Number(av?.atributos?.[a.id]);
      if (!Number.isFinite(v)) continue;
      const peso = Math.min(5, Math.max(1, av.dificuldade || 1));
      soma += Math.min(100, Math.max(0, v)) * peso;
      pesos += peso;
    }
    valores[a.id] = pesos ? Math.round(soma / pesos) : 0;
  }
  for (const av of avaliacoes || []) experiencia += Math.min(5, Math.max(1, av?.dificuldade || 1));
  return { valores, experiencia, nivel: 1 + Math.floor(experiencia / 15), andares: (avaliacoes || []).length };
}

/**
 * O roteiro da luta entre o Neuro e o chefão do andar — o que a tela anima. Quem decide é a nota
 * (60+ vence, sem sorte nenhuma); os atributos dão o golpe especial e a semente varia os golpes.
 * Vencendo, quanto maior a nota, mais rápido o chefão cai. Devolve { venceu, golpes: [{ quem,
 * dano, especial, vidaNeuro, vidaChefao }] } — as vidas são de 0 a 100, depois de cada golpe.
 */
export function roteiroDaLuta({ nota, atributos = {}, dificuldade = 1, semente = 1 }) {
  const r = sorteio(semente);
  const n = Math.max(0, Math.min(100, Math.round(nota || 0)));
  const venceu = n >= NOTA_PARA_VENCER;
  const melhor = ATRIBUTOS.reduce((m, a) => ((atributos[a.id] || 0) > (atributos[m.id] || 0) ? a : m), ATRIBUTOS[0]);
  // quantas trocas de golpe: 3 numa nota perfeita, até 6 raspando; perdendo, 4 ou 5
  const rodadas = venceu ? Math.min(6, Math.max(3, Math.round(7 - (n - 60) / 10))) : 4 + Math.floor(r() * 2);
  // quanto cada um tira no total
  const danoDoNeuro = venceu ? 100 : Math.max(10, Math.min(90, Math.round(n * 0.9)));
  const danoDoChefao = venceu ? Math.max(10, Math.min(85, Math.round(100 - n + 5 * dificuldade))) : 100;
  const partes = (total, k) => {
    const pesos = Array.from({ length: k }, () => 0.6 + r());
    const soma = pesos.reduce((s, p) => s + p, 0);
    const lista = pesos.map((p) => Math.max(1, Math.round((p / soma) * total)));
    lista[k - 1] += total - lista.reduce((s, v) => s + v, 0); // fecha a conta certinho
    return lista;
  };
  const doNeuro = partes(danoDoNeuro, rodadas);
  const doChefao = partes(danoDoChefao, rodadas);
  const golpes = [];
  let vidaNeuro = 100, vidaChefao = 100;
  for (let k = 0; k < rodadas; k++) {
    vidaChefao = Math.max(0, vidaChefao - doNeuro[k]);
    golpes.push({ quem: "neuro", dano: doNeuro[k], especial: k === rodadas - 1 || doNeuro[k] > 30 ? melhor.id : null, vidaNeuro, vidaChefao });
    if (venceu && vidaChefao === 0) break;
    vidaNeuro = Math.max(0, vidaNeuro - doChefao[k]);
    golpes.push({ quem: "chefao", dano: doChefao[k], especial: null, vidaNeuro, vidaChefao });
    if (!venceu && vidaNeuro === 0) break;
  }
  return { venceu, golpes, vidaNeuro, vidaChefao };
}

// ---------------------------------------------------------------- os prêmios

/** Os andares que dão prêmio: a um quarto, à metade, a três quartos e no topo. */
export function marcosDaTorre(n) {
  return [...new Set([0.25, 0.5, 0.75, 1].map((f) => Math.max(1, Math.round(n * f))))];
}

// as tropas de cada nível (para o exército) e as de defesa (para a guarnição)
const TROPAS_DO_NIVEL = { 2: { guerreiro: 8 }, 3: { arqueira: 6 }, 4: { gigante: 2 }, 5: { mago: 2 } };
const DEFESAS_DO_NIVEL = { 3: { arqueira: 4 }, 4: { gigante: 1 }, 5: { mago: 1 } };

/** O valor em moedas de um pacote de tropas (o que vira moeda se não couber no Reino). */
export const valorDasTropas = (pacote) => Object.entries(pacote || {}).reduce((s, [t, q]) => s + (TROPAS[t]?.custo || 0) * q, 0);

/**
 * O prêmio do marco `k` (0 = um quarto, 1 = metade, 2 = três quartos, 3 = topo) numa torre de
 * nível `nivel`. Todo marco dá um bônus de pontos; os outros prêmios dependem do nível.
 * Devolve uma lista: [{ tipo: "pontos"|"tropas"|"defesas"|"veiculo"|"avatar"|"certificado", … }].
 */
export function premiosDoMarco(k, nivel, chefaoFinal = null) {
  const nv = nivelValido(nivel);
  const pode = (r) => NIVEIS[nv].recompensas.includes(r);
  const premios = [{ tipo: "pontos", pontos: 10 * MULTIPLICADOR_DE_RECOMPENSAS * nv * (k + 1) }];
  if ((k === 0 || k === 2) && pode("tropas")) premios.push({ tipo: "tropas", tropas: TROPAS_DO_NIVEL[nv] });
  if (k === 1) {
    if (pode("defesas")) premios.push({ tipo: "defesas", tropas: DEFESAS_DO_NIVEL[nv] });
    else if (pode("tropas")) premios.push({ tipo: "tropas", tropas: TROPAS_DO_NIVEL[nv] });
  }
  if (k === 3) {
    if (pode("veiculo")) premios.push({ tipo: "veiculo" });
    if (pode("avatar") && chefaoFinal) premios.push({ tipo: "avatar", personagem: personagemDoChefao(chefaoFinal) });
    premios.push({ tipo: "certificado" });
  }
  return premios;
}

/** O que a torre promete, para a tela mostrar antes de começar. */
export function premiosDaTorre(n, nivel, chefaoFinal) {
  return marcosDaTorre(n).map((andar, k, todos) => ({
    andar,
    premios: premiosDoMarco(todos.length === 4 ? k : Math.round((k / Math.max(1, todos.length - 1)) * 3), nivel, chefaoFinal),
  }));
}

/** Os prêmios de vencer o andar `numero` (nada, se ele não é um marco). */
export function premiosDoAndar(numero, n, nivel, chefaoFinal) {
  return premiosDaTorre(n, nivel, chefaoFinal).find((m) => m.andar === numero)?.premios || [];
}

/** O que vira moedas quando o prêmio não tem onde entrar (já tem todos os veículos, já tem o avatar). */
export const MOEDAS_NO_LUGAR = { veiculo: 800 * MULTIPLICADOR_DE_RECOMPENSAS, avatar: 1500 * MULTIPLICADOR_DE_RECOMPENSAS };

/** O veículo do prêmio: o próximo da garagem que a pessoa ainda não tem (null se tem todos). */
export const veiculoDoPremio = (possui) => ORDEM_DOS_VEICULOS.find((v) => !veiculosDe(possui).includes(v)) || null;

/**
 * Quantas tropas de um prêmio cabem no Reino agora — as mesmas regras do treino: o exército
 * precisa do Quartel (e do nível dele para cada tropa), a guarnição da Torre do Neuro e só aceita
 * quem defende; as duas reservas dividem a lotação do Acampamento. O que não cabe vira moedas
 * (o valor de treino). Devolve { cabem: { tropa: n }, sobram: { tropa: n } }.
 */
export function encaixarTropas({ pacote, destino, niveis, exercito, guarnicao }) {
  const nivel = (destino === "exercito" ? niveis?.quartel : niveis?.castelo) || 0;
  const capacidade = destino === "exercito" ? capacidadeDoExercito(nivel) : capacidadeDaGuarnicao(nivel);
  let naReserva = capacidade - espacoUsado(destino === "exercito" ? exercito : guarnicao);
  let naIlha = lotacaoDoAcampamento(niveis?.acampamento) - espacoUsado(exercito) - espacoUsado(guarnicao);
  const cabem = {}, sobram = {};
  for (const [t, q] of Object.entries(pacote || {})) {
    const def = TROPAS[t];
    const quantidade = Math.floor(Number(q) || 0);
    if (!def || quantidade <= 0) continue;
    const liberada = nivel >= def.nivelMinimo && (destino === "exercito" ? nivel > 0 : Boolean(def.defende));
    const k = liberada ? Math.max(0, Math.min(quantidade, Math.floor(Math.min(naReserva, naIlha) / def.espaco))) : 0;
    if (k) { cabem[t] = k; naReserva -= k * def.espaco; naIlha -= k * def.espaco; }
    if (quantidade - k) sobram[t] = quantidade - k;
  }
  return { cabem, sobram };
}

// ---------------------------------------------------------------- montar a torre em blocos

/** Até quantos andares a IA monta de uma vez: a torre de 100 sai em 4 pedidos, em paralelo. */
export const ANDARES_POR_BLOCO = 25;

/** Os trechos da torre: [{ inicio, fim }], em blocos do mesmo tamanho (o último pode ser menor). */
export function blocosDaTorre(n, tamanho = ANDARES_POR_BLOCO) {
  const blocos = [];
  for (let inicio = 1; inicio <= n; inicio += tamanho) blocos.push({ inicio, fim: Math.min(n, inicio + tamanho - 1) });
  return blocos;
}

/**
 * Os assuntos de um trecho: a análise lista do básico ao avançado, então cada bloco fica com a
 * fatia proporcional (com um assunto de folga de cada lado, para emendar com os vizinhos).
 */
export function assuntosDoBloco(assuntos, { inicio, fim }, n) {
  const lista = Array.isArray(assuntos) ? assuntos : [];
  if (lista.length <= 3 || n <= ANDARES_POR_BLOCO) return lista;
  const de = Math.max(0, Math.floor(((inicio - 1) / n) * lista.length) - 1);
  const ate = Math.min(lista.length, Math.ceil((fim / n) * lista.length) + 1);
  return lista.slice(de, ate);
}

/** A média das melhores notas dos andares vencidos (o certificado mostra). */
export function mediaDasNotas(andares) {
  const notas = (andares || []).filter((a) => a?.vencido).map((a) => Number(a.melhorNota) || 0);
  return notas.length ? Math.round(notas.reduce((s, v) => s + v, 0) / notas.length) : 0;
}

// ---------------------------------------------------------------- a branch e o certificado

/** A branch que a Lisa sugere para o desafio: dominio/<nome-do-repositório>. */
export function branchSugerida(repo) {
  const nome = String(repo || "desafio").split("/").pop()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `dominio/${nome || "desafio"}`;
}

/** Um nome de branch aceitável (o que o Git aceita, sem truques). */
export function branchValida(nome) {
  const b = String(nome || "").trim();
  return b.length > 0 && b.length <= 120 && /^[A-Za-z0-9._/-]+$/.test(b) && !b.includes("..") && !b.startsWith("/") && !b.endsWith("/") && !b.endsWith(".lock");
}

// o código do certificado: 12 letras e números sem os que se confundem (0/O, 1/I/L)
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** Um código de certificado a partir de bytes aleatórios (quem chama usa crypto). */
export function codigoDoCertificado(bytes) {
  const b = Array.from(bytes || []).slice(0, 12);
  if (b.length < 12) throw new Error("faltam bytes para o código");
  const s = b.map((x) => ALFABETO[x % ALFABETO.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
export const codigoValido = (c) => new RegExp(`^[${ALFABETO}]{4}-[${ALFABETO}]{4}-[${ALFABETO}]{4}$`).test(String(c || ""));

// ---------------------------------------------------------------- conferir o que a IA devolve

const texto = (v, max) => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };
const lista = (v, max, cada) => (Array.isArray(v) ? v : []).map((x) => texto(x, cada)).filter(Boolean).slice(0, max);
const nota100 = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** A análise do repositório: dá desafio? qual o nível? quais tecnologias e assuntos? */
export function validarAnalise(bruto) {
  const complexidade = nivelValido(bruto?.complexidade);
  const apto = Boolean(bruto?.apto) && Number(bruto?.complexidade) >= 1;
  return {
    apto,
    motivo: texto(bruto?.motivo, 400),
    complexidade,
    resumo: texto(bruto?.resumo, 700),
    tecnologias: lista(bruto?.tecnologias, 12, 40),
    assuntos: lista(bruto?.assuntos, 20, 70),
    andaresSugeridos: andaresEscolhidos(bruto?.andaresSugeridos ?? NIVEIS[complexidade].maxAndares, complexidade),
  };
}

/**
 * O roteiro de um trecho da torre: `n` andares a partir do andar `inicio` de uma torre de
 * `total` (a torre grande é montada em blocos). Menos andares que o pedido é erro.
 */
export function validarTorre(bruto, n, { inicio = 1, total = n } = {}) {
  const andares = (Array.isArray(bruto?.andares) ? bruto.andares : []).slice(0, n);
  if (andares.length < n) throw new Error(`a IA montou só ${andares.length} de ${n} andares — tente de novo`);
  return andares.map((a, i) => {
    const numero = inicio + i;
    const esperada = dificuldadeEsperada(numero, total);
    const d = Math.round(Number(a?.dificuldade) || esperada);
    return {
      numero,
      titulo: texto(a?.titulo, 90) || `Andar ${numero}`,
      objetivo: texto(a?.objetivo, 260),
      assunto: texto(a?.assunto, 70),
      // a dificuldade da IA vale, mas sem fugir da subida (no máximo um degrau para cada lado)
      dificuldade: Math.min(5, Math.max(1, Math.min(esperada + 1, Math.max(esperada - 1, d)))),
      epiteto: texto(a?.epiteto, 40),
    };
  });
}

/**
 * A torre inteira, já juntada dos blocos: a dificuldade nunca desce de um andar para o outro (cada
 * bloco é montado sozinho e podia recomeçar um degrau abaixo do anterior).
 */
export function dificuldadeSempreSobe(andares) {
  let antes = 1;
  return (andares || []).map((a) => {
    const d = Math.max(antes, a.dificuldade || 1);
    antes = d;
    return d === a.dificuldade ? a : { ...a, dificuldade: d };
  });
}

/** O desafio detalhado de um andar (gerado quando a pessoa chega nele). */
export function validarDesafio(bruto) {
  const requisitos = lista(bruto?.requisitos, 8, 280);
  if (requisitos.length < 2) throw new Error("a IA não devolveu requisitos suficientes — tente de novo");
  return {
    enunciado: texto(bruto?.enunciado, 1600),
    requisitos,
    criterios: lista(bruto?.criterios, 6, 240),
    dica: texto(bruto?.dica, 400),
    arquivos: lista(bruto?.arquivos, 8, 160),
  };
}

/** A avaliação de uma entrega: a nota, cada atributo, o que está bom e o que melhorar. */
export function validarAvaliacaoDoAndar(bruto) {
  const nota = nota100(bruto?.nota);
  const atributos = {};
  for (const a of ATRIBUTOS) {
    const v = Number(bruto?.atributos?.[a.id]);
    atributos[a.id] = Number.isFinite(v) ? nota100(v) : nota; // sem a medida, vale a nota geral
  }
  return {
    nota,
    venceu: nota >= NOTA_PARA_VENCER,
    atributos,
    comentario: texto(bruto?.comentario, 1000),
    pontosFortes: lista(bruto?.pontosFortes, 4, 240),
    melhorar: lista(bruto?.melhorar, 4, 240),
  };
}
