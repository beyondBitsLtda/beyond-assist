import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { urlParaLer } from "@/lib/documentosNoBanco.js";
import { comoAbrir } from "@/dominio/documentos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quanto texto a tela mostra sem baixar. Um log de 40 MB travaria o navegador ao ser desenhado
// como texto; acima disto a tela oferece baixar, que é o que serve para um arquivo desse tamanho.
const TETO_DE_TEXTO = 400 * 1024;

/**
 * GET /api/documentos/:id/abrir?revisao=<id>
 *
 * Devolve um endereço assinado e de vida curta, e diz COMO aquilo se abre. Não devolve o
 * arquivo: um PDF de 40 MB atravessando o Worker em cada abertura gastaria memória e tempo
 * para fazer o que o armazenamento já faz melhor.
 *
 * ---------------------------------------------------------------------------------------
 * O ENDEREÇO ASSINADO APONTA PARA OUTRO DOMÍNIO, E ISSO É PROTEÇÃO, NÃO DETALHE.
 *
 * Um documento HTML enviado por alguém é CÓDIGO. Aberto numa moldura do mesmo domínio do
 * Abacato, ele poderia falar com a API daqui usando a sessão de quem está lendo — criar,
 * apagar, o que a pessoa puder fazer. O arquivo sai de `banco.beyond.dev.br`, que é outra
 * origem: o navegador impede sozinho que ele toque nesta página.
 *
 * A tela ainda o abre com `sandbox`, que desliga o script. Duas travas, porque esta é a única
 * parte do sistema que executa conteúdo que alguém mandou.
 * ---------------------------------------------------------------------------------------
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
      .from("abacato_revisoes").select("id, documento_id, numero, caminho, tipo, tamanho")
      .eq("id", alvo).maybeSingle();
    if (!revisao) throw new ErroDeAcesso(404, "versão não encontrada");
    // Uma revisão de OUTRO documento não pode ser lida por aqui: o `exigir` acima conferiu a
    // permissão sobre ESTE documento, e não sobre aquele.
    if (revisao.documento_id !== id) throw new ErroDeAcesso(403, "essa versão não é deste documento");

    const jeito = comoAbrir({ tipo: revisao.tipo, nome: documento.nome });
    const url = await urlParaLer(revisao.caminho);

    // Para texto, o conteúdo vem JUNTO. A alternativa seria a tela buscar o endereço assinado
    // por conta própria, e aí depende de o armazenamento liberar leitura de outro domínio
    // (CORS) — uma configuração de um serviço que não é nosso, que some num `docker compose
    // pull` e leva junto a pré-visualização de todo arquivo de texto.
    let conteudo = null;
    let truncado = false;
    if (jeito === "texto") {
      if (revisao.tamanho <= TETO_DE_TEXTO) {
        const res = await fetch(url);
        if (res.ok) conteudo = await res.text();
      } else {
        truncado = true;
      }
    }

    return json({
      ok: true,
      jeito,
      url,
      // O mesmo endereço, pedindo ao armazenamento que force o download com o nome de verdade.
      // Sem isto, o arquivo salvo teria o nome sorteado do disco, e ninguém reconheceria
      // "003-a1b2c3d4-contrato.pdf" na pasta de downloads.
      urlBaixar: `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(documento.nome)}`,
      // Para HTML, o endereço que DESENHA a página. O armazenamento devolve `text/html` como
      // `text/plain` (para ninguém hospedar ataque no domínio dele), e a moldura acabava
      // mostrando o código-fonte. A rota /conteudo serve daqui com `CSP: sandbox`, que devolve
      // a mesma proteção por outro caminho — ver o comentário longo lá.
      urlConteudo: jeito === "html"
        ? `/api/documentos/${id}/conteudo${pedida ? `?revisao=${encodeURIComponent(pedida)}` : ""}`
        : null,
      nome: documento.nome,
      revisao: { id: revisao.id, numero: revisao.numero, tipo: revisao.tipo, tamanho: revisao.tamanho },
      conteudo,
      truncado,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
