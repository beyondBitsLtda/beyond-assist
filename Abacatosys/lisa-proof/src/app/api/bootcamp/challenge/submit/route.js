import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { testarEntrega } from "@/lib/bootcamp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bootcamp/challenge/submit  { torneioId, codigo?, enviar? }
 *
 * O envio de código do Modo Bootcamp, nos dois jeitos: direto na tela (o código vem no corpo) ou pelo GitHub (o
 * servidor lê o arquivo da solução no último commit do repositório configurado no ambiente). Roda os testes
 * unitários do desafio (os visíveis e os ocultos) e, com `enviar`, manda a entrega para a revisão dos jurados se
 * passou em todos.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await testarEntrega(usuario.id, String(corpo?.torneioId || ""), corpo)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
