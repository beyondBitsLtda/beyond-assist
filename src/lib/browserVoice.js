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

// Quanto esperar a rede por UM pedaço. Casa com a paciência do Assistente
// (SPEAK_TIMEOUT_MS) porque do outro lado é a mesma rota, com o mesmo orçamento de
// tentativas — ver tetoDeSinteseMs em cleanForSpeech.js.
const TETO_DE_REDE_MS = 75_000;

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

  // Um texto inteiro numa chamada só era o defeito que fazia o Modo Rádio cair pra voz do
  // navegador toda hora. O tempo de síntese acompanha a QUANTIDADE DE ÁUDIO pedida, e um
  // bloco de rádio tem 30-40 segundos de fala — muito além do que uma tentativa aguenta.
  // Cortado em pedaços, cada chamada volta a caber, e a fala ainda começa antes.
  //
  // Serve também à voz do navegador: o Chrome corta utterances longas por conta própria,
  // por volta de 15 segundos, e ninguém nunca soube por quê.
  const pedacos = dividirParaFala(clean);
  if (!pedacos.length) return;

  // Uma vez que um pedaço cai pra voz do navegador, os seguintes vão junto. Alternar o
  // timbre no meio de um bloco de rádio soa pior que usar a voz de reserva do começo ao fim.
  let motor = browserOnly ? "navegador" : "gemini";

  async function sintetizar(pedaco) {
    if (motor !== "gemini") return null;
    // Teto de rede por pedaço. Antes não havia nenhum: um pedido pendurado prendia a fala
    // para sempre, e o que disfarçava isso era uma corrida de 120s lá no Modo Rádio.
    const controlador = new AbortController();
    const relogio = setTimeout(() => controlador.abort(), TETO_DE_REDE_MS);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: pedaco, voice: voiceName }),
        signal: controlador.signal,
      });
      if (!res.ok) throw new Error(`speak HTTP ${res.status}`);
      return await res.blob();
    } catch {
      motor = "navegador";
      return null;
    } finally {
      clearTimeout(relogio);
    }
  }

  async function tocarDoGemini(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    await new Promise((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
      audio.play().catch(resolve);
    });
  }

  async function tocarDoNavegador(pedaco) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(pedaco);
    u.lang = "pt-BR";
    u.rate = 1.05;
    const voice = pickBrowserVoice(window.speechSynthesis.getVoices());
    if (voice) u.voice = voice;
    // Espera terminar de falar antes de resolver. Quem chama pode precisar saber QUANDO a
    // fala acabou de verdade (o Modo Escuta abre uma janela de resposta logo depois).
    await new Promise((resolve) => {
      u.onend = resolve;
      u.onerror = resolve;
      window.speechSynthesis.speak(u);
    });
  }

  // Sintetiza o PRÓXIMO enquanto o atual toca. Sem isso, cortar em pedaços trocaria uma
  // espera longa por vários silêncios no meio da fala — pior do que estava.
  let emVoo = sintetizar(pedacos[0]);
  for (let i = 0; i < pedacos.length; i++) {
    const blob = await emVoo;
    if (myGen !== gen) return; // uma fala mais nova assumiu enquanto esperávamos
    emVoo = i + 1 < pedacos.length ? sintetizar(pedacos[i + 1]) : Promise.resolve(null);
    if (blob) await tocarDoGemini(blob);
    else await tocarDoNavegador(pedacos[i]);
    if (myGen !== gen) return;
  }
}
