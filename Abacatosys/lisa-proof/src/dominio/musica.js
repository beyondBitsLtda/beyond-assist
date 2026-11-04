// RITMO E AFINAÇÃO AO VIVO (pedido de 31/10/2026, o que tinha ficado para depois na proposta dos
// cursos que não são de programação). Dois motores de música que o navegador mede e o servidor corrige,
// sem IA:
//
//   ritmo     — a tela toca um compasso de contagem no metrônomo e a pessoa bate o ritmo no botão (ou
//               na barra de espaço). Vão os instantes de cada toque, em milissegundos; o servidor
//               casa cada batida esperada com o toque mais perto e mede o desvio.
//   afinacao  — a tela toca a nota de referência e a pessoa canta ou toca no microfone. O navegador
//               detecta a altura (detectarAltura, abaixo) e manda a frequência; o servidor mede a
//               distância em cents. Vale qualquer oitava: homem e mulher cantam a mesma nota em
//               alturas diferentes.
//
// Puro: sem banco, sem rede, sem DOM. A detecção de altura também mora aqui, para ser testada com
// um seno sintético no dominio-check.

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

/** Um sorteio repetível (mulberry32): a mesma semente dá o mesmo treino. */
function sorteador(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const assuntoEmTexto = (assunto) => `${assunto?.titulo || ""} ${assunto?.descricao || ""}`;

// ================================================================ notas

const NOMES_DAS_NOTAS = ["Dó", "Dó♯", "Ré", "Ré♯", "Mi", "Fá", "Fá♯", "Sol", "Sol♯", "Lá", "Lá♯", "Si"];

export const frequenciaDaNota = (midi) => 440 * 2 ** ((midi - 69) / 12);
/** "Lá4" (MIDI 69); Dó4 é o Dó central (MIDI 60). */
export const nomeDaNota = (midi, comOitava = true) => {
  const m = Math.round(midi);
  return `${NOMES_DAS_NOTAS[((m % 12) + 12) % 12]}${comOitava ? Math.floor(m / 12) - 1 : ""}`;
};
/** A nota (MIDI, com fração) de uma frequência. */
export const notaDaFrequencia = (f) => 69 + 12 * Math.log2(f / 440);

/**
 * A distância em cents entre o que soou e a nota pedida, em qualquer oitava: dobrada para o
 * intervalo de −600 a +600 (meio tom = 100 cents).
 */
export function centsAteANota(frequencia, midiAlvo) {
  const c = 1200 * Math.log2(frequencia / frequenciaDaNota(midiAlvo));
  return ((((c + 600) % 1200) + 1200) % 1200) - 600;
}

// ================================================================ ritmo

/**
 * Os padrões de um compasso de 4 tempos, em tempos (0 = a cabeça do compasso). Do básico (semínimas
 * e mínimas) ao avançado (semicolcheias, pontuadas e síncopes).
 */
export const PADROES_DE_RITMO = {
  basico: [
    [0, 1, 2, 3], [0, 2], [0, 2, 3], [0, 1, 2], [0, 1, 3], [0, 3], [0, 1],
  ],
  medio: [
    [0, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 0.5, 1, 1.5, 2, 3], [0, 1.5, 2, 3],
    [0, 1, 2, 3, 3.5], [0, 0.5, 2, 2.5],
  ],
  avancado: [
    [0, 0.75, 1, 2, 3], [0, 0.5, 1.5, 2, 3], [0, 1, 1.25, 1.5, 2, 3], [0.5, 1.5, 2, 3], [0, 0.5, 1.5, 2.5, 3],
    [0, 0.25, 0.5, 1, 2, 3], [0, 1.5, 2.5, 3], [0, 0.75, 1.5, 2, 2.75, 3.5],
  ],
};
const ANDAMENTOS = { basico: 72, medio: 84, avancado: 96 };
const ITENS_DO_RITMO = 6;

/** O nível do treino de ritmo pelo assunto: síncope e semicolcheia são avançados; colcheia, médio. */
export function nivelDoRitmo(assunto) {
  const t = assuntoEmTexto(assunto);
  if (assunto?.nivel === "avancado" || /s[ií]ncop|semicolch|pontuad|contratempo|groove|funk|samba|quiáltera|tercina/i.test(t)) return "avancado";
  if (assunto?.nivel === "intermediario" || /colch|levada|batida|dedilhad|subdivis/i.test(t)) return "medio";
  return "basico";
}

/**
 * O treino de ritmo, montado pelo código (sem IA): 6 compassos de 4 tempos no andamento do nível.
 * Os padrões vão para a tela (a pessoa precisa ver e ouvir o que tocar): não há gabarito escondido,
 * o que vale é a precisão do toque.
 */
export function gerarRitmo({ semente, assunto }) {
  const nivel = nivelDoRitmo(assunto);
  const sortear = sorteador(semente);
  // o compasso de antes também entra: o básico vai até o médio no fim, para variar
  const catalogo = nivel === "basico" ? PADROES_DE_RITMO.basico : [...PADROES_DE_RITMO[nivel], ...PADROES_DE_RITMO[nivel === "avancado" ? "medio" : "basico"].slice(0, 3)];
  const itens = [];
  let anterior = -1;
  for (let k = 0; k < ITENS_DO_RITMO; k++) {
    let i = Math.floor(sortear() * catalogo.length);
    if (i === anterior) i = (i + 1) % catalogo.length; // o mesmo padrão duas vezes seguidas, não
    anterior = i;
    itens.push({ batidas: catalogo[i] });
  }
  return {
    motor: "ritmo",
    titulo: { basico: "Ritmo: semínimas e mínimas", medio: "Ritmo: colcheias", avancado: "Ritmo: semicolcheias e síncopes" }[nivel],
    nivel, bpm: ANDAMENTOS[nivel], tempos: 4, itens, semente: semente >>> 0,
  };
}

/** Os toques que a tela mandou ("120,615,1102" ou uma lista), em ms desde a cabeça do compasso. */
export function lerToques(resposta) {
  const partes = Array.isArray(resposta) ? resposta : String(resposta ?? "").split(/[,;\s]+/);
  return partes.filter((p) => String(p ?? "").trim() !== "").map(Number).filter((n) => Number.isFinite(n) && n > -2000 && n < 20_000).slice(0, 40).sort((a, b) => a - b);
}

/** Casa cada batida esperada com o toque livre mais perto, dentro da janela. Devolve os desvios. */
function casarToques(esperados, toques, janela) {
  const usados = new Set();
  const desvios = esperados.map((t) => {
    let melhor = -1;
    toques.forEach((x, j) => {
      if (usados.has(j) || Math.abs(x - t) > janela) return;
      if (melhor < 0 || Math.abs(x - t) < Math.abs(toques[melhor] - t)) melhor = j;
    });
    if (melhor < 0) return null;
    usados.add(melhor);
    return toques[melhor] - t;
  });
  return { desvios, sobras: toques.length - usados.size };
}

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/** Até quanto atraso fixo do aparelho (toque na tela, fone Bluetooth) a correção desconta. */
export const ATRASO_MAXIMO_DESCONTADO = 180;

/** Quanto vale uma batida pelo desvio: até 60 ms é no tempo; até 200 ms ainda conta um pouco. */
export function valorDaBatida(desvio) {
  if (desvio == null) return 0;
  const d = Math.abs(desvio);
  return d <= 60 ? 1 : d <= 110 ? 0.75 : d <= 200 ? 0.4 : 0;
}

/**
 * Corrige o treino de ritmo. Antes de medir, desconta o atraso FIXO do aparelho: a mediana de todos
 * os desvios (até 180 ms) — quem bate sempre 90 ms depois está no tempo, quem tem fone Bluetooth
 * também. Toque a mais custa meia batida.
 */
export function corrigirRitmo(conteudo, respostas) {
  const msPorTempo = 60_000 / conteudo.bpm;
  const janela = Math.min(320, msPorTempo * 0.45);
  const brutos = conteudo.itens.map((it, i) => ({ esperados: it.batidas.map((b) => b * msPorTempo), toques: lerToques(respostas?.[i]) }));
  const todos = brutos.flatMap(({ esperados, toques }) => casarToques(esperados, toques, janela + ATRASO_MAXIMO_DESCONTADO).desvios.filter((d) => d != null));
  const atraso = Math.round(limitar(mediana(todos), -ATRASO_MAXIMO_DESCONTADO, ATRASO_MAXIMO_DESCONTADO));
  const itens = brutos.map(({ esperados, toques }) => {
    if (!toques.length) return { certo: false, nota: 0, motivo: "sem toques", desvios: [] };
    const { desvios, sobras } = casarToques(esperados, toques.map((x) => x - atraso), janela);
    const soma = desvios.reduce((s, d) => s + valorDaBatida(d), 0);
    const nota = Math.max(0, soma - sobras * 0.5) / esperados.length;
    const acertos = desvios.filter((d) => d != null);
    const medio = acertos.length ? Math.round(acertos.reduce((s, d) => s + Math.abs(d), 0) / acertos.length) : null;
    const faltas = desvios.length - acertos.length;
    const partes = [];
    if (medio != null) partes.push(`desvio médio de ${medio} ms`);
    if (faltas) partes.push(`${faltas} batida${faltas > 1 ? "s" : ""} sem toque`);
    if (sobras) partes.push(`${sobras} toque${sobras > 1 ? "s" : ""} a mais`);
    const adiantado = acertos.length >= 2 && mediana(acertos) < -35 ? "correndo" : acertos.length >= 2 && mediana(acertos) > 35 ? "atrasando" : "";
    if (adiantado) partes.push(adiantado);
    return { certo: nota >= 0.8, nota: Math.round(nota * 100) / 100, motivo: partes.join(", "), desvios: desvios.map((d) => (d == null ? null : Math.round(d))) };
  });
  const nota = Math.round((itens.reduce((s, x) => s + x.nota, 0) / itens.length) * 100);
  return { nota, atraso, itens };
}

// ================================================================ afinação

// a altura de referência fica numa região confortável para cantar (de Dó3 a Sol4) e é tocada de novo
// a cada item; a pessoa canta na oitava que for melhor para ela
const GRAVE = 48;
const AGUDO = 67;
const ITENS_DA_AFINACAO = 6;
const INTERVALOS_DA_AFINACAO = [
  { nome: "a mesma nota", semitons: 0 },
  { nome: "uma 3ª maior acima", semitons: 4 },
  { nome: "uma 4ª justa acima", semitons: 5 },
  { nome: "uma 5ª justa acima", semitons: 7 },
  { nome: "uma 3ª menor acima", semitons: 3 },
  { nome: "uma 2ª maior acima", semitons: 2 },
];

/** Solfejo (cantar o intervalo) quando o assunto fala de intervalo, solfejo ou leitura. */
export const afinacaoComIntervalo = (assunto) => assunto?.nivel === "avancado" || /intervalo|solfejo|leitura|percep/i.test(assuntoEmTexto(assunto));

/**
 * O treino de afinação, montado pelo código (sem IA): 6 notas. No básico, ouvir e cantar (ou tocar)
 * a mesma nota; com intervalo, cantar a nota pedida acima da referência.
 */
export function gerarAfinacao({ semente, assunto }) {
  const sortear = sorteador(semente);
  const comIntervalo = afinacaoComIntervalo(assunto);
  const itens = [];
  for (let k = 0; k < ITENS_DA_AFINACAO; k++) {
    const pedido = comIntervalo ? INTERVALOS_DA_AFINACAO[1 + Math.floor(sortear() * (INTERVALOS_DA_AFINACAO.length - 1))] : INTERVALOS_DA_AFINACAO[0];
    const referencia = GRAVE + Math.floor(sortear() * (AGUDO - GRAVE - pedido.semitons + 1));
    const alvo = referencia + pedido.semitons;
    itens.push({ referencia, alvo, pedido: pedido.nome, nome: nomeDaNota(alvo, false) });
  }
  return {
    motor: "afinacao",
    titulo: comIntervalo ? "Afinação: cantar o intervalo" : "Afinação: cantar ou tocar a nota",
    comIntervalo, itens, semente: semente >>> 0,
  };
}

/** Quanto vale a nota pelos cents de distância: até 20 é afinado; até 50 ainda conta um pouco. */
export function valorDaAfinacao(cents) {
  if (cents == null) return 0;
  const c = Math.abs(cents);
  return c <= 20 ? 1 : c <= 35 ? 0.75 : c <= 50 ? 0.5 : 0;
}

export function corrigirAfinacao(conteudo, respostas) {
  const itens = conteudo.itens.map((it, i) => {
    const f = Number(String(respostas?.[i] ?? "").replace(",", "."));
    if (!Number.isFinite(f) || f < 40 || f > 2000) return { certo: false, nota: 0, cents: null, motivo: "sem som detectado" };
    const cents = Math.round(centsAteANota(f, it.alvo));
    const nota = valorDaAfinacao(cents);
    const ouvida = nomeDaNota(notaDaFrequencia(f), false);
    const motivo = Math.abs(cents) > 50
      ? `soou ${ouvida}, e a nota era ${nomeDaNota(it.alvo, false)}`
      : nota === 1 ? "" : `${Math.abs(cents)} cents ${cents > 0 ? "acima" : "abaixo"}`;
    return { certo: nota === 1, nota, cents, motivo };
  });
  const nota = Math.round((itens.reduce((s, x) => s + x.nota, 0) / itens.length) * 100);
  return { nota, itens };
}

// ================================================================ a detecção de altura (o navegador usa)

/**
 * A frequência fundamental de um trecho de áudio (YIN simplificado): a diferença do sinal com ele
 * mesmo deslocado, normalizada; o primeiro vale abaixo do limiar é o período. Devolve Hz, ou null
 * quando é silêncio ou ruído sem altura definida. `amostras`: Float32Array (ou lista) de −1 a 1.
 */
export function detectarAltura(amostras, taxa, { minimo = 70, maximo = 1100, limiar = 0.15 } = {}) {
  const n = amostras.length;
  if (!n || !taxa) return null;
  let media = 0, energia = 0;
  for (let i = 0; i < n; i++) media += amostras[i];
  media /= n;
  for (let i = 0; i < n; i++) energia += (amostras[i] - media) ** 2;
  if (Math.sqrt(energia / n) < 0.01) return null; // silêncio

  const menorAtraso = Math.max(2, Math.floor(taxa / maximo));
  const maiorAtraso = Math.min(Math.floor(taxa / minimo), Math.floor(n / 2));
  if (maiorAtraso <= menorAtraso + 2) return null;
  const janela = n - maiorAtraso;
  const d = new Float64Array(maiorAtraso + 2);
  for (let tau = 1; tau <= maiorAtraso + 1; tau++) {
    let s = 0;
    for (let j = 0; j < janela; j++) {
      const x = amostras[j] - amostras[j + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  // a diferença normalizada pela média acumulada (o "d'" do YIN)
  const norm = new Float64Array(maiorAtraso + 2);
  norm[0] = 1;
  let acumulado = 0;
  for (let tau = 1; tau <= maiorAtraso + 1; tau++) {
    acumulado += d[tau];
    norm[tau] = acumulado > 0 ? (d[tau] * tau) / acumulado : 1;
  }
  let tau = -1;
  for (let t = menorAtraso; t <= maiorAtraso; t++) {
    if (norm[t] < limiar) {
      while (t + 1 <= maiorAtraso && norm[t + 1] < norm[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null; // nenhum período claro: ruído, consoante, respiração
  // interpolação parabólica em volta do vale, para não ficar preso ao inteiro
  const a = norm[tau - 1], b = norm[tau], c = norm[tau + 1];
  const den = a - 2 * b + c;
  const fino = den !== 0 ? tau + (a - c) / (2 * den) : tau;
  const f = taxa / fino;
  return f >= minimo && f <= maximo ? f : null;
}

/**
 * A altura de uma nota sustentada a partir das leituras de vários quadros: descarta o começo (o
 * ataque) e fica com a mediana. Menos de 4 leituras não dá certeza: null.
 */
export function alturaSustentada(leituras) {
  const boas = (leituras || []).filter((f) => Number.isFinite(f) && f > 0);
  if (boas.length < 4) return null;
  const resto = boas.slice(Math.floor(boas.length / 4));
  return Math.round(mediana(resto) * 10) / 10;
}

// ================================================================ leitura na pauta (31/10/2026)
//
// A nota aparece na pauta (clave de sol ou de fá) e a pessoa escolhe o nome. Só notas naturais. O
// "grau" é a posição na pauta: 7 por oitava, Dó4 = 28; a linha de baixo da clave de sol é o Mi4 (30)
// e a da clave de fá, o Sol2 (18). Montado pelo código e corrigido no servidor, como o ouvido.

export const NOMES_NATURAIS = ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"];
const SEMITONS_NATURAIS = [0, 2, 4, 5, 7, 9, 11];
export const LINHA_DE_BAIXO = { sol: 30, fa: 18 };
const FAIXAS_DA_PAUTA = {
  sol: { basico: [30, 38], completo: [26, 42] }, // Mi4–Fá5; Lá3–Dó6 com linhas suplementares
  fa: { basico: [18, 26], completo: [14, 30] },  // Sol2–Lá3; Dó2–Mi4
};
const ITENS_DA_LEITURA = 8;

export const midiDoGrau = (grau) => (Math.floor(grau / 7) + 1) * 12 + SEMITONS_NATURAIS[((grau % 7) + 7) % 7];
export const nomeDoGrau = (grau, comOitava = false) => `${NOMES_NATURAIS[((grau % 7) + 7) % 7]}${comOitava ? Math.floor(grau / 7) : ""}`;

/** A clave e o alcance pelo assunto: clave de fá (baixo, grave); linhas suplementares no avançado. */
export function pautaDoAssunto(assunto) {
  const t = assuntoEmTexto(assunto);
  return {
    clave: /clave de f[aá]|baixo|contrabaixo|violoncelo|tuba|trombone|m[aã]o esquerda/i.test(t) ? "fa" : "sol",
    completo: assunto?.nivel === "avancado" || /suplementar|extens|todas as claves/i.test(t),
  };
}

export function gerarLeitura({ semente, assunto }) {
  const { clave, completo } = pautaDoAssunto(assunto);
  const sortear = sorteador(semente);
  const [de, ate] = FAIXAS_DA_PAUTA[clave][completo ? "completo" : "basico"];
  const itens = [];
  let anterior = null;
  for (let k = 0; k < ITENS_DA_LEITURA; k++) {
    let grau = de + Math.floor(sortear() * (ate - de + 1));
    if (grau === anterior) grau = grau === ate ? de : grau + 1;
    anterior = grau;
    itens.push({ grau, midi: midiDoGrau(grau), correta: ((grau % 7) + 7) % 7 });
  }
  return {
    motor: "leitura",
    titulo: `Leitura na pauta: clave de ${clave === "fa" ? "fá" : "sol"}`,
    clave, completo, opcoes: NOMES_NATURAIS, itens, semente: semente >>> 0,
  };
}

export function corrigirLeitura(conteudo, respostas) {
  const itens = conteudo.itens.map((it, i) => {
    const r = Number(respostas?.[i]);
    const certo = Number.isInteger(r) && r === it.correta;
    const marcou = Number.isInteger(r) && conteudo.opcoes[r];
    return { certo, motivo: certo ? "" : `era ${nomeDoGrau(it.grau, true)}${marcou ? ` (você marcou ${marcou})` : " (sem resposta)"}` };
  });
  return { nota: Math.round((itens.filter((x) => x.certo).length / itens.length) * 100), itens };
}
