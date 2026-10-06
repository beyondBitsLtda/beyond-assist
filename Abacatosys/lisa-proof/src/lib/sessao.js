// Quem está pedindo, e o jeito único de responder erro nas rotas.

import { COOKIE_SESSAO, lerSessao } from "./auth.js";
import { json } from "./http.js";

/** Erro com status HTTP embutido. As rotas fazem `catch (e) { return respostaDeErro(e) }`. */
export class ErroDeAcesso extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export function respostaDeErro(e) {
  const status = e instanceof ErroDeAcesso ? e.status : 500;
  return json({ ok: false, error: e?.message || "erro" }, status);
}

/** O usuário da sessão, ou 401. O middleware já barrou quem não tem cookie válido — isto é
 *  para descobrir o ID, e cobre a rota que por acaso escape do matcher. */
export async function exigirUsuario(req) {
  const valor = (req.headers.get("cookie") || "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(COOKIE_SESSAO + "="))
    ?.slice(COOKIE_SESSAO.length + 1);
  const sessao = await lerSessao(valor, process.env.PROOF_SESSAO_SECRET);
  if (!sessao.ok) throw new ErroDeAcesso(401, sessao.motivo || "sem sessão");
  return sessao.usuario;
}

/** Corpo JSON da requisição, ou 400. */
export async function corpoDe(req) {
  try {
    return await req.json();
  } catch {
    throw new ErroDeAcesso(400, "pedido inválido");
  }
}
