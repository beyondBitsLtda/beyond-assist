// OS MOTORES DO EXERCÍCIO DO DIA (pedido de 30/10/2026: cursos que não são de programação — música,
// idiomas, matemática e qualquer tema). O exercício continua sendo o desafio `tipo: "exercicio"`
// (períodos, rodadas, agenda e pontos não mudam); o que muda é o `conteudo.motor`, que diz a tela
// onde se pratica e quem corrige:
//
//   codigo   — o de sempre: editor, Rodar e a IA lendo o código. Exercício antigo, sem `motor`, é este.
//   aberto   — uma tarefa ou missão com entrega em texto, fotos, áudio ou vídeo; a IA corrige pelos
//              critérios (a rubrica). Serve a todos os perfis que não são programação.
//   calculo  — lista de 3 a 6 itens com resposta numérica ou expressão: o SERVIDOR corrige, sem IA.
//   ditado   — frases faladas pela voz do navegador; a pessoa escreve; o servidor compara palavra a palavra.
//   ouvido   — intervalos ou acordes tocados na tela; a pessoa escolhe o nome; o servidor corrige.
//   ritmo    — a pessoa bate o compasso junto do metrônomo; o servidor mede o desvio (musica.js).
//   afinacao — a pessoa canta ou toca a nota no microfone; o navegador detecta a altura e o servidor
//              mede os cents (musica.js).
//
// Os cinco últimos têm resposta certa: uma tentativa só (como o quiz), e o gabarito só vai para a
// tela depois de corrigido. Puro: sem banco, sem rede, sem DOM.

import { analisar, avaliar, equivalentes, formaAtendida, lerResposta, numeroCerto, formatarNumero, FORMAS } from "./expressao.js";
import { nomeDaNota } from "./musica.js";

export const MOTORES = {
  codigo: { nome: "Exercício de código", icone: "⌨️", tentativas: 5, corrige: "ia" },
  aberto: { nome: "Desafio prático", icone: "📝", tentativas: 5, corrige: "ia" },
  calculo: { nome: "Lista de cálculo", icone: "🧮", tentativas: 1, corrige: "servidor" },
  ditado: { nome: "Ditado", icone: "🎧", tentativas: 1, corrige: "servidor" },
  ouvido: { nome: "Treino de ouvido", icone: "🎼", tentativas: 1, corrige: "servidor" },
  ritmo: { nome: "Ritmo", icone: "🥁", tentativas: 1, corrige: "servidor" },
  afinacao: { nome: "Afinação", icone: "🎤", tentativas: 1, corrige: "servidor" },
};
export const motorDo = (conteudo) => (MOTORES[conteudo?.motor] ? conteudo.motor : "codigo");
export const corrigeNoServidor = (motor) => MOTORES[motor]?.corrige === "servidor";

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const texto = (valor, limite) => String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
const lista = (valor, limite, maximo) => (Array.isArray(valor) ? valor : []).map((t) => texto(t, limite)).filter(Boolean).slice(0, maximo);

// ================================================================ evidências (o que a pessoa entrega)

export const EVIDENCIAS = {
  texto: { nome: "Texto", icone: "📝" },
  imagens: { nome: "Fotos", icone: "📷" },
  audio: { nome: "Áudio", icone: "🎙️" },
  video: { nome: "Vídeo do YouTube", icone: "🎬" },
};
export const ORDEM_DAS_EVIDENCIAS = ["texto", "imagens", "audio", "video"];

/** Os limites de cada entrega. O áudio vai em WAV mono de 16 kHz (32 KB por segundo). */
export const LIMITES_DA_EVIDENCIA = {
  texto: 6000,
  imagens: 3,
  bytesPorImagem: 2_500_000,
  segundosDeAudio: { exercicio: 90, projeto: 180 },
  bytesPorSegundoDeAudio: 32_000,
  miniatura: 60_000, // a miniatura guardada de cada foto (data URL de JPEG pequeno)
};
const TIPOS_DE_IMAGEM = ["image/jpeg", "image/png", "image/webp"];
const TIPOS_DE_AUDIO = ["audio/wav", "audio/x-wav", "audio/wave"];

/** Um link de vídeo do YouTube (o Gemini assiste pelo link). Devolve o endereço limpo ou null. */
export function videoDoYoutube(url) {
  const s = String(url ?? "").trim();
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(s);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
}

/** As evidências que um desafio aceita, só entre as que existem; nunca vazio (texto sempre serve). */
export function evidenciasAceitas(listaBruta, permitidas = ORDEM_DAS_EVIDENCIAS) {
  const ok = ORDEM_DAS_EVIDENCIAS.filter((e) => (Array.isArray(listaBruta) ? listaBruta : []).includes(e) && permitidas.includes(e));
  return ok.length ? ok : ["texto"];
}

/**
 * Confere a entrega (só os metadados: o arquivo em si o servidor lê do formulário). `aceitas`: as
 * evidências do desafio; `projeto`: o projeto aceita áudio mais longo.
 *   { texto, video, imagens: [{ tipo, bytes, miniatura }], audio: { tipo, bytes, segundos } | null }
 */
export function conferirEvidencia(entrega, { aceitas, projeto = false }) {
  const e = entrega || {};
  const t = String(e.texto ?? "").trim();
  const imagens = Array.isArray(e.imagens) ? e.imagens : [];
  const audio = e.audio || null;
  const video = String(e.video ?? "").trim();
  const nomes = aceitas.map((a) => EVIDENCIAS[a].nome.toLowerCase()).join(", ");

  if (t.length > LIMITES_DA_EVIDENCIA.texto) return { ok: false, motivo: `o texto passou de ${LIMITES_DA_EVIDENCIA.texto.toLocaleString("pt-BR")} caracteres` };
  if (t && !aceitas.includes("texto")) return { ok: false, motivo: `este desafio pede: ${nomes}` };
  if (imagens.length && !aceitas.includes("imagens")) return { ok: false, motivo: `este desafio não pede fotos (pede: ${nomes})` };
  if (imagens.length > LIMITES_DA_EVIDENCIA.imagens) return { ok: false, motivo: `no máximo ${LIMITES_DA_EVIDENCIA.imagens} fotos` };
  for (const i of imagens) {
    if (!TIPOS_DE_IMAGEM.includes(i?.tipo)) return { ok: false, motivo: "as fotos precisam ser JPEG, PNG ou WebP" };
    if (!(i.bytes > 0) || i.bytes > LIMITES_DA_EVIDENCIA.bytesPorImagem) return { ok: false, motivo: "uma das fotos é grande demais — tire de novo ou reduza" };
    if (i.miniatura && (String(i.miniatura).length > LIMITES_DA_EVIDENCIA.miniatura || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(i.miniatura))) {
      return { ok: false, motivo: "a miniatura de uma das fotos veio estranha — tente de novo" };
    }
  }
  if (audio) {
    if (!aceitas.includes("audio")) return { ok: false, motivo: `este desafio não pede áudio (pede: ${nomes})` };
    if (!TIPOS_DE_AUDIO.includes(audio.tipo)) return { ok: false, motivo: "o áudio precisa chegar em WAV — grave pela própria tela" };
    const maximo = LIMITES_DA_EVIDENCIA.segundosDeAudio[projeto ? "projeto" : "exercicio"];
    const segundos = Number(audio.segundos) || 0;
    if (segundos < 1) return { ok: false, motivo: "o áudio está vazio" };
    if (segundos > maximo + 1) return { ok: false, motivo: `o áudio passou de ${maximo} segundos` };
    if (!(audio.bytes > 0) || audio.bytes > (maximo + 2) * LIMITES_DA_EVIDENCIA.bytesPorSegundoDeAudio + 1024) return { ok: false, motivo: "o áudio é grande demais" };
  }
  let videoLimpo = null;
  if (video) {
    if (!aceitas.includes("video")) return { ok: false, motivo: `este desafio não pede vídeo (pede: ${nomes})` };
    videoLimpo = videoDoYoutube(video);
    if (!videoLimpo) return { ok: false, motivo: "o vídeo precisa ser um link do YouTube (youtube.com ou youtu.be), público ou não listado" };
  }
  if (!t && !imagens.length && !audio && !videoLimpo) return { ok: false, motivo: `mande a sua entrega: ${nomes}` };
  if (t && t.length < 15 && !imagens.length && !audio && !videoLimpo) return { ok: false, motivo: "escreva um pouco mais antes de enviar" };
  return { ok: true, texto: t, video: videoLimpo, imagens: imagens.length, audio: audio ? { segundos: Math.round(Number(audio.segundos)) } : null };
}

// ================================================================ aberto (a IA corrige pela rubrica)

/** O desafio aberto que a IA devolveu, conferido. `permitidas`: as evidências do perfil. */
export function validarAberto(bruto, permitidas) {
  const enunciado = texto(bruto?.enunciado, 3000);
  if (!enunciado) throw new Error("a IA não devolveu o enunciado — tente de novo");
  const criterios = lista(bruto?.criterios, 240, 6);
  if (criterios.length < 2) throw new Error("a IA não devolveu critérios de correção — tente de novo");
  return {
    motor: "aberto",
    titulo: texto(bruto?.titulo, 120) || "Desafio do dia",
    enunciado,
    entrega: texto(bruto?.entrega, 500),
    evidencias: evidenciasAceitas(bruto?.evidencias, permitidas),
    dicas: lista(bruto?.dicas, 240, 4),
    criterios,
  };
}

// ================================================================ cálculo (o servidor corrige)

export const TIPOS_DE_ITEM = ["numero", "expressao"];

/**
 * A lista que a IA devolveu, conferida: fica só o item cuja resposta o analisador consegue ler (é o
 * analisador que vai corrigir). Menos de 3 itens bons, não serve.
 */
export function validarCalculo(bruto) {
  const itens = [];
  for (const it of Array.isArray(bruto?.itens) ? bruto.itens : []) {
    if (itens.length >= 6) break;
    const pergunta = texto(it?.pergunta, 400);
    const tipo = TIPOS_DE_ITEM.includes(it?.tipo) ? it.tipo : "numero";
    const resposta = texto(it?.resposta, 120);
    if (!pergunta || !resposta) continue;
    const variavel = /^[a-z]$/.test(String(it?.variavel || "")) && it.variavel !== "e" ? it.variavel : "x";
    try {
      if (tipo === "numero") lerResposta(resposta);
      else if (!Number.isFinite(avaliar(analisar(resposta, variavel), 1.7)) && !Number.isFinite(avaliar(analisar(resposta, variavel), 2.9))) continue;
    } catch {
      continue;
    }
    const tolerancia = Number(it?.tolerancia);
    itens.push({
      pergunta, tipo, resposta, variavel,
      forma: tipo === "expressao" && FORMAS[it?.forma] ? it.forma : "livre",
      ...(tipo === "numero" && tolerancia > 0 && tolerancia < 1e6 ? { tolerancia } : {}),
      explicacao: texto(it?.explicacao, 500),
    });
  }
  if (itens.length < 3) throw new Error("a IA não montou itens que dê para corrigir — tente de novo");
  return { motor: "calculo", titulo: texto(bruto?.titulo, 120) || "Lista do dia", instrucoes: texto(bruto?.instrucoes, 600), itens };
}

/** Corrige um item da lista. Devolve { certo, motivo }. */
export function corrigirItemDeCalculo(item, respostaBruta) {
  const r = String(respostaBruta ?? "").trim();
  if (!r) return { certo: false, motivo: "sem resposta" };
  if (item.tipo === "numero") {
    let valor;
    try { valor = lerResposta(r); } catch (e) { return { certo: false, motivo: `não deu para ler: ${e.message}` }; }
    const certo = lerResposta(item.resposta);
    return numeroCerto(valor, certo, item.tolerancia)
      ? { certo: true, motivo: "" }
      : { certo: false, motivo: `deu ${formatarNumero(valor)}, e a resposta é ${formatarNumero(certo)}` };
  }
  let minha;
  try { minha = analisar(r, item.variavel || "x"); } catch (e) { return { certo: false, motivo: `não deu para ler: ${e.message}` }; }
  const certa = analisar(item.resposta, item.variavel || "x");
  const eq = equivalentes(minha, certa);
  if (!eq.iguais) {
    return {
      certo: false,
      motivo: eq.x != null
        ? `não é equivalente: com ${item.variavel || "x"} = ${formatarNumero(eq.x)}, a sua dá ${formatarNumero(eq.minha)} e a certa dá ${formatarNumero(eq.certa)}`
        : "não é equivalente à resposta certa",
    };
  }
  if (!formaAtendida(minha, item.forma, certa)) return { certo: false, motivo: `a conta está certa, mas o item pede a forma ${FORMAS[item.forma]}` };
  return { certo: true, motivo: "" };
}

export function corrigirCalculo(conteudo, respostas) {
  const itens = conteudo.itens.map((it, i) => corrigirItemDeCalculo(it, respostas?.[i]));
  const certos = itens.filter((i) => i.certo).length;
  return { nota: Math.round((certos / itens.length) * 100), itens };
}

// ================================================================ ditado (o servidor corrige)

/** O idioma do ditado, no formato da voz do navegador (en-US, es-ES...). */
const IDIOMA = /^[a-z]{2,3}(-[A-Z]{2})?$/;

export function validarDitado(bruto) {
  const frases = [];
  for (const f of Array.isArray(bruto?.frases) ? bruto.frases : []) {
    if (frases.length >= 6) break;
    const t = texto(f?.texto, 180);
    if (palavrasDoDitado(t).length < 2) continue;
    if (frases.some((x) => x.texto.toLowerCase() === t.toLowerCase())) continue;
    frases.push({ texto: t, traducao: texto(f?.traducao, 240) });
  }
  if (frases.length < 3) throw new Error("a IA não montou frases suficientes para o ditado — tente de novo");
  const idioma = IDIOMA.test(String(bruto?.idioma || "")) ? bruto.idioma : "en-US";
  return { motor: "ditado", titulo: texto(bruto?.titulo, 120) || "Ditado do dia", idioma, frases };
}

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** As palavras de uma frase, para comparar: minúsculas, sem pontuação; o acento fica (conta meio ponto). */
export function palavrasDoDitado(frase) {
  return String(frase ?? "").normalize("NFC").toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,!?;:¿¡"“”«»()[\]{}…–—-]/g, " ")
    .split(/\s+/).filter(Boolean);
}

/**
 * Compara a frase certa com o que a pessoa escreveu, palavra a palavra, na ordem (a maior sequência
 * comum). Palavra certa vale 1; certa a menos do acento, meio. Devolve a nota (0 a 1) e cada palavra
 * da frase certa com o que aconteceu com ela ("ok", "acento" ou "falta").
 */
export function compararDitado(certa, escrita) {
  const c = palavrasDoDitado(certa), e = palavrasDoDitado(escrita);
  const cs = c.map(semAcento), es = e.map(semAcento);
  const m = c.length, n = e.length;
  const t = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = cs[i] === es[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const marcas = new Array(m).fill("falta");
  for (let i = 0, j = 0; i < m && j < n;) {
    if (cs[i] === es[j]) { marcas[i] = c[i] === e[j] ? "ok" : "acento"; i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  // palavra a mais também custa: quem escreve a frase inteira duas vezes não ganha nota cheia
  const sobras = Math.max(0, n - marcas.filter((x) => x !== "falta").length);
  const soma = marcas.reduce((s, x) => s + (x === "ok" ? 1 : x === "acento" ? 0.5 : 0), 0);
  return { nota: m ? Math.max(0, soma - sobras * 0.5) / m : 0, palavras: c.map((p, i) => ({ palavra: p, marca: marcas[i] })) };
}

export function corrigirDitado(conteudo, respostas) {
  const frases = conteudo.frases.map((f, i) => compararDitado(f.texto, respostas?.[i]));
  const nota = Math.round((frases.reduce((s, f) => s + f.nota, 0) / frases.length) * 100);
  return { nota, frases };
}

/**
 * A frase vai embaralhada para a tela (a voz do navegador precisa dela, então ela tem de ir): não é
 * segredo de verdade, só não fica à vista no código da página. A tela desembaralha na hora de falar.
 */
export function embaralhar(s) {
  return [...String(s ?? "")].map((ch) => (ch.codePointAt(0) ^ 0x5a).toString(16).padStart(4, "0")).join("");
}
export function desembaralhar(hex) {
  const partes = String(hex ?? "").match(/.{4}/g) || [];
  return partes.map((h) => String.fromCodePoint(Number.parseInt(h, 16) ^ 0x5a)).join("");
}

// ================================================================ ouvido (o servidor corrige)

export const INTERVALOS = [
  { nome: "2ª menor", semitons: 1 }, { nome: "2ª maior", semitons: 2 }, { nome: "3ª menor", semitons: 3 },
  { nome: "3ª maior", semitons: 4 }, { nome: "4ª justa", semitons: 5 }, { nome: "trítono", semitons: 6 },
  { nome: "5ª justa", semitons: 7 }, { nome: "6ª menor", semitons: 8 }, { nome: "6ª maior", semitons: 9 },
  { nome: "7ª menor", semitons: 10 }, { nome: "7ª maior", semitons: 11 }, { nome: "8ª justa", semitons: 12 },
];
const INTERVALOS_BASICOS = ["2ª maior", "3ª menor", "3ª maior", "4ª justa", "5ª justa", "8ª justa"];
export const ACORDES = [
  { nome: "maior", notas: [0, 4, 7] }, { nome: "menor", notas: [0, 3, 7] },
  { nome: "diminuto", notas: [0, 3, 6] }, { nome: "aumentado", notas: [0, 4, 8] },
];
const ACORDES_BASICOS = ["maior", "menor"];
const ITENS_DO_OUVIDO = 8;

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

/** O que o assunto treina: acordes (tríades, harmonia) ou intervalos; avançado usa a lista inteira. */
export function categoriaDoOuvido(assunto) {
  const t = `${assunto?.titulo || ""} ${assunto?.descricao || ""}`;
  const acordes = /acorde|tr[ií]ade|harmonia|campo harm/i.test(t);
  const completo = assunto?.nivel === "avancado" || /diminut|aumentad|tr[ií]tono|s[eé]tima|sexta/i.test(t);
  return { categoria: acordes ? "acordes" : "intervalos", completo };
}

/**
 * O treino de ouvido, montado pelo código (sem IA): 8 itens com as notas (MIDI) e as opções. A
 * resposta certa (`correta`) só vai para a tela depois de corrigido.
 */
export function gerarOuvido({ semente, assunto }) {
  const { categoria, completo } = categoriaDoOuvido(assunto);
  const sortear = sorteador(semente);
  const escolher = (xs) => xs[Math.floor(sortear() * xs.length)];
  const catalogo = categoria === "acordes"
    ? ACORDES.filter((a) => completo || ACORDES_BASICOS.includes(a.nome))
    : INTERVALOS.filter((i) => completo || INTERVALOS_BASICOS.includes(i.nome));
  const opcoes = catalogo.map((x) => x.nome);
  const itens = [];
  for (let k = 0; k < ITENS_DO_OUVIDO; k++) {
    const alvo = escolher(catalogo);
    const base = 52 + Math.floor(sortear() * 13); // de Mi2 a Mi3: grave o bastante para caber a 8ª
    const notas = categoria === "acordes" ? alvo.notas.map((s) => base + s) : [base, base + alvo.semitons];
    itens.push({ notas, modo: categoria === "acordes" ? "harmonico" : (completo && sortear() < 0.3 ? "harmonico" : "melodico"), correta: opcoes.indexOf(alvo.nome) });
  }
  return {
    motor: "ouvido",
    titulo: categoria === "acordes" ? "Treino de ouvido: acordes" : "Treino de ouvido: intervalos",
    categoria, opcoes, itens, semente: semente >>> 0,
  };
}

export function corrigirOuvido(conteudo, respostas) {
  const itens = conteudo.itens.map((it, i) => {
    const r = Number(respostas?.[i]);
    const certo = Number.isInteger(r) && r === it.correta;
    return { certo, motivo: certo ? "" : `era ${conteudo.opcoes[it.correta]}${Number.isInteger(r) && conteudo.opcoes[r] ? ` (você marcou ${conteudo.opcoes[r]})` : " (sem resposta)"}` };
  });
  const certos = itens.filter((i) => i.certo).length;
  return { nota: Math.round((certos / itens.length) * 100), itens };
}

// ================================================================ o que vai para a tela e a avaliação

/**
 * O conteúdo do exercício como a tela pode ver: antes de corrigido, sem gabarito (a resposta da
 * lista, o nome do intervalo; a frase do ditado, embaralhada). Corrigido, tudo aparece.
 */
export function exercicioParaTela(conteudo, corrigido) {
  const motor = motorDo(conteudo);
  if (corrigido || !corrigeNoServidor(motor)) return conteudo;
  if (motor === "calculo") return { ...conteudo, itens: conteudo.itens.map(({ resposta, explicacao, tolerancia, ...resto }) => resto) };
  if (motor === "ditado") return { ...conteudo, frases: conteudo.frases.map((f) => ({ fala: embaralhar(f.texto) })) };
  if (motor === "ouvido") return { ...conteudo, itens: conteudo.itens.map(({ correta, ...resto }) => resto) };
  // a afinação com intervalo esconde a nota pedida (a referência e o intervalo bastam); o ritmo não
  // tem segredo: o padrão precisa estar à vista
  if (motor === "afinacao" && conteudo.comIntervalo) return { ...conteudo, itens: conteudo.itens.map(({ alvo, nome, ...resto }) => resto) };
  return conteudo;
}

/**
 * A avaliação de um motor corrigido no servidor, no mesmo formato da avaliação da IA (passa por
 * validarAvaliacao depois): um "requisito" por item, para a tela mostrar o que acertou e errou.
 */
export function avaliacaoDoMotor(motor, conteudo, correcao) {
  const rotulos = motor === "calculo"
    ? conteudo.itens.map((it) => it.pergunta)
    : motor === "ditado"
      ? conteudo.frases.map((f) => f.texto)
      : motor === "ritmo"
        ? conteudo.itens.map((_, i) => `Compasso ${i + 1}`)
        : motor === "afinacao"
          ? conteudo.itens.map((it, i) => `Nota ${i + 1}: ${nomeDaNota(it.alvo, false)}${it.alvo !== it.referencia ? ` (${it.pedido} de ${nomeDaNota(it.referencia, false)})` : ""}`)
          : conteudo.itens.map((_, i) => `Item ${i + 1}`);
  const resultados = motor === "ditado"
    ? correcao.frases.map((f) => ({
      certo: f.nota >= 0.999,
      motivo: f.nota >= 0.999 ? "" : `${Math.round(f.nota * 100)}% da frase${f.palavras.some((p) => p.marca === "acento") ? " (atenção aos acentos)" : ""}`,
    }))
    : correcao.itens;
  const certos = resultados.filter((r) => r.certo).length;
  const nota = limitar(correcao.nota, 0, 100);
  return {
    nota,
    comentario: nota === 100 ? "Tudo certo — nota máxima!"
      : nota >= 60 ? `Você acertou ${certos} de ${resultados.length}. Veja abaixo os que faltaram.`
      : `Você acertou ${certos} de ${resultados.length}. Revise os itens abaixo e tente outra rodada.`,
    pontosFortes: [],
    melhorias: [],
    requisitos: resultados.map((r, i) => ({ numero: i + 1, requisito: rotulos[i], atendido: r.certo, observacao: r.motivo })),
    extras: [],
  };
}
