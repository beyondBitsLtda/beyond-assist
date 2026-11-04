import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { torneioParaTela, abrirRodada, agirNaRodada, chamarJurados, apagarTorneio } from "@/lib/bootcamp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bootcamp/:id — a arena: participantes e a etapa de cada um, a rodada, a minha entrega e o que dá para fazer. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await torneioParaTela(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/bootcamp/:id
 *   { acao: "abrir-rodada" }                                 o organizador abre a rodada: os jurados lançam o desafio
 *   { acao: "ler" }                                          Início: li o enunciado
 *   { acao: "planejar", plano }                              Análise de requisitos e planejamento
 *   { acao: "ambiente", modo, linguagem, repo?, caminho? }   Configuração do ambiente (editor ou GitHub)
 *   { acao: "jurados" }                                      os jurados avaliam a rodada
 * O código e os testes vão por POST /api/bootcamp/challenge/submit.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    if (corpo.acao === "abrir-rodada") return json({ ok: true, ...(await abrirRodada(usuario.id, id)) });
    if (corpo.acao === "jurados") return json({ ok: true, ...(await chamarJurados(usuario.id, id)) });
    if (["ler", "planejar", "ambiente"].includes(corpo.acao)) return json({ ok: true, ...(await agirNaRodada(usuario.id, id, corpo)) });
    throw new ErroDeAcesso(400, "ação desconhecida");
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/bootcamp/:id — o organizador exclui o torneio. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarTorneio(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
