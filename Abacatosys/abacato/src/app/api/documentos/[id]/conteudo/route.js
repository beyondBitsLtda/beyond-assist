import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { urlParaLer } from "@/lib/documentosNoBanco.js";
import { comoAbrir } from "@/dominio/documentos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/documentos/:id/conteudo?revisao=<id>
 *
 * Serve um documento HTML para ser DESENHADO, e não lido como código.
 *
 * ------------------------------------------------------------------------------------------
 * O PROBLEMA QUE ESTA ROTA RESOLVE
 *
 * O armazenamento se recusa a servir `text/html`: ele devolve `text/plain`, de propósito, para
 * que ninguém hospede uma página de ataque no domínio dele. O efeito colateral é que um portal
 * de documentação enviado para cá aparecia como um paredão de código-fonte — no visor e numa
 * aba nova. O arquivo estava certo, o tipo no banco estava certo, e a tela mostrava o HTML
 * cru mesmo assim.
 *
 * ------------------------------------------------------------------------------------------
 * POR QUE SERVIR DAQUI NÃO DESFAZ A PROTEÇÃO
 *
 * A rota `abrir` explica que o endereço assinado aponta para OUTRO domínio, e que isso é
 * proteção: um HTML enviado por alguém é código, e no domínio do Abacato ele poderia falar com
 * esta API usando a sessão de quem está lendo.
 *
 * Servir daqui com `Content-Security-Policy: sandbox` devolve exatamente a mesma garantia, por
 * um caminho diferente: o cabeçalho coloca o documento numa ORIGEM OPACA, mesmo vindo do nosso
 * domínio. Sem nenhum token (`allow-scripts`, `allow-same-origin`, …), o navegador desliga o
 * script, os formulários e qualquer acesso a esta página. É o mecanismo desenhado para o caso
 * de servir conteúdo de terceiro — e vale também numa aba inteira, onde o atributo `sandbox`
 * do <iframe> não alcança.
 *
 * Só HTML passa por aqui. PDF, imagem e o resto continuam saindo pelo endereço assinado: eles
 * já desenham certo, e atravessar 40 MB por este Worker para repetir o que o armazenamento faz
 * melhor seria trocar uma coisa que funciona por uma mais cara.
 * ------------------------------------------------------------------------------------------
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "documento", id, "ver");

    const pedida = new URL(req.url).searchParams.get("revisao");

    const { data: documento } = await supabase
      .from("abacato_documentos").select("id, nome, revisao_atual_id").eq("id", id).maybeSingle();
    if (!documento) throw new ErroDeAcesso(404, "documento não encontrado");

    const alvo = pedida || documento.revisao_atual_id;
    if (!alvo) throw new ErroDeAcesso(404, "este documento não tem nenhuma versão");

    const { data: revisao } = await supabase
      .from("abacato_revisoes").select("id, documento_id, caminho, tipo, tamanho")
      .eq("id", alvo).maybeSingle();
    if (!revisao) throw new ErroDeAcesso(404, "versão não encontrada");
    if (revisao.documento_id !== id) throw new ErroDeAcesso(403, "essa versão não é deste documento");

    const jeito = comoAbrir({ tipo: revisao.tipo, nome: documento.nome });
    if (jeito !== "html") {
      throw new ErroDeAcesso(400, "esta rota serve só documentos HTML — use /abrir para os outros");
    }

    const url = await urlParaLer(revisao.caminho);
    const resposta = await fetch(url);
    if (!resposta.ok) throw new ErroDeAcesso(502, "não consegui ler o arquivo no armazenamento");

    // O corpo é repassado como FLUXO. Um portal de 40 MB carregado inteiro na memória do
    // Worker estouraria o limite dele; assim os bytes passam sem parar aqui dentro.
    return new Response(resposta.body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // A trava. Sem tokens: origem opaca, sem script, sem formulário, sem alcançar o Abacato.
        "content-security-policy": "sandbox",
        // Sem isto o navegador pode "adivinhar" outro tipo e desfazer a decisão acima.
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
        "referrer-policy": "no-referrer",
        // Documento de projeto privado não fica em cache compartilhado.
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
