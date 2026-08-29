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

/** Corta o áudio do Gemini que ESTE módulo tiver em reprodução (ou ainda esperando a rede) —
 * usado pelo stopSpeaking() do Assistente pra garantir que parar a fala pare TUDO, não só o
 * pedaço tocado pelo pipeline principal de TTS. */
export function stopBrowserVoiceAudio() {
  gen++;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
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

  if (!browserOnly) {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: clean, voice: voiceName }),
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
    }
  }

  if (myGen !== gen || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "pt-BR";
  u.rate = 1.05;
  const voice = pickBrowserVoice(window.speechSynthesis.getVoices());
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
