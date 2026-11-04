import { describeScreenIfNotable, SCREEN_WATCH_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";
import { logScreenObservation } from "@/lib/screenWatch.js";
import { ehUsuario } from "@/lib/papelNaSessao.js";
import { usarDoDia } from "@/lib/usoDoDia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/screen-comment   body: { image: {mimeType, data}, personaMode?, focus?, persist? }
 *
 * Modo Tela PROATIVO do Assistente (ver assistant/page.js): a pessoa não perguntou nada — o
 * cliente manda uma captura de tela periódica (intervalo escolhido no seletor do Assistente)
 * e esta rota decide se há algo digno de nota. `comment: null` é o caso comum (nada
 * relevante); só quando não-nulo o cliente mostra/fala alguma coisa.
 *
 * `focus` (opcional) — direcionamento livre digitado pela pessoa (ex.: "avise se o build
 * quebrar") — sobrescreve o critério padrão de "o que vale a pena notar" só pra ESTA vigília.
 *
 * `persist` (opcional) — toggle "Transmissão" ligado no cliente: quando `true` E sair um
 * comentário de verdade, salva em screen_observations (ver src/lib/screenWatch.js) pro Modo
 * Vigia poder responder depois sobre o que aconteceu. Nunca deixa a vigília falhar por causa
 * disso — logScreenObservation só loga erro, não lança.
 */
export async function POST(req) {
  try {
    const { image, personaMode = false, focus = null, persist = false } = await req.json();
    if (!image?.data || !image?.mimeType) {
      return jsonResponse({ ok: false, error: "image é obrigatório" }, 400);
    }
    // (01/11/2026, o MVP) o USUÁRIO tem o Modo Tela, mas sem a persona do admin, sem gravar no
    // histórico do Vigia (screen_observations é do admin) e com o limite do dia
    const usuario = ehUsuario(req);
    if (usuario) {
      const limite = await usarDoDia(req, "tela");
      if (limite) return jsonResponse({ ok: false, error: limite.erro, limite: true }, limite.status);
    }
    const focusBlock = focus?.trim()
      ? `\n\nDIRECIONAMENTO DADO PELO USUÁRIO — priorize isso acima do critério padrão acima (mas ainda pode notar algo MUITO óbvio fora disso, tipo um erro na tela): "${focus.trim()}"`
      : "";
    const instruction = withPersona(SCREEN_WATCH_INSTRUCTION + focusBlock, personaMode && !usuario);
    const comment = await describeScreenIfNotable(image, instruction);
    if (persist && comment && !usuario) await logScreenObservation(comment);
    return jsonResponse({ ok: true, comment });
  } catch (err) {
    // err.keyLabel (ver rewriteError em gemini.js) diz qual chave do pool falhou —
    // informação essencial pra diagnosticar erro de cota.
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
