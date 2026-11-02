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

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
