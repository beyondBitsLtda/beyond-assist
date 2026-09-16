import { dividirParaFala } from "./cleanForSpeech.js";

// A Web Speech API do navegador NÃO expõe gênero da voz (SpeechSynthesisVoice só tem
// name/lang/etc.) — só dá pra tentar adivinhar pelo NOME, que varia por navegador/SO/idioma
// instalado. Isso é uma aproximação, não uma garantia; nomes fora dessas listas caem no
// fallback (evita masculina conhecida, mas não confirma feminina). Compartilhado entre o
// Assistente (voz de reserva) e os avisos dentro do app (mesma voz).
const FEMALE_VOICE_HINTS = /maria|francisca|luciana|camila|vit[óo]ria|brenda|elza|giovanna|hel[oó]isa|isabela|helena|raquel|joana|let[íi]cia|carla|fernanda|patr[íi]cia|female|feminin/i;
const MALE_VOICE_HINTS = /daniel|ant[oô]nio|f[aá]bio|humberto|ricardo|felipe|thiago|marcos(?!\s*i)|paulo|jorge|male(?!f)|masculin/i;

/** Escolhe a melhor voz pt-BR disponível no navegador, tentando priorizar uma feminina pelo nome. */
export function pickBrowserVoice(voices) {
  const ptBr = voices.filter((v) => /pt-BR/i.test(v.lang));
  const pt = ptBr.length ? ptBr : voices.filter((v) => /pt/i.test(v.lang));
  if (!pt.length) return null;
  return (
    pt.find((v) => FEMALE_VOICE_HINTS.test(v.name) && !MALE_VOICE_HINTS.test(v.name)) ||
    pt.find((v) => !MALE_VOICE_HINTS.test(v.name)) ||
    pt[0]
  );
}

// Áudio do Gemini (via /api/speak) tocado por ESTE módulo — rastreado aqui porque quem chama
// speakText (vigília do Modo Tela, saudação do gesto de acordar) não guarda referência nenhuma
// pro <audio> criado, então nada conseguia cortá-lo depois. `gen` é um contador de geração: cada
// chamada de speakText pega o número mais recente ANTES de esperar a rede (/api/speak), e só toca
// o áudio se ninguém mais novo tiver assumido nesse meio-tempo — sem isso, dava pra um
// stopBrowserVoiceAudio() cortar o áudio JÁ tocando e mesmo assim, alguns instantes depois, o
// fetch antigo (que já estava em voo) terminar e tocar por cima da fala nova mesmo assim.
let currentAudio = null;
let gen = 0;

// Quanto esperar a rede por uma fala. Casa com a paciência do Assistente (SPEAK_TIMEOUT_MS):
// do outro lado é a mesma rota, com o mesmo orçamento de 3 tentativas de 26s.
const TETO_DE_REDE_MS = 85_000;

/** Corta o áudio do Gemini que ESTE módulo tiver em reprodução (ou ainda esperando a rede) —
 * usado pelo stopSpeaking() do Assistente pra garantir que parar a fala pare TUDO, não só o
 * pedaço tocado pelo pipeline principal de TTS. */
export function stopBrowserVoiceAudio() {
  gen++;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  // Também a voz do navegador. Antes de a fala ser cortada em pedaços isso quase não
  // aparecia: ou o Gemini tinha dado certo (e então só havia <audio> para pausar), ou a
  // fala inteira era do navegador e quem chamava já cancelava por fora. Agora um bloco pode
  // ser metade Gemini e metade navegador, e parar só metade dele seria estranho.
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

export function isBrowserVoiceAudioPlaying() {
  return !!currentAudio;
}

/**
 * Fala um texto em voz alta. `browserOnly: true` pula o Gemini de propósito — usado pelos
 * avisos dentro do app (ver NotificationToasts.js), que não precisam da voz "premium" e
 * MULTIPLICAM chamadas ao Gemini se você tiver mais de uma aba/dispositivo aberto ao mesmo
 * tempo (cada um fala cada aviso por conta própria) — competindo por cota com o Assistente,
 * que é quem realmente precisa da voz do Gemini. Sem esse parâmetro, cai pra voz do Gemini
 * (via /api/speak) com fallback pro navegador se falhar — é o que o Assistente usa.
 *
 * Sempre corta qualquer fala ANTERIOR deste módulo antes de começar a nova (nunca duas chamadas
 * de speakText tocando ao mesmo tempo) — foi assim que a vigília do Modo Tela e a saudação do
 * gesto de acordar chegaram a se sobrepor.
 */
export async function speakText(text, { voiceName, browserOnly = false } = {}) {
  const clean = (text || "").trim();
  if (!clean || typeof window === "undefined") return;

  const myGen = ++gen;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.speechSynthesis?.cancel();

  // O texto vai INTEIRO para o Gemini, numa chamada só.
  //
  // Eu cheguei a cortá-lo em pedaços aqui, achando que textos longos estouravam o tempo. A
  // medição mostrou o contrário (ver dividirParaFala em cleanForSpeech.js): o bloco de 449
  // caracteres foi o único que não falhou nenhuma vez em cinco. E cortar tem um custo que a
  // intuição esconde — cada pedaço é um sorteio novo contra uma API que pendura com
  // frequência, então três pedaços caem para a voz do navegador MUITO mais vezes que um.
  if (!browserOnly) {
    const controlador = new AbortController();
    // Teto de rede. Antes não havia nenhum: um pedido pendurado prendia a fala para sempre, e
    // o que disfarçava isso era uma corrida de 120s escrita lá no Modo Rádio.
    const relogio = setTimeout(() => controlador.abort(), TETO_DE_REDE_MS);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: clean, voice: voiceName }),
        signal: controlador.signal,
      });
      if (!res.ok) throw new Error(`speak HTTP ${res.status}`);
      const blob = await res.blob();
      if (myGen !== gen) return; // uma fala mais nova assumiu enquanto esperávamos a rede
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
        audio.play().catch(resolve);
      });
      return;
    } catch {
      // cai pra voz do navegador
    } finally {
      clearTimeout(relogio);
    }
  }

  if (myGen !== gen || !window.speechSynthesis) return;

  // AQUI sim o corte é necessário: o speechSynthesis do Chrome interrompe sozinho uma fala
  // longa, por volta de 15 segundos, sem avisar. Um bloco de rádio inteiro era cortado no
  // meio — e como isso só acontece na voz de reserva, passava por "a voz ruim falhou de novo".
  const voice = pickBrowserVoice(window.speechSynthesis.getVoices());
  // Alvo de 120, e não o padrão: o corte respeita fim de frase, então uma frase sozinha
  // pode passar do alvo em até 60%. Com 120 o pior caso fica em ~192 caracteres, abaixo
  // dos ~210 que o Chrome fala antes de interromper por conta própria.
  for (const pedaco of dividirParaFala(clean, 120)) {
    if (myGen !== gen) return;
    const u = new SpeechSynthesisUtterance(pedaco);
    u.lang = "pt-BR";
    u.rate = 1.05;
    if (voice) u.voice = voice;
    // Espera terminar de falar antes de seguir. Quem chama pode precisar saber QUANDO a fala
    // acabou de verdade (o Modo Escuta abre uma janela de resposta logo depois).
    await new Promise((resolve) => {
      u.onend = resolve;
      u.onerror = resolve;
      window.speechSynthesis.speak(u);
    });
  }
}
