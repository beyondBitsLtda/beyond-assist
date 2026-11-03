// Guarda o microfone do celular "como o do WhatsApp" (src/lib/falaComoWhatsApp.js): o gesto (segurar,
// soltar, cancelar, travar, toque curto), o relógio, o formato da gravação, a conversão para 16 kHz
// mono, o silêncio, os cortes de uma fala longa — e que a página usa o microfone novo nos dois
// modos do celular, sem o reconhecimento do navegador. A gravação em si só se confere no navegador.
//
// Uso: node scripts/microfone-check.mjs

import fs from "node:fs";
import {
  GESTO, LIMITE_DA_FALA, TAXA_DA_FALA, PICO_DE_SILENCIO, DICAS, gestoDoDedo, aoSoltar, relogioDaFala, tipoDeGravacao,
  mixarEmMono, reamostrar, pcm16DeFloat, picoDaFala, cortesNaPausa, juntarTranscricoes, dicaDoErro,
  corrigirNomeDaLisa, dicaDaTranscricao, textoDoWhisper, VEZ, inicioDaEscuta, passoDaEscuta,
} from "../src/lib/falaComoWhatsApp.js";

let falhas = 0;
const conferir = (t, cond, d = "") => { console.log(`  ${cond ? "ok   " : "FALHA"} ${t}${!cond && d ? ` — ${d}` : ""}`); if (!cond) falhas++; };
const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

console.log("o gesto");
conferir("parado no lugar: segurando", gestoDoDedo(0, 0) === "segurando" && gestoDoDedo(-30, -20) === "segurando");
conferir("para a esquerda além do limite: cancela", gestoDoDedo(-GESTO.cancelar, 0) === "cancelar" && gestoDoDedo(-200, -10) === "cancelar");
conferir("para cima além do limite: trava", gestoDoDedo(0, -GESTO.travar) === "travar" && gestoDoDedo(-20, -120) === "travar");
conferir("para a esquerda E para cima: cancelar ganha (o dedo foi embora)", gestoDoDedo(-GESTO.cancelar, -GESTO.travar) === "cancelar");
conferir("para baixo ou para a direita não faz nada", gestoDoDedo(80, 80) === "segurando");
conferir("soltar depois de segurar: envia", aoSoltar({ duracaoMs: 2000 }) === "enviar" && aoSoltar({ duracaoMs: GESTO.minimoMs }) === "enviar");
conferir("toque curto: só a dica", aoSoltar({ duracaoMs: 150 }) === "curta" && aoSoltar({ duracaoMs: NaN }) === "curta");
conferir("travada: soltar o dedo continua gravando", aoSoltar({ duracaoMs: 5000, travada: true }) === "continuar");
conferir("as dicas existem (segure, liberado, silêncio, cancelada)", ["segure", "liberado", "silencio", "naoEntendi", "cancelada"].every((k) => DICAS[k]));

console.log("\no relógio e o formato");
conferir("0:00, 0:07, 1:05, 2:00", relogioDaFala(0) === "0:00" && relogioDaFala(7.9) === "0:07" && relogioDaFala(65) === "1:05" && relogioDaFala(LIMITE_DA_FALA) === "2:00");
conferir("valor estranho vira 0:00", relogioDaFala(-3) === "0:00" && relogioDaFala("x") === "0:00");
conferir("Android (webm/opus) e iPhone (mp4)", tipoDeGravacao((t) => t.startsWith("audio/webm")) === "audio/webm;codecs=opus" && tipoDeGravacao((t) => t === "audio/mp4") === "audio/mp4");
conferir("sem nenhum conhecido: deixa o navegador escolher", tipoDeGravacao(() => false) === "" && tipoDeGravacao(() => { throw new Error("x"); }) === "");

console.log("\no áudio");
const seno = (n, taxa, hz = 220, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / taxa));
conferir("dois canais viram um (a média)", mixarEmMono([Float32Array.of(1, 0), Float32Array.of(0, 1)]).join() === "0.5,0.5");
const de48 = reamostrar(seno(48_000, 48_000), 48_000);
const de441 = reamostrar(seno(44_100, 44_100), 44_100);
conferir("1 s a 48 kHz e a 44,1 kHz viram 1 s a 16 kHz", Math.abs(de48.length - TAXA_DA_FALA) <= 1 && Math.abs(de441.length - TAXA_DA_FALA) <= 1, `${de48.length}, ${de441.length}`);
conferir("já em 16 kHz (ou menos): fica igual", reamostrar(Float32Array.of(0.1, 0.2), 16_000).length === 2);
const pcm = pcm16DeFloat(Float32Array.of(-2, -1, 0, 1, 2));
conferir("float → PCM 16 bits, cortando o que passa de ±1", pcm[0] === -32768 && pcm[1] === -32768 && pcm[2] === 0 && pcm[3] === 32767 && pcm[4] === 32767);
conferir("silêncio fica abaixo do pico mínimo; fala, acima", picoDaFala(new Int16Array(16_000)) < PICO_DE_SILENCIO && picoDaFala(pcm16DeFloat(seno(16_000, 16_000, 220, 0.2))) > PICO_DE_SILENCIO);

console.log("\nfala longa: os cortes para a transcrição");
const curta = pcm16DeFloat(seno(16_000 * 20, 16_000));
conferir("até 35 s: um pedaço só", JSON.stringify(cortesNaPausa(curta)) === JSON.stringify([[0, curta.length]]));
// 70 s de fala com uma pausa de 0,5 s aos 30 s: o corte cai na pausa
const longa = seno(16_000 * 70, 16_000);
longa.fill(0, 16_000 * 30, 16_000 * 30.5);
const cortes = cortesNaPausa(pcm16DeFloat(longa));
conferir("70 s: em pedaços de até 35 s, que cobrem tudo sem buraco", cortes.length >= 2 && cortes[0][0] === 0 && cortes.at(-1)[1] === longa.length
  && cortes.every(([a, b], i) => b - a <= 35 * 16_000 && (i === 0 || a === cortes[i - 1][1])), JSON.stringify(cortes));
conferir("o primeiro corte cai na pausa (entre 30 e 30,5 s)", cortes[0][1] >= 16_000 * 30 && cortes[0][1] <= 16_000 * 30.5, String(cortes[0][1] / 16_000));
conferir("os textos dos pedaços viram uma frase", juntarTranscricoes([" Oi, Lisa, ", "", "me ajuda  com isso?"]) === "Oi, Lisa, me ajuda com isso?");

console.log("\nos erros do microfone");
conferir("bloqueado: explica onde liberar", /bloqueado/.test(dicaDoErro({ name: "NotAllowedError" })) && /permiss/.test(dicaDoErro({ name: "NotAllowedError" })));
conferir("sem microfone, em uso por outro app e o resto", /Não encontrei/.test(dicaDoErro({ name: "NotFoundError" })) && /outro app/.test(dicaDoErro({ name: "NotReadableError" })) && /Tente de novo/.test(dicaDoErro(new Error("x"))));

console.log("\nno aparelho");
const gravador = ler("src/lib/gravadorDeFala.js");
conferir("grava com o MediaRecorder e mede o volume do MESMO microfone (sem abrir outro)", /new MediaRecorder\(stream/.test(gravador) && /medirMicrofone\(stream\)/.test(gravador) && (gravador.match(/getUserMedia\(/g) || []).length === 1);
conferir("decodifica sem gesto (OfflineAudioContext) e manda WAV para a transcrição do Tomar nota", /OfflineAudioContext/.test(gravador) && /\/api\/notas\/trecho/.test(gravador) && /mimeType: "audio\/wav"/.test(gravador));
const mic = ler("src/components/panels/MicrofoneDaLisa.js");
conferir("o botão captura o dedo (sair do botão não para) e não usa pointerleave", /setPointerCapture\(e\.pointerId\)/.test(mic) && !/onPointerLeave/.test(mic));
conferir("travada, o botão vira outro elemento (o soltar não vira clique em enviar)", /key="enviar"/.test(mic) && /key="mic"/.test(mic));
conferir("sem o reconhecimento do navegador", !/SpeechRecognition/.test(mic + gravador));
const pagina = ler("src/app/(panels)/assistant/page.js");
conferir("o celular usa o microfone novo no chat e no modo voz", /<MicrofoneDaLisa\s+variante="chat"/.test(pagina) && /<MicrofoneDaLisa\s+variante="voz"/.test(pagina));
conferir("o texto transcrito vai para a conversa, e a esfera escuta enquanto grava", (pagina.match(/aoTexto=\{\(q\) => ask\(q\)\}/g) || []).length === 2 && /s\.gravandoFala\) return \{ estado: "ouvindo"/.test(pagina));
conferir("os botões antigos (Web Speech de segurar) saíram", !/startMicHold|stopMicHold|bb-botao-segurar/.test(pagina) && !/bb-botao-segurar/.test(ler("src/app/globals.css")));
conferir("o usuário comum alcança a transcrição", /prefixo: "\/api\/notas"/.test(ler("src/lib/authSession.js")));
conferir("o \"</> editor\" sai do caminho gravando e no modo voz", /className="bb-ide-chamar"/.test(ler("src/components/panels/IdeDaLisa.js"))
  && /body\.bb-gravando-fala \.bb-ide-chamar/.test(ler("src/app/globals.css")) && /body\[data-celular="voice"\] \.bb-ide-chamar/.test(ler("src/app/globals.css")));

console.log("\no nome dela, o texto do Whisper e a Conversa livre no celular (BEYOND-0011)");
const nomes = [
  ["oi Elisa, que horas são?", "oi Lisa, que horas são?"], ["Elisa, me ajuda", "Lisa, me ajuda"], ["olá Liza", "olá Lisa"],
  ["bom dia, Alissa!", "bom dia, Lisa!"], ["me diz, Elisa, onde fica", "me diz, Lisa, onde fica"], ["Obrigada, Elisa.", "Obrigada, Lisa."],
  ["eliza qual o clima", "Lisa qual o clima"], ["Lisa", "Lisa"],
];
conferir("chamando por ela (começo, cumprimento, entre vírgulas): o nome vira Lisa", nomes.every(([de, para]) => corrigirNomeDaLisa(de) === para),
  nomes.filter(([de, para]) => corrigirNomeDaLisa(de) !== para).map(([de]) => `${de} → ${corrigirNomeDaLisa(de)}`).join(" | "));
conferir("no meio da frase, outra pessoa: fica como veio", corrigirNomeDaLisa("pergunte à Elisa do RH") === "pergunte à Elisa do RH"
  && corrigirNomeDaLisa("a Elisa mandou o relatório") === "a Elisa mandou o relatório" && corrigirNomeDaLisa("Elisabete, oi") === "Elisabete, oi");
conferir("a dica da transcrição leva o nome e o fim da fala anterior", /Lisa/.test(dicaDaTranscricao()) && dicaDaTranscricao("e o prazo?").endsWith("e o prazo?"));
conferir("Whisper: junta os trechos com fala", textoDoWhisper({ text: "x", segments: [{ text: " Oi, Lisa.", no_speech_prob: 0.02, avg_logprob: -0.2 }, { text: " Tudo bem?", no_speech_prob: 0.1, avg_logprob: -0.3 }] }) === "Oi, Lisa. Tudo bem?");
conferir("Whisper: o trecho que ele mesmo marca como sem fala sai", textoDoWhisper({ segments: [{ text: " Que horas são?", no_speech_prob: 0.05, avg_logprob: -0.2 }, { text: " Obrigado.", no_speech_prob: 0.9, avg_logprob: -1.2 }] }) === "Que horas são?");
conferir("Whisper: frase de legenda inventada no silêncio vira nada", textoDoWhisper({ text: "Legendas pela comunidade Amara.org" }) === "" && textoDoWhisper({ text: " " }) === "");
conferir("Whisper: sem segments, usa o text", textoDoWhisper({ text: " Abre o quadro" }) === "Abre o quadro");

// a escuta: um volume a cada 80 ms, como no aparelho
const escutar = (trilha, inicio = 0) => {
  let estado = inicioDaEscuta(inicio);
  const acoes = [];
  let t = inicio;
  for (const [nivel, ms] of trilha) for (let fim = t + ms; t < fim; t += 80) {
    const r = passoDaEscuta(estado, nivel, t);
    estado = r.estado;
    if (r.acao) acoes.push({ acao: r.acao, t, inicio: estado.inicio, ultimaVoz: estado.ultimaVoz });
  }
  return acoes;
};
const fala = escutar([[0.01, 2000], [0.3, 1500], [0.01, VEZ.silencioMs + 200]]);
conferir("silêncio, 1,5 s de fala, silêncio: começou e terminou uma vez", fala.map((a) => a.acao).join() === "comecou,terminou", JSON.stringify(fala.map((a) => a.acao)));
conferir("termina depois do silêncio do fim, não antes", fala[1] && fala[1].t - fala[1].ultimaVoz >= VEZ.silencioMs && fala[1].t - fala[1].ultimaVoz < VEZ.silencioMs + 200);
conferir("a pausa curta no meio da frase não encerra a fala", escutar([[0.3, 800], [0.01, 500], [0.3, 800], [0.01, VEZ.silencioMs + 100]]).map((a) => a.acao).join() === "comecou,terminou");
conferir("um estalo (menos que a fala mínima) é descartado", escutar([[0.01, 500], [0.4, 100], [0.01, VEZ.silencioMs + 200]]).map((a) => a.acao).join() === "comecou,descartar");
conferir("ninguém fala: a gravação recomeça a cada espera", escutar([[0.01, VEZ.esperaMs * 2 + 200]]).filter((a) => a.acao === "recomecar").length === 2);
conferir("fala sem fim: enviada no limite (no aparelho a gravação para aí)", escutar([[0.3, VEZ.falaMaximaMs + 400]]).map((a) => a.acao).slice(0, 2).join() === "comecou,terminou");
conferir("um ruído constante do lugar vira o novo silêncio", escutar([[0.05, 6000], [0.08, 3000]]).length === 0 && escutar([[0.05, 6000], [0.4, 800], [0.05, VEZ.silencioMs + 200]]).map((a) => a.acao).join() === "comecou,terminou");

console.log("\na conversa e a transcrição no aparelho e no servidor (BEYOND-0011)");
const conversaCelular = ler("src/lib/conversaPorGravacao.js");
conferir("a Conversa livre do celular grava (MediaRecorder) e mede o volume do mesmo microfone, sem o reconhecimento do navegador",
  /new MediaRecorder\(stream/.test(conversaCelular) && /medirMicrofone\(stream\)/.test(conversaCelular) && !/SpeechRecognition/.test(conversaCelular));
conferir("fecha o microfone enquanto ela responde e reabre depois", /fecharMicrofoneDaConversa\(\);\s*\n\s*if \(!fechada/.test(conversaCelular) && /if \(!parado\) await ouvir\(\)/.test(conversaCelular));
conferir("corta o silêncio de antes da fala", /falaEmWav\(fechada\.blob, \{ desde \}\)/.test(conversaCelular) && /desde > 0 \? tudo\.subarray/.test(gravador));
conferir("a página usa a conversa por gravação no celular, antes do reconhecimento do navegador",
  /if \(isMobile\) \{[\s\S]{0,200}abrirConversaPorGravacao\(/.test(pagina) && pagina.indexOf("abrirConversaPorGravacao({") < pagina.indexOf("const SR = window.SpeechRecognition || window.webkitSpeechRecognition;\n    if (!SR) {\n      addLog(\"[CONVERSA]\""));
conferir("a espera pela fala dela tem teto e não confia num <audio> parado", /async function esperarAFalaAcabar/.test(pagina) && /Date\.now\(\) < ateMs/.test(pagina) && /!a\.paused && !a\.ended/.test(pagina)
  && !/while \(!parado && falandoAgora\(\)\) await esperar/.test(pagina));
conferir("o play() recusado solta o áudio (antes ficava preso e a conversa esperava para sempre)", /audio\.play\(\)\.catch\(\(err\) => \{[\s\S]{0,120}if \(audioRef\.current === audio\) audioRef\.current = null;/.test(pagina));
conferir("resposta vazia: a Lisa avisa em vez de ficar em \"processando\"", /if \(!answerRef\.current\.trim\(\) && !chegouErro\)/.test(pagina) && /if \(!falou\) send\(controller, "token", RESPOSTA_VAZIA\)/.test(ler("src/app/api/ask/route.js")));
conferir("o erro do servidor também vai para a bolha e para a fala", /chegouErro = true;[\s\S]{0,400}answerRef\.current = na;/.test(pagina));
conferir("a fala do reconhecimento do computador também corrige o nome", /const dito = corrigirNomeDaLisa\(/.test(pagina) && /const q = corrigirNomeDaLisa\(\(finalText/.test(pagina));
conferir("o microfone pede a transcrição como pedido, com teto", /comando: true/.test(gravador) && /TETO_DA_TRANSCRICAO_MS/.test(gravador));
const rotaDoTrecho = ler("src/app/api/notas/trecho/route.js");
const transcricao = ler("src/lib/transcricaoDaFala.js");
conferir("a rota manda o pedido para a transcrição rápida; o Tomar nota segue no Gemini", /if \(comando\) \{[\s\S]{0,120}transcreverPedido\(/.test(rotaDoTrecho) && /transcreverTrechoDeNota\(audio, \{\s*\n\s*tema:/.test(rotaDoTrecho));
conferir("Groq primeiro; falhou, Gemini; nos dois o nome sai certo", transcricao.indexOf("transcreverNaGroq(") < transcricao.indexOf("transcreverTrechoDeNota(") && (transcricao.match(/corrigirNomeDaLisa\(/g) || []).length === 2);

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
