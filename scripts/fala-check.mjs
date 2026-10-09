// Guarda as decisões da voz que já custaram caro: o ORÇAMENTO de tempo (números em arquivos
// diferentes que só fazem sentido juntos) e o CORTE do texto em pedaços.
//
// A história, porque a decisão já virou duas vezes e a intuição aponta ora para um lado, ora
// para o outro:
//
// 16/09/2026 — dez chamadas ao modelo antigo (gemini-2.5-flash-preview-tts) pareceram mostrar
// que o tamanho não importava (76 caracteres em 55s, 449 em 16s). Conclusão da época: não cortar
// o texto do Gemini, porque cada pedaço seria um sorteio novo contra uma API que pendura.
//
// 07/10/2026 — issue BEYOND-0001 ("a voz cai para a do navegador, sobretudo em mensagens
// longas"). Nove chamadas por modelo, três tamanhos (síntese / segundos de áudio):
//
//   gemini-2.5-flash-preview-tts   ~120c 43s·12s·6s   ~250c 10s·13s·ERRO   ~520c 15s·PENDUROU·PENDUROU
//   gemini-3.8-flash-tts           ~120c 22s·5s·5s    ~250c 10s·9s·9s      ~520c 16s·17s·14s
//   gemini-3.1-flash-tts-preview   ~120c 18s·8s·8s    ~250c 12s·13s·15s    ~520c 23s·23s·43s
//
// O modelo antigo pendurava ao acaso — e isso escondia que, por baixo, o tempo cresce com o
// texto. Com o 3.8 (que não falhou nenhuma vez) o que derrubava a voz era o tamanho: a resposta
// inteira numa chamada só passava do teto. Agora: modelo novo com reservas, teto proporcional e
// a fala em pedaços, cada um gerado enquanto o anterior toca.

import fs from "node:fs";
import { dividirParaFala, cleanForSpeech, pedacosParaVoz, ALVO_DO_PRIMEIRO_PEDACO, ALVO_DOS_PEDACOS } from "../src/lib/cleanForSpeech.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// Os números do orçamento, cada um no seu arquivo. O item 2 reprova se algum mudar sozinho.
const SPEAK_TIMEOUT_MS = 70_000;  // src/app/(panels)/assistant/page.js
const TETO_DE_REDE_MS = 70_000;   // src/lib/browserVoice.js
const TENTATIVAS = 3;             // TTS_TENTATIVAS, src/lib/gemini.js
const TETO = { base: 18_000, porCaractere: 60, minimo: 25_000, maximo: 50_000 };   // TTS_TETO_*, gemini.js
const HEDGE = { base: 4_000, porCaractere: 15, minimo: 6_000, maximo: 12_000 };    // TTS_HEDGE_*, gemini.js
const tetoPara = (c) => Math.min(TETO.maximo, Math.max(TETO.minimo, TETO.base + c * TETO.porCaractere));
const hedgePara = (c) => Math.min(HEDGE.maximo, Math.max(HEDGE.minimo, HEDGE.base + c * HEDGE.porCaractere));

// O maior pedaço possível: uma frase sozinha passa do alvo em até 60% (ver dividirParaFala).
const MAIOR_PEDACO = Math.ceil(ALVO_DOS_PEDACOS * 1.6);

const RESPOSTA_LONGA =
  "Claro! Vamos por partes. Primeiro, a trilha de JavaScript desta semana tem três assuntos: laços de " +
  "repetição, funções e arrays. Nos laços, o foco é entender a diferença entre for, while e for of, e " +
  "quando cada um faz mais sentido. Nas funções, vale revisar parâmetros, retorno e escopo, porque isso " +
  "aparece em tudo que vem depois. Já nos arrays, os métodos map, filter e reduce são os que mais aparecem " +
  "no dia a dia. Se você fizer um assunto por dia, termina a semana com folga e ainda sobra tempo para o " +
  "projeto, que é uma calculadora de notas. Ah, e lembra que a sua ofensiva está em seis dias.";

console.log("\n1) o orçamento do servidor cabe na paciência de quem espera — para o PIOR pedaço");
{
  // As tentativas se sobrepõem: a segunda começa um hedge depois da primeira, a terceira dois.
  // O pior caso é o instante em que a última começa, mais o teto dela.
  const piorCaso = (TENTATIVAS - 1) * hedgePara(MAIOR_PEDACO) + tetoPara(MAIOR_PEDACO);
  console.log(`        (maior pedaço possível: ${MAIOR_PEDACO} caracteres · pior caso do servidor: ${(piorCaso / 1000).toFixed(1)}s)`);
  conferir(`cabe nos ${SPEAK_TIMEOUT_MS / 1000}s do Assistente`, piorCaso < SPEAK_TIMEOUT_MS, `estoura em ${(piorCaso - SPEAK_TIMEOUT_MS) / 1000}s`);
  conferir(`cabe nos ${TETO_DE_REDE_MS / 1000}s do speakText`, piorCaso < TETO_DE_REDE_MS, `estoura em ${(piorCaso - TETO_DE_REDE_MS) / 1000}s`);
  const sobra = (SPEAK_TIMEOUT_MS - piorCaso) / 1000;
  conferir("sobra margem de rede, sem espera inútil", sobra >= 3 && sobra <= 25, `sobra ${sobra.toFixed(1)}s`);
}

console.log("\n2) os números do teste batem com os do código");
{
  const gemini = ler("src/lib/gemini.js");
  conferir("TTS_TENTATIVAS", gemini.includes(`const TTS_TENTATIVAS = ${TENTATIVAS};`));
  conferir("TTS_TETO_BASE_MS", gemini.includes(`const TTS_TETO_BASE_MS = ${TETO.base / 1000}_000;`));
  conferir("TTS_TETO_POR_CARACTERE_MS", gemini.includes(`const TTS_TETO_POR_CARACTERE_MS = ${TETO.porCaractere};`));
  conferir("TTS_TETO_MINIMO_MS", gemini.includes(`const TTS_TETO_MINIMO_MS = ${TETO.minimo / 1000}_000;`));
  conferir("TTS_TETO_MAXIMO_MS", gemini.includes(`const TTS_TETO_MAXIMO_MS = ${TETO.maximo / 1000}_000;`));
  conferir("TTS_HEDGE_BASE_MS", gemini.includes(`const TTS_HEDGE_BASE_MS = ${HEDGE.base / 1000}_000;`));
  conferir("TTS_HEDGE_POR_CARACTERE_MS", gemini.includes(`const TTS_HEDGE_POR_CARACTERE_MS = ${HEDGE.porCaractere};`));
  conferir("TTS_HEDGE_MINIMO_MS", gemini.includes(`const TTS_HEDGE_MINIMO_MS = ${HEDGE.minimo / 1000}_000;`));
  conferir("TTS_HEDGE_MAXIMO_MS", gemini.includes(`const TTS_HEDGE_MAXIMO_MS = ${HEDGE.maximo / 1000}_000;`));
  conferir("SPEAK_TIMEOUT_MS", ler("src/app/(panels)/assistant/page.js").includes(`const SPEAK_TIMEOUT_MS = ${SPEAK_TIMEOUT_MS};`));
  conferir("TETO_DE_REDE_MS", ler("src/lib/browserVoice.js").includes(`const TETO_DE_REDE_MS = ${TETO_DE_REDE_MS / 1000}_000;`));
  conferir("o modelo principal é o 3.8, que não falhou na medição", gemini.includes('process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts"'));
  conferir("as tentativas alternam de modelo", gemini.includes("TTS_MODELOS[numero++ % TTS_MODELOS.length]"));
}

console.log("\n3) o teto cobre as respostas boas medidas, com folga");
{
  // As mais lentas BOAS do modelo principal em 07/10, por tamanho.
  for (const [caracteres, maisLentaMs] of [[250, 10_000], [520, 17_000]]) {
    const folga = (tetoPara(caracteres) - maisLentaMs) / maisLentaMs;
    conferir(`${caracteres} caracteres: teto ${(tetoPara(caracteres) / 1000).toFixed(1)}s contra ${maisLentaMs / 1000}s medidos (folga ≥ 30%)`,
             folga >= 0.3, `folga de ${Math.round(folga * 100)}%`);
  }
  // A reserva é mais lenta e tem picos: no 3.1, um pedaço de ~185 caracteres levou 27s e 29s
  // ao meio-dia de 07/10. O teto não pode cortar essa resposta BOA.
  conferir("o teto de um pedaço típico (185c) cobre o pico medido da reserva (29s)", tetoPara(185) > 29_000,
           `teto de ${(tetoPara(185) / 1000).toFixed(1)}s`);
  // O ponto fora da curva (22s numa frase de 121 caracteres) não é para o teto cobrir: é para o
  // hedge, que já pôs uma segunda tentativa, em outro modelo, rodando muito antes disso.
  conferir("o hedge de uma frase curta dispara bem antes do ponto fora da curva (22s)", hedgePara(121) < 22_000 / 2,
           `hedge de ${(hedgePara(121) / 1000).toFixed(1)}s`);
}

console.log("\n4) a fala em pedaços: começa rápido, não esvazia e não perde texto");
{
  const pedacos = pedacosParaVoz(RESPOSTA_LONGA);
  console.log(`        (resposta de ${RESPOSTA_LONGA.length} caracteres → ${pedacos.map((p) => p.length).join(" + ")})`);
  conferir("resposta longa vira mais de um pedaço", pedacos.length > 1);
  conferir(`o primeiro é curto, para começar a falar logo (≤ ${Math.round(ALVO_DO_PRIMEIRO_PEDACO * 1.3)})`,
           pedacos[0].length <= ALVO_DO_PRIMEIRO_PEDACO * 1.3, `tem ${pedacos[0].length}`);
  conferir(`nenhum passa do maior pedaço previsto no orçamento (${MAIOR_PEDACO})`, Math.max(...pedacos.map((p) => p.length)) <= MAIOR_PEDACO);
  const junto = pedacos.join(" ").replace(/\s+/g, " ").trim();
  conferir("o texto sobrevive inteiro ao corte", junto === RESPOSTA_LONGA.replace(/\s+/g, " ").trim());
  conferir("uma frase curta continua inteira, numa chamada só", pedacosParaVoz("Oi, Brayan! Tudo certo por aqui.").length === 1);

  // A fila não esvazia se gerar um pedaço leva menos que tocar o anterior. Medido no 3.8 em
  // 07/10: ~14,6 caracteres por segundo de áudio, e síntese ≈ 0,4 × áudio + 2s.
  const audioS = (c) => c / 14.6;
  const sinteseS = (c) => 0.4 * audioS(c) + 2;
  conferir("um pedaço típico é gerado antes de o anterior acabar de tocar",
           sinteseS(ALVO_DOS_PEDACOS) < audioS(ALVO_DO_PRIMEIRO_PEDACO) + 2,
           `gerar ${ALVO_DOS_PEDACOS}c: ${sinteseS(ALVO_DOS_PEDACOS).toFixed(1)}s · tocar ${ALVO_DO_PRIMEIRO_PEDACO}c: ${audioS(ALVO_DO_PRIMEIRO_PEDACO).toFixed(1)}s`);
}

console.log("\n5) os dois caminhos de voz mandam pedaços ao Gemini, não a resposta inteira");
{
  conferir("Assistente: enqueueSpeech corta com pedacosParaVoz",
           ler("src/app/(panels)/assistant/page.js").includes("for (const pedaco of pedacosParaVoz(cleanForSpeech(bruto))) enfileirarPedaco(pedaco, gen);"));
  const voz = ler("src/lib/browserVoice.js");
  conferir("speakText: corta com pedacosParaVoz antes do /api/speak",
           voz.includes("pedacosParaVoz(clean)") && voz.indexOf("pedacosParaVoz(clean)") < voz.indexOf('fetch("/api/speak"'));
  conferir("speakText: gera todos os pedaços em paralelo e toca em ordem", voz.includes("const sinteses = pedacos.map((p) => sintetizar(p));"));
  conferir("Assistente: gera cada pedaço já ao enfileirar (síntese antecipada)",
           ler("src/app/(panels)/assistant/page.js").includes("const antecipada = podeTentarAgora ? synthesizeChunk(clean) : null;"));
}

console.log("\n6) o corte da voz de reserva serve ao limite do navegador");
{
  // O speechSynthesis do Chrome interrompe sozinho por volta de 15s de fala (~210 caracteres).
  const LIMITE_DO_CHROME = 210;
  const pedacos = dividirParaFala(RESPOSTA_LONGA, 120);
  conferir("o alvo aqui é o mesmo do código", ler("src/lib/browserVoice.js").includes("dividirParaFala(restante, 120)"));
  const maior = Math.max(...pedacos.map((p) => p.length));
  conferir("nenhum pedaço passa do que o Chrome aguenta falar", maior <= LIMITE_DO_CHROME, `o maior tem ${maior}`);
}

console.log("\n7) o corte não quebra em casos de borda");
{
  conferir("uma frase curta não é cortada", dividirParaFala("Bom dia, Brayan.").length === 1);
  conferir("texto vazio não vira pedaço nenhum", dividirParaFala("").length === 0 && pedacosParaVoz("").length === 0);
  conferir("só espaços não vira pedaço nenhum", dividirParaFala("   \n  ").length === 0);
  // Lista ditada: existe na prática e não traz um ponto final em lugar nenhum.
  const semPonto = Array.from({ length: 60 }, (_, i) => `item número ${i + 1}`).join(", ");
  const pedacos = pedacosParaVoz(semPonto);
  conferir(`frase de ${semPonto.length} caracteres sem ponto final também é cortada`, pedacos.length > 1);
  conferir("e nenhum pedaço passa do orçamento", Math.max(...pedacos.map((p) => p.length)) <= MAIOR_PEDACO);
  conferir("nenhum pedaço carrega markdown", pedacosParaVoz(cleanForSpeech("**Oi!** Veja `isto`.")).every((p) => !/[*`]/.test(p)));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
