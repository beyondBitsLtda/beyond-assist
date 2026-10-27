// Exercita o Modo Tomar nota sem microfone, sem Gemini e sem banco.
//
// O que pode dar errado aqui não levanta exceção: o gravador corta no meio da fala ou passa
// dos 10 minutos, o WAV sai com o cabeçalho errado e o Gemini "transcreve" ruído, uma citação
// que o modelo reescreveu entra no card como se fosse a fala real, ou "toma nota que amanhã…"
// abre o modo em vez de virar um lembrete.

import { CODIGO_DO_GRAVADOR, limparTranscricao, minutoDe, pedidoDeTomarNota, wavDePcm16 } from "../src/lib/tomarNota.js";
import { citacoesConferidas, descricaoDaNota, nomeDaColuna, trechosValidos, transcricaoComTempo } from "../src/lib/notas.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

console.log("\n1) o pedido no chat");
{
  const casos = [
    ["tomar nota sobre a reunião de vendas", "a reunião de vendas"],
    ["Lisa, toma nota: planejamento do Q4", "planejamento do Q4"],
    ["modo tomar nota", ""],
    ["tome nota", ""],
    ["abre o modo tomar nota sobre aula de cálculo.", "aula de cálculo"],
    ["Tomar notas da daily", "daily"],
  ];
  for (const [frase, tema] of casos) {
    const r = pedidoDeTomarNota(frase);
    conferir(`"${frase}" → "${tema}"`, r === tema, `veio ${JSON.stringify(r)}`);
  }
  for (const frase of [
    "o que é tomar nota?",
    "cria um card: tomar nota fiscal",
    "toma nota que amanhã eu tenho que levar o carro na revisão e depois passar no banco para pagar a conta de luz",
    "quais notas eu tenho no abacato",
  ]) {
    conferir(`NÃO abre com "${frase.slice(0, 50)}"`, pedidoDeTomarNota(frase) === null, `veio ${JSON.stringify(pedidoDeTomarNota(frase))}`);
  }
}

console.log("\n2) WAV e relógio");
{
  const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
  const wav = new DataView(wavDePcm16(pcm, 16000));
  const txt = (pos) => String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(pos + i)));
  conferir("cabeçalho RIFF/WAVE/fmt/data", txt(0) === "RIFF" && txt(8) === "WAVE" && txt(12) === "fmt " && txt(36) === "data");
  conferir("tamanho total = 44 + 2×amostras", wav.byteLength === 44 + 10, `${wav.byteLength}`);
  conferir("PCM mono 16 kHz 16 bits", wav.getUint16(20, true) === 1 && wav.getUint16(22, true) === 1 && wav.getUint32(24, true) === 16000 && wav.getUint16(34, true) === 16);
  conferir("amostras copiadas", wav.getInt16(44 + 6, true) === 32767 && wav.getInt16(44 + 8, true) === -32768);
  conferir("minutoDe", minutoDe(0) === "00:00" && minutoDe(65.4) === "01:05" && minutoDe(600) === "10:00");
}

console.log("\n2b) limpeza da transcrição (o que o Gemini devolveu no teste de 27/10/2026)");
{
  const sujo = "Por 00:48 último, os riscos.\n\nO maior risco 00:52 é a integração com o sistema de pagamentos 00:56\nA versão ⁠beta vai para a loja no dia 15 ⁠de novembro.";
  const limpo = limparTranscricao(sujo);
  conferir("tira as marcações de tempo", !/00:\d\d/.test(limpo) && limpo.startsWith("Por último, os riscos."), JSON.stringify(limpo.slice(0, 40)));
  conferir("tira os caracteres invisíveis", !/[​-‍⁠﻿]/.test(limpo) && limpo.includes("A versão beta vai para a loja no dia 15 de novembro."));
  conferir("mantém as quebras de fala", limpo.split("\n\n").length === 2);
  conferir("hora dita de verdade fica", limparTranscricao("A reunião é às 10:30 ou 14:00.") === "A reunião é às 10:30 ou 14:00.");
  conferir("tira a linha separadora que o modelo inventa", limparTranscricao("O assunto de hoje é ─────── O prazo:") === "O assunto de hoje é O prazo:", JSON.stringify(limparTranscricao("O assunto de hoje é ─────── O prazo:")));
  conferir("o travessão de troca de pessoa fica", limparTranscricao("Está bom.\n— Concordo, Ana.") === "Está bom.\n— Concordo, Ana.");
}

console.log("\n3) o gravador (AudioWorklet) com áudio sintético a 48 kHz");
{
  // Um AudioWorkletGlobalScope de mentira: o mesmo código que vai para o navegador.
  const mensagens = [];
  let Classe = null;
  class AudioWorkletProcessor {
    constructor() {
      this.port = { postMessage: (m) => mensagens.push(m), onmessage: null };
    }
  }
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", CODIGO_DO_GRAVADOR)(
    AudioWorkletProcessor, (_nome, c) => { Classe = c; }, 48000,
  );
  conferir("registra o processador", !!Classe);

  // Fala: 4 s de "voz" (senoide modulada) e 0,6 s de pausa, repetindo.
  const rodar = (segundos, opcoes, aoMeio) => {
    mensagens.length = 0;
    const p = new Classe({ processorOptions: opcoes });
    const bloco = 128;
    let t = 0;
    let vivo = true;
    for (let n = 0; n < Math.round((segundos * 48000) / bloco) && vivo; n++) {
      const a = new Float32Array(bloco);
      for (let i = 0; i < bloco; i++, t++) {
        const s = t / 48000;
        const falando = s % 4.6 < 4;
        a[i] = falando ? 0.2 * Math.sin(2 * Math.PI * 220 * s) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * s)) : 0.001 * Math.sin(2 * Math.PI * 50 * s);
      }
      vivo = p.process([[a]]);
      if (aoMeio && n === Math.round((aoMeio.em * 48000) / bloco)) p.port.onmessage({ data: aoMeio.msg });
    }
    return { trechos: mensagens.filter((m) => m.tipo === "trecho"), niveis: mensagens.filter((m) => m.tipo === "nivel") };
  };

  const r = rodar(70, { taxa: 16000, limiteSegundos: 600 }, { em: 69, msg: "parar" });
  const cortes = r.trechos.filter((m) => !m.final);
  conferir("corta trechos entre 25 e 35 s", cortes.length >= 2 && cortes.every((m) => m.duracao >= 25 && m.duracao <= 35), cortes.map((m) => m.duracao.toFixed(1)).join(", "));
  conferir("os cortes caem numa pausa (≥ 4 s de cada bloco de fala)", cortes.every((m) => ((m.inicio + m.duracao) % 4.6) >= 3.9), cortes.map((m) => ((m.inicio + m.duracao) % 4.6).toFixed(2)).join(", "));
  conferir("trechos em sequência, sem buraco", r.trechos.every((m, i) => i === 0 || Math.abs(m.inicio - (r.trechos[i - 1].inicio + r.trechos[i - 1].duracao)) < 0.01));
  conferir("índices 0, 1, 2…", r.trechos.filter((m) => m.duracao > 0).every((m, i) => m.indice === i));
  const ultimo = r.trechos.at(-1);
  conferir("\"parar\" manda o último trecho com final", ultimo?.final && ultimo.motivo === "parada", JSON.stringify({ final: ultimo?.final, motivo: ultimo?.motivo }));
  const total = r.trechos.reduce((s, m) => s + m.duracao, 0);
  conferir("16 kHz: o tempo somado bate com o áudio", Math.abs(total - 69) < 0.2, `${total.toFixed(2)} s`);
  conferir("PCM do tamanho certo", r.trechos.every((m) => m.pcm.length === Math.round(m.duracao * 16000)));
  conferir("nível a cada 100 ms", Math.abs(r.niveis.length - 690) <= 2, `${r.niveis.length}`);
  conferir("pico do trecho mede a fala", cortes.every((m) => m.pico > 0.08), cortes.map((m) => m.pico.toFixed(3)).join(", "));

  const lim = rodar(80, { taxa: 16000, limiteSegundos: 61 });
  const fim = lim.trechos.at(-1);
  conferir("o limite encerra sozinho, pelo relógio do áudio", fim?.final && fim.motivo === "limite", JSON.stringify({ final: fim?.final, motivo: fim?.motivo }));
  const somado = lim.trechos.reduce((s, m) => s + m.duracao, 0);
  conferir("e para exatamente no limite", Math.abs(somado - 61) < 0.01, `${somado.toFixed(3)} s`);
  conferir("depois do limite, nada mais", lim.trechos.filter((m) => m.final).length === 1);

  const ret = rodar(10, { taxa: 16000, limiteSegundos: 600, jaGravadas: 120 * 16000, proximoIndice: 5 }, { em: 9, msg: "despejar" });
  conferir("retomada continua o relógio e os índices", ret.trechos[0]?.inicio === 120 && ret.trechos[0]?.indice === 5 && !ret.trechos[0]?.final, JSON.stringify({ inicio: ret.trechos[0]?.inicio, indice: ret.trechos[0]?.indice }));

  const silencio = (() => {
    mensagens.length = 0;
    const p = new Classe({ processorOptions: { taxa: 16000, limiteSegundos: 600 } });
    for (let n = 0; n < (40 * 48000) / 128; n++) p.process([[new Float32Array(128)]]);
    return mensagens.filter((m) => m.tipo === "trecho");
  })();
  conferir("silêncio total: corta no mínimo e o pico fica em zero", silencio.length === 1 && Math.abs(silencio[0].duracao - 25) < 0.06 && silencio[0].pico === 0, JSON.stringify(silencio.map((m) => [m.duracao, m.pico])));
}

console.log("\n4) o que vai para o Abacato");
{
  const trechos = trechosValidos([
    { indice: 1, inicio: 31.2, texto: "Segundo ponto: o orçamento de marketing sobe 15% em janeiro, decidiu a Ana." },
    { indice: 0, inicio: 0, texto: "Bom dia. O assunto é o planejamento do Q4. Primeiro, o prazo do site novo fica para 15 de novembro." },
    { indice: 0, inicio: 0, texto: "duplicado" },
    { indice: 2, inicio: 60, texto: "   " },
    { indice: -1, inicio: 0, texto: "inválido" },
  ]);
  conferir("trechos: ordena, tira repetido, vazio e inválido", trechos.map((t) => t.indice).join(",") === "0,1", trechos.map((t) => t.indice).join(","));
  conferir("transcrição com o minuto", transcricaoComTempo(trechos).startsWith("[00:00] Bom dia.") && transcricaoComTempo(trechos).includes("\n\n[00:31] Segundo ponto"));

  const exatas = citacoesConferidas(["o orçamento de marketing sobe 15% em janeiro", "“O prazo do site novo fica para 15 de novembro.”"], trechos);
  conferir("citação real é achada, com o minuto do trecho", exatas.length === 2 && exatas.every((c) => c.exata) && exatas[0].inicio === 31.2 && exatas[1].inicio === 0, JSON.stringify(exatas));
  const reescrita = citacoesConferidas(["o orçamento de marketing vai aumentar 15%"], trechos);
  conferir("citação reescrita pelo modelo entra só como aproximada", reescrita.length === 1 && reescrita[0].exata === false);
  const mista = citacoesConferidas(["o orçamento de marketing vai aumentar 15%", "decidiu a Ana"], trechos);
  conferir("com uma real, a reescrita fica de fora", mista.length === 1 && mista[0].texto === "decidiu a Ana");
  const comDuracao = trechos.map((t) => ({ ...t, duracao: 30 }));
  const [noFim] = citacoesConferidas(["decidiu a Ana"], comDuracao);
  conferir("o minuto da citação é estimado dentro do trecho", noFim.inicio > 31.2 + 20 && noFim.inicio <= 61.2, `${noFim.inicio.toFixed(1)} s`);

  const desc = descricaoDaNota(
    { titulo: "Orçamento de marketing", interpretacao: "O orçamento cresce em janeiro.", pontos: ["+15%"], encaminhamentos: [], citacoes: ["o orçamento de marketing sobe 15% em janeiro"] },
    trechos,
    { quando: "27/10/2026 14:30", duracaoMin: 8, tema: "Planejamento do Q4" },
  );
  conferir("descrição: interpretação, pontos e transcrição literal", /^INTERPRETAÇÃO DA LISA\n/.test(desc) && desc.includes("PONTOS PRINCIPAIS\n• +15%") && desc.includes("O QUE FOI DITO (transcrição literal)\n[00:31] “o orçamento de marketing sobe 15% em janeiro”"));
  conferir("descrição: sem seção vazia nem markdown", !desc.includes("ENCAMINHAMENTOS") && !/[*#]{1,}\s/.test(desc));
  conferir("descrição: assinatura com data e tema", desc.endsWith("— Tomar nota · 27/10/2026 14:30 · 8 min de escuta · tema: Planejamento do Q4"));

  conferir("nome da coluna: uma linha, sem espaço sobrando", nomeDaColuna("  Reunião \n de   vendas ") === "Reunião de vendas");
  conferir("nome da coluna: corta em 60", nomeDaColuna("x".repeat(90)).length === 60 && nomeDaColuna("x".repeat(90)).endsWith("…"));
}

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
