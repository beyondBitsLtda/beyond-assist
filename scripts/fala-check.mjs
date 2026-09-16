// Testa o corte do texto para a voz e o orçamento de tempo da síntese.
//
// Existe por causa de um defeito que era impossível de ver olhando o código: o teto de uma
// tentativa de TTS era fixo em 22 s, e o cliente mandava a resposta INTEIRA numa chamada só.
// Como o tempo de síntese acompanha a quantidade de áudio pedida, qualquer resposta acima de
// ~300 caracteres pedia mais de 22 s de áudio — e nenhuma tentativa podia dar certo. O
// sintoma no painel era "tempo esgotado" em três chaves seguidas, com todas as 35 marcadas
// como disponíveis: parecia problema de chave, e era de aritmética.

import { dividirParaFala, tetoDeSinteseMs, cleanForSpeech } from "../src/lib/cleanForSpeech.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

// Os dois números do outro lado da linha. Se algum mudar sem o outro, o teste abaixo reprova.
const SPEAK_TIMEOUT_MS = 75_000;  // src/app/(panels)/assistant/page.js
const TENTATIVAS = 2;             // synthesizeSpeech, em src/lib/gemini.js
const ESPERA_ENTRE_MS = 600;

const RESPOSTA_REAL =
  "Olá, Brayan. Eu sou a Lisa, sua assistente pessoal. Em que posso te ajudar hoje? " +
  "Se você veio em busca da sua rotina, vale lembrar que você tem quatro tarefas com prazo " +
  "para hoje, quarta-feira, 16 de setembro, incluindo mandar mensagem pro lead e elaborar a " +
  "proposta de arquitetura da SATILOG. É só me dizer o que prefere resolver primeiro.";

console.log("\n1) o corte não inventa nem perde texto");
{
  const pedacos = dividirParaFala(RESPOSTA_REAL);
  const juntos = pedacos.join(" ").replace(/\s+/g, " ").trim();
  const original = RESPOSTA_REAL.replace(/\s+/g, " ").trim();
  conferir("juntar os pedaços devolve o texto original", juntos === original,
           `\n     esperado: ${original.slice(0, 70)}…\n     veio:     ${juntos.slice(0, 70)}…`);
  conferir("gerou mais de um pedaço", pedacos.length > 1, `gerou ${pedacos.length}`);
  conferir("nenhum pedaço vazio", pedacos.every((p) => p.trim().length > 0));
}

console.log("\n2) texto curto continua numa chamada só");
{
  conferir("uma frase curta não é cortada", dividirParaFala("Bom dia, Brayan.").length === 1);
  conferir("texto vazio não vira pedaço nenhum", dividirParaFala("").length === 0);
  conferir("só espaços não vira pedaço nenhum", dividirParaFala("   \n  ").length === 0);
}

console.log("\n3) frase gigante sem pontuação também é cortada");
{
  // Lista ditada, que existe na prática e não traz um ponto final em lugar nenhum.
  const semPonto = Array.from({ length: 60 }, (_, i) => `item número ${i + 1}`).join(", ");
  const pedacos = dividirParaFala(semPonto);
  conferir("uma frase de " + semPonto.length + " caracteres não vira um pedaço só", pedacos.length > 1, `gerou ${pedacos.length}`);
  const maior = Math.max(...pedacos.map((p) => p.length));
  conferir("e nenhum pedaço passa muito do alvo", maior <= 180 * 1.7, `o maior tem ${maior}`);
}

console.log("\n4) o teto acompanha o tamanho, com piso e limite");
{
  conferir("texto curto recebe o piso", tetoDeSinteseMs("Oi.") === 22_000, `${tetoDeSinteseMs("Oi.")}`);
  const medio = tetoDeSinteseMs("x".repeat(180));
  conferir("180 caracteres pedem mais que o piso", medio > 22_000 && medio <= 35_000, `${medio}`);
  conferir("texto enorme para no limite", tetoDeSinteseMs("x".repeat(5000)) === 35_000);
  conferir("o teto cresce com o texto", tetoDeSinteseMs("x".repeat(300)) > tetoDeSinteseMs("x".repeat(100)));
}

console.log("\n5) o orçamento do servidor cabe na paciência do navegador");
{
  // Esta é a regra que já se quebrou uma vez: os dois números moram em arquivos diferentes e
  // só fazem sentido juntos. Se o servidor puder demorar mais que o navegador espera, o
  // navegador corta no meio de uma tentativa que talvez fosse dar certo.
  const piorCaso = TENTATIVAS * 35_000 + (TENTATIVAS - 1) * ESPERA_ENTRE_MS;
  conferir(`pior caso do servidor (${piorCaso / 1000}s) cabe nos ${SPEAK_TIMEOUT_MS / 1000}s do navegador`,
           piorCaso < SPEAK_TIMEOUT_MS, `sobram ${(SPEAK_TIMEOUT_MS - piorCaso) / 1000}s`);
}

console.log("\n6) o caso que quebrou: cada pedaço cabe no próprio teto");
{
  // ~14 caracteres de português falado = 1 segundo de áudio. O teto de um pedaço precisa ser
  // maior que o áudio que ele próprio pede — era exatamente isso que não acontecia.
  const problemas = dividirParaFala(RESPOSTA_REAL)
    .map((p) => ({ p, audioMs: (p.length / 14) * 1000, tetoMs: tetoDeSinteseMs(p) }))
    .filter(({ audioMs, tetoMs }) => tetoMs <= audioMs * 1.2);
  conferir("nenhum pedaço pede mais áudio do que o teto permite gerar", problemas.length === 0,
           problemas.map(({ p, audioMs, tetoMs }) => `${p.length}car pede ${Math.round(audioMs / 1000)}s com teto ${tetoMs / 1000}s`).join("; "));

  // E o contraste com o mundo de antes, para o teste contar a história:
  const antes = 22_000;
  const audioInteiro = (RESPOSTA_REAL.length / 14) * 1000;
  conferir("(referência) o texto inteiro no teto antigo era impossível", audioInteiro > antes,
           `${Math.round(audioInteiro / 1000)}s de áudio para um teto de ${antes / 1000}s`);
}

console.log("\n7) o corte roda depois da limpeza, sem sobra de markdown");
{
  const sujo = "**Olá!** Veja `isto`.\n\nE também aquilo.";
  const pedacos = dividirParaFala(cleanForSpeech(sujo));
  conferir("nenhum pedaço carrega asterisco ou crase", pedacos.every((p) => !/[*`]/.test(p)), pedacos.join(" | "));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
