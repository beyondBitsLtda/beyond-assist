// Guarda as duas decisões da voz que já custaram caro: o ORÇAMENTO de tempo (três números em
// arquivos diferentes que só fazem sentido juntos) e o CORTE do texto (que serve à voz do
// navegador e faz mal à do Gemini).
//
// A história, porque o código sozinho não conta e a intuição aponta para o lado errado:
//
// Presumi que o tempo de síntese acompanhasse a quantidade de áudio pedida — parecia óbvio —
// e por isso cortei a fala em pedaços e fiz o teto crescer com o texto. Dez chamadas reais
// medidas em 16/09/2026 desmentiram a premissa inteira:
//
//    76 caracteres  →  68s FALHA · 29s · 55s
//   152 caracteres  →  51s · 68s FALHA · 15s
//   304 caracteres  →  17s · 61s · 68s FALHA
//   449 caracteres  →  43s · 43s · 19s · 16s · 18s   (cinco de cinco, nenhuma falha)
//
// O texto menor levou 55s; o maior foi o único sem falha nenhuma. O que existe não é relação
// com o tamanho: é uma taxa alta de chamadas que penduram, e cada tentativa ou volta em
// ~16-20s ou estoura o teto. Cortar em três, então, TRIPLICA os sorteios contra essa taxa —
// e foi isso que fez o Modo Rádio cair para a voz do navegador o tempo todo.

import fs from "node:fs";
import { dividirParaFala, cleanForSpeech } from "../src/lib/cleanForSpeech.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

// Os números do orçamento, cada um no seu arquivo. Se algum mudar sozinho, o item 1 reprova.
const SPEAK_TIMEOUT_MS = 85_000;      // src/app/(panels)/assistant/page.js
const TETO_DE_REDE_MS = 85_000;       // src/lib/browserVoice.js
const TETO_POR_TENTATIVA_MS = 26_000; // TTS_TETO_POR_TENTATIVA_MS, src/lib/gemini.js
const TENTATIVAS = 3;                 // synthesizeSpeech, src/lib/gemini.js
const ESPERA_BASE_MS = 600;           // delayMs, que cresce: 600 na 1ª espera, 1200 na 2ª

const BLOCO_DE_RADIO =
  "Boa tarde, Brayan! Aqui é a Lisa, e você está ouvindo a sua rádio pessoal. " +
  "Antes da próxima música, três coisas rápidas do seu quadro: a proposta da SATILOG venceu " +
  "ontem e continua parada na coluna de execução, o card do lead do montador de móveis está " +
  "sem responsável desde segunda, e o Sentinela registrou dois chamados novos de prioridade " +
  "alta esta manhã. Nada disso é urgente agora, mas vale olhar antes do fim do dia. " +
  "Agora sim, vamos à música.";

const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

console.log("\n1) o orçamento do servidor cabe na paciência de quem espera");
{
  const esperas = Array.from({ length: TENTATIVAS - 1 }, (_, i) => ESPERA_BASE_MS * (i + 1)).reduce((a, b) => a + b, 0);
  const piorCaso = TENTATIVAS * TETO_POR_TENTATIVA_MS + esperas;
  console.log(`        (pior caso do servidor: ${piorCaso / 1000}s)`);
  conferir(`cabe nos ${SPEAK_TIMEOUT_MS / 1000}s do Assistente`, piorCaso < SPEAK_TIMEOUT_MS,
           `estoura em ${(piorCaso - SPEAK_TIMEOUT_MS) / 1000}s`);
  conferir(`cabe nos ${TETO_DE_REDE_MS / 1000}s do speakText`, piorCaso < TETO_DE_REDE_MS,
           `estoura em ${(piorCaso - TETO_DE_REDE_MS) / 1000}s`);
  // Cortar o servidor no meio de uma tentativa que talvez desse certo é o desperdício que
  // estes três números existem para evitar. Já aconteceu duas vezes, por descuido meu.
  const sobra = (SPEAK_TIMEOUT_MS - piorCaso) / 1000;
  conferir("sobra margem de rede, sem espera inútil", sobra >= 3 && sobra <= 20, `sobra ${sobra}s`);
}

console.log("\n2) os números do teste batem com os do código");
{
  // Sem isto o teste vira decoração: passaria feliz enquanto o código diz outra coisa.
  conferir("TTS_TETO_POR_TENTATIVA_MS", ler("src/lib/gemini.js").includes(`const TTS_TETO_POR_TENTATIVA_MS = ${TETO_POR_TENTATIVA_MS / 1000}_000;`));
  conferir("attempts: 3", ler("src/lib/gemini.js").includes(`{ attempts: ${TENTATIVAS}, delayMs: ${ESPERA_BASE_MS} }`));
  conferir("SPEAK_TIMEOUT_MS", ler("src/app/(panels)/assistant/page.js").includes(`const SPEAK_TIMEOUT_MS = ${SPEAK_TIMEOUT_MS};`));
  conferir("TETO_DE_REDE_MS", ler("src/lib/browserVoice.js").includes(`const TETO_DE_REDE_MS = ${TETO_DE_REDE_MS / 1000}_000;`));
}

console.log("\n3) o teto por tentativa cobre uma chamada boa, com folga");
{
  // A mais lenta das tentativas BEM-SUCEDIDAS observadas: os 42,7s totais foram um teto de 22s
  // estourado mais uma resposta de 20,7s. É esse 20,7 que o teto precisa cobrir.
  const MAIOR_BOA_MS = 20_700;
  conferir("o teto cobre a resposta boa mais lenta já medida", TETO_POR_TENTATIVA_MS > MAIOR_BOA_MS,
           `teto ${TETO_POR_TENTATIVA_MS / 1000}s contra ${MAIOR_BOA_MS / 1000}s`);
  const folga = (TETO_POR_TENTATIVA_MS - MAIOR_BOA_MS) / MAIOR_BOA_MS;
  conferir("com pelo menos 20% de folga", folga >= 0.2, `folga de ${Math.round(folga * 100)}%`);
}

console.log("\n4) três tentativas, e o porquê em números");
{
  // Se uma tentativa pendura com probabilidade p, a fala só cai para a voz do navegador
  // quando TODAS penduram. É a conta que deixei de fazer ao baixar para duas.
  const p = 0.48; // falha por tentativa medida em 16/09: 96 falhas em 201 chamadas de TTS
  const comDuas = p ** 2, comTres = p ** 3;
  conferir("três tentativas caem para o navegador menos da metade das vezes que duas",
           comTres < comDuas / 2, `duas: ${(comDuas * 100).toFixed(0)}% · três: ${(comTres * 100).toFixed(0)}%`);
}

console.log("\n5) o corte NÃO é usado no caminho do Gemini");
{
  // Este teste protege a conclusão da medição: voltar a cortar o texto antes de mandá-lo ao
  // Gemini triplica os sorteios contra uma API que pendura, e foi assim que o rádio quebrou.
  for (const arquivo of ["src/lib/browserVoice.js", "src/app/(panels)/assistant/page.js"]) {
    const texto = ler(arquivo);
    const marca = arquivo.includes("browserVoice") ? 'fetch("/api/speak"' : "enfileirarPedaco(bruto, gen)";
    const antes = texto.split(marca)[0];
    conferir(`${arquivo} manda o texto inteiro`, texto.includes(marca) && !antes.includes("dividirParaFala("),
             texto.includes(marca) ? "há um corte antes da chamada" : `não achei ${marca}`);
  }
  conferir("browserVoice corta só depois de o Gemini falhar",
           ler("src/lib/browserVoice.js").split("dividirParaFala(")[0].includes("cai pra voz do navegador"));
}

console.log("\n6) o corte serve à voz do navegador, que tem limite próprio");
{
  // O speechSynthesis do Chrome interrompe sozinho por volta de 15s de fala (~210 caracteres).
  const LIMITE_DO_CHROME = 210;
  // O mesmo alvo que browserVoice.js usa — este teste não vale nada se medir outro corte.
  const pedacos = dividirParaFala(BLOCO_DE_RADIO, 120);
  conferir("o alvo aqui é o mesmo do código", ler("src/lib/browserVoice.js").includes("dividirParaFala(clean, 120)"));
  conferir(`bloco de rádio (${BLOCO_DE_RADIO.length} car) vira ${pedacos.length} pedaços`, pedacos.length >= 2);
  const maior = Math.max(...pedacos.map((p) => p.length));
  conferir("nenhum pedaço passa do que o Chrome aguenta falar", maior <= LIMITE_DO_CHROME, `o maior tem ${maior}`);
  const junto = pedacos.join(" ").replace(/\s+/g, " ").trim();
  conferir("o texto sobrevive inteiro ao corte", junto === BLOCO_DE_RADIO.replace(/\s+/g, " ").trim());
}

console.log("\n7) o corte não quebra em casos de borda");
{
  conferir("uma frase curta não é cortada", dividirParaFala("Bom dia, Brayan.").length === 1);
  conferir("texto vazio não vira pedaço nenhum", dividirParaFala("").length === 0);
  conferir("só espaços não vira pedaço nenhum", dividirParaFala("   \n  ").length === 0);
  // Lista ditada: existe na prática e não traz um ponto final em lugar nenhum.
  const semPonto = Array.from({ length: 60 }, (_, i) => `item número ${i + 1}`).join(", ");
  const pedacos = dividirParaFala(semPonto);
  conferir(`frase de ${semPonto.length} caracteres sem ponto final também é cortada`, pedacos.length > 1);
  conferir("e nenhum pedaço fica absurdo", Math.max(...pedacos.map((p) => p.length)) <= 180 * 1.7);
  conferir("nenhum pedaço carrega markdown", dividirParaFala(cleanForSpeech("**Oi!** Veja `isto`.")).every((p) => !/[*`]/.test(p)));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
