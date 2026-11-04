import { organizarNotas } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { LIMITE_DE_SEGUNDOS } from "@/lib/tomarNota.js";
import {
  NOME_DO_QUADRO,
  donoDaSessao,
  gravarNotas,
  nomeDaColuna,
  transcricaoComTempo,
  trechosValidos,
} from "@/lib/notas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/notas/organizar   body: { sessao, tema?, iniciadaEm, duracaoSegundos, trechos: [{ indice, inicio, texto }] }
 * — fim do Modo Tomar nota: a Lisa lê a transcrição inteira, separa por assunto e grava no
 * quadro "Notas" do Abacato (coluna = tema, card = nota). Ver src/lib/notas.js. */
export async function POST(req) {
  try {
    const corpo = await req.json();
    const sessao = String(corpo.sessao || "");
    if (!/^[\w-]{8,64}$/.test(sessao)) return jsonResponse({ ok: false, error: "sessao inválida" }, 400);
    const trechos = trechosValidos(corpo.trechos);
    if (!trechos.length) return jsonResponse({ ok: false, error: "Não ouvi nenhuma fala nessa gravação — nada para anotar." }, 422);

    const dono = await donoDaSessao(req);
    if (!dono) return jsonResponse({ ok: false, error: "Sua conta da Lisa não tem um usuário com o mesmo e-mail no Abacato." }, 403);

    const duracaoSegundos = Math.max(1, Math.min(LIMITE_DE_SEGUNDOS + 30, Number(corpo.duracaoSegundos) || 0));
    const temaPedido = nomeDaColuna(corpo.tema);
    const organizado = await organizarNotas({
      tema: temaPedido,
      transcricao: transcricaoComTempo(trechos),
      duracaoMin: Math.max(1, Math.round(duracaoSegundos / 60)),
    });
    const tema = temaPedido || nomeDaColuna(organizado.tema) || "Notas soltas";
    // Sem nenhuma nota (o modelo achou tudo fora do tema) ainda sobra a transcrição: ela vira o card.
    const gravado = await gravarNotas({
      dono,
      sessao,
      tema,
      resumo: organizado.resumo,
      notas: organizado.notas,
      trechos,
      iniciadaEm: corpo.iniciadaEm,
      duracaoSegundos,
    });
    return jsonResponse({ ok: true, tema, resumo: organizado.resumo, quadroNome: NOME_DO_QUADRO, ...gravado });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
