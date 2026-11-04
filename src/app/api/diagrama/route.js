import { desenharDiagrama, desenharMapaMental } from "@/lib/gemini.js";
import {
  validarDesenho, montarDocumento, estruturaDoDocumento, documentoValido,
  vaiSerMapaMental, validarMapaMental, montarMapaMental, estruturaDoMapa, descreverDiagrama,
  semPerdas, PEDE_PARA_TIRAR, tipoPedido, tipoDaTransformacao, idDoTipo, naFamilia, itensDoPedido, oQueFaltou,
} from "@/lib/diagramaDaLisa.js";
import { imagensValidas } from "@/lib/contextoDaConversa.js";
import { jsonResponse } from "@/lib/http.js";
import { usarDoDia } from "@/lib/usoDoDia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/diagrama (31/10/2026, BEYOND-0010) — a Lisa desenha um processo no quadro.
 *   { pedido, atual?, conversa?, contexto?, projeto?, tipo?, original?, imagens? }
 *   `contexto`: o código dos repositórios vinculados à conversa (lido antes, por /api/repos/contexto).
 *   `projeto`: os outros desenhos do projeto do ProcessMap citado na conversa, em texto (a Lisa mantém
 *   os mesmos nomes, áreas e termos — src/lib/processmapNaConversa.js).
 *   `atual`: o documento que está na tela (o JSON do quadro), quando o pedido é MUDAR o desenho — a
 *   Lisa parte dele, mantém os ids do que continua, e o que a pessoa arrumou fica no lugar.
 *   `tipo`: o tipo do desenho novo que o plano do projeto escolheu (TIPOS_NO_PLANO); `original`: o
 *   pedido nas palavras da pessoa, quando `pedido` é a instrução que o plano escreveu; `imagens`: a
 *   tela e os prints anexados (o conteúdo pedido pode estar neles).
 * Devolve { doc, titulo, colecao, explicacao, faltando }: o documento pronto para o quadro abrir, e os
 * itens pedidos que nem a segunda tentativa pôs no desenho.
 *
 * Mapa mental (01/11/2026): o pedido que fala em mapa mental — ou um pedido de mudança com um mapa
 * mental na tela — sai como mapa mental (modo "mindmap" do quadro, sem coleção).
 *
 * O tipo e o conteúdo (02/11/2026: "ela não respeita criar o fluxograma do tipo que eu pedir com o
 * conteúdo que eu pedir"): o tipo dito vale num desenho novo e num "transforme em…" — as formas de
 * outra família viram as equivalentes (naFamilia); e a lista que a pessoa deu é conferida no desenho
 * pronto: o que faltou volta para o modelo uma vez (oQueFaltou).
 */
export async function POST(req) {
  try {
    // (01/11/2026, o MVP) o usuário tem o limite do dia — as chaves de IA são do admin
    const limite = await usarDoDia(req, "desenho");
    if (limite) return jsonResponse({ ok: false, error: limite.erro, limite: true }, limite.status);
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que desenhar" }, 400);
    const atual = body?.atual ? documentoValido(body.atual) : null;
    if (body?.atual && !atual) return jsonResponse({ ok: false, error: "o desenho da tela veio grande demais ou estragado" }, 400);
    const conversa = String(body?.conversa || "");
    const contexto = String(body?.contexto || "");
    const projeto = String(body?.projeto || "").slice(0, 30_000);
    const original = String(body?.original || "").slice(0, 8000);
    const imagens = imagensValidas(body?.imagens).filter((i) => i.origem !== "camera").slice(0, 6);
    const mapaNaTela = atual?.mode === "mindmap";
    // o tipo: o do plano, senão o que o pedido diz; numa mudança, só um "transforme em…" troca o tipo
    const transforma = Boolean(tipoDaTransformacao(pedido));
    const dito = idDoTipo(body?.tipo) || tipoPedido(pedido);
    const tipo = atual && !transforma ? null : dito;
    const itens = itensDoPedido(pedido);

    if (tipo ? tipo === "mapa" : vaiSerMapaMental(pedido, atual)) {
      // um fluxograma na tela vira base ("transforme em mapa mental"); um mapa na tela é mudado
      const daTela = atual && !mapaNaTela ? `O DESENHO QUE ESTÁ NA TELA (um fluxograma):\n${descreverDiagrama(atual)}` : "";
      // a trava contra perda: sem pedido de tirar nada, tópico que existia não some
      const manterTudo = mapaNaTela && !PEDE_PARA_TIRAR.test(pedido);
      const desenhar = async (faltou = []) => {
        const mapa = validarMapaMental(await desenharMapaMental({
          pedido, estrutura: mapaNaTela ? estruturaDoMapa(atual) : null, conversa, contexto: [contexto, daTela].filter(Boolean).join("\n\n"), projeto,
          imagens, original, faltou,
        }));
        if (!mapa.topicos.length) throw new Error("a Lisa não montou nenhum tópico — tente pedir de outro jeito");
        const doc = montarMapaMental(mapa, mapaNaTela ? atual : null, { manterTudo });
        return { doc, titulo: mapa.titulo, colecao: null, explicacao: mapa.explicacao, ...oQueFaltou(doc, { itens }) };
      };
      const r = await comSegundaVolta(desenhar);
      return jsonResponse({ ok: true, doc: r.doc, titulo: r.titulo, colecao: null, explicacao: r.explicacao, faltando: r.faltando });
    }

    // (um mapa mental na tela não é base para um fluxograma: as abas dele não têm o que manter — mas o
    // conteúdo dele vai junto, para "transforme esse mapa em fluxograma" ter o que transformar)
    const base = mapaNaTela ? null : atual;
    const estrutura = base ? estruturaDoDocumento(base) : null;
    const doMapa = mapaNaTela ? `O MAPA MENTAL QUE ESTÁ NA TELA (o pedido parte dele):\n${descreverDiagrama(atual)}` : "";
    const desenhar = async (faltou = []) => {
      const bruto = await desenharDiagrama({
        pedido, estrutura, conversa, contexto: [contexto, doMapa].filter(Boolean).join("\n\n"), projeto,
        tipo, imagens, original, faltou,
      });
      // a trava contra perda: sem pedido de tirar nada, o que o modelo esqueceu volta para o lugar
      const { desenho, devolvidas } = semPerdas(validarDesenho(bruto), base, pedido);
      // o tipo pedido é regra: o que veio de outra família vira a forma equivalente da família pedida
      if (tipo) naFamilia(desenho, tipo);
      const doc = montarDocumento(desenho, base);
      return { doc, titulo: desenho.titulo, colecao: desenho.colecao, explicacao: desenho.explicacao, devolvidas, ...oQueFaltou(doc, { itens, tipo }) };
    };
    const r = await comSegundaVolta(desenhar);
    return jsonResponse({ ok: true, doc: r.doc, titulo: r.titulo, colecao: r.colecao, explicacao: r.explicacao, devolvidas: r.devolvidas, faltando: r.faltando });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

// desenha; se o desenho não cumpriu o pedido (itens que faltaram, raias pedidas que não vieram), desenha
// de novo uma vez, dizendo o que faltou — e fica a tentativa que cumpriu mais (a primeira, se a segunda falhar)
async function comSegundaVolta(desenhar) {
  const primeira = await desenhar();
  if (!primeira.problemas.length) return primeira;
  const segunda = await desenhar(primeira.problemas).catch(() => null);
  return segunda && segunda.problemas.length <= primeira.problemas.length && segunda.faltando.length <= primeira.faltando.length ? segunda : primeira;
}
