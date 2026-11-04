import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { anexarNaPagina, exigirPagina } from "@/lib/cadernos.js";
import { exigirLivro, marcacaoComLivro } from "@/lib/biblioteca.js";
import { vincular } from "@/lib/vinculos.js";
import { citacaoDoLivro } from "@/dominio/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/paginas/:id/anexar — manda um trecho do livro para o fim da página do caderno, com o
 * link que volta à página do leitor, e liga a página do caderno àquela página do livro.
 *   { marcacaoId }                      uma marcação já salva
 *   { livroId, pagina, texto, nota? }   uma seleção solta
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    let livroId, livroTitulo, pagina, texto, nota;
    if (corpo?.marcacaoId) {
      const m = await marcacaoComLivro(usuario.id, corpo.marcacaoId);
      ({ livroId, livroTitulo } = m);
      ({ pagina, texto, nota } = m.marcacao);
    } else {
      const livro = await exigirLivro(usuario.id, corpo?.livroId, "id, titulo, paginas");
      pagina = Number.parseInt(corpo?.pagina, 10);
      if (!Number.isFinite(pagina) || pagina < 1 || pagina > livro.paginas) throw new ErroDeAcesso(400, "página fora do livro");
      livroId = livro.id;
      livroTitulo = livro.titulo;
      texto = String(corpo?.texto || "").slice(0, 4000);
      nota = String(corpo?.nota || "").slice(0, 4000);
    }
    const trecho = citacaoDoLivro({ livroId, livroTitulo, pagina, texto, nota });
    const resultado = await anexarNaPagina(usuario.id, id, trecho);
    const p = await exigirPagina(usuario.id, id);
    await vincular(usuario.id, { cadernoId: p.caderno_id, paginaId: id, alvo: { tipo: "livro", id: livroId, numero: pagina } }).catch(() => null);
    return json({ ok: true, pagina: resultado });
  } catch (e) {
    return respostaDeErro(e);
  }
}
