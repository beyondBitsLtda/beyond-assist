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

/** Fala um texto pela voz do Gemini (via /api/speak); se falhar, cai pra voz do navegador. */
export async function speakText(text, { voiceName } = {}) {
  const clean = (text || "").trim();
  if (!clean || typeof window === "undefined") return;

  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: clean, voice: voiceName }),
    });
    if (!res.ok) throw new Error(`speak HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(resolve);
    });
    return;
  } catch {
    // cai pra voz do navegador
  }

  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "pt-BR";
  u.rate = 1.05;
  const voice = pickBrowserVoice(window.speechSynthesis.getVoices());
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
