import { desenharDiagrama, desenharMapaMental } from "@/lib/gemini.js";
import {
  validarDesenho, montarDocumento, estruturaDoDocumento, documentoValido,
  pedeMapaMental, validarMapaMental, montarMapaMental, estruturaDoMapa, descreverDiagrama,
} from "@/lib/diagramaDaLisa.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/diagrama (31/10/2026, BEYOND-0010) — a Lisa desenha um processo no quadro.
 *   { pedido, atual?, conversa?, contexto? }
 *   `contexto`: o código dos repositórios vinculados à conversa (lido antes, por /api/repos/contexto).
 *   `projeto`: os outros desenhos do projeto do ProcessMap citado na conversa, em texto (a Lisa mantém
 *   os mesmos nomes, áreas e termos — src/lib/processmapNaConversa.js).
 *   `atual`: o documento que está na tela (o JSON do quadro), quando o pedido é MUDAR o desenho — a
 *   Lisa parte dele, mantém os ids do que continua, e o que a pessoa arrumou fica no lugar.
 * Devolve { doc, titulo, colecao, explicacao }: o documento pronto para o quadro abrir.
 *
 * Mapa mental (01/11/2026): o pedido que fala em mapa mental — ou um pedido de mudança com um mapa
 * mental na tela — sai como mapa mental (modo "mindmap" do quadro, sem coleção).
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que desenhar" }, 400);
    const atual = body?.atual ? documentoValido(body.atual) : null;
    if (body?.atual && !atual) return jsonResponse({ ok: false, error: "o desenho da tela veio grande demais ou estragado" }, 400);
    const conversa = String(body?.conversa || "");
    const contexto = String(body?.contexto || "");
    const projeto = String(body?.projeto || "").slice(0, 30_000);
    const mapaNaTela = atual?.mode === "mindmap";
    if (pedeMapaMental(pedido) || (mapaNaTela && !/\b(fluxograma|diagrama|bpmn|processo)\b/i.test(pedido))) {
      // um fluxograma na tela vira base ("transforme em mapa mental"); um mapa na tela é mudado
      const daTela = atual && !mapaNaTela ? `O DESENHO QUE ESTÁ NA TELA (um fluxograma):\n${descreverDiagrama(atual)}` : "";
      const bruto = await desenharMapaMental({
        pedido, estrutura: mapaNaTela ? estruturaDoMapa(atual) : null, conversa, contexto: [contexto, daTela].filter(Boolean).join("\n\n"), projeto,
      });
      const mapa = validarMapaMental(bruto);
      if (!mapa.topicos.length) throw new Error("a Lisa não montou nenhum tópico — tente pedir de outro jeito");
      return jsonResponse({ ok: true, doc: montarMapaMental(mapa, mapaNaTela ? atual : null), titulo: mapa.titulo, colecao: null, explicacao: mapa.explicacao });
    }
    // (um mapa mental na tela não é base para um fluxograma: as abas dele não têm o que manter)
    const base = mapaNaTela ? null : atual;
    const estrutura = base ? estruturaDoDocumento(base) : null;
    const bruto = await desenharDiagrama({ pedido, estrutura, conversa, contexto, projeto });
    const desenho = validarDesenho(bruto);
    return jsonResponse({ ok: true, doc: montarDocumento(desenho, base), titulo: desenho.titulo, colecao: desenho.colecao, explicacao: desenho.explicacao });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
