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

const cookieDe = (req, nome) => (req.headers.get("cookie") || "")
  .split(";")
  .map((p) => p.trim())
  .find((p) => p.startsWith(nome + "="))
  ?.slice(nome.length + 1);

/** O usuário de verdade da sessão, ou 401 — sem o modo espectador (a saída dele e o login usam isto). */
export async function exigirUsuarioReal(req) {
  const sessao = await lerSessao(cookieDe(req, COOKIE_SESSAO), process.env.PROOF_SESSAO_SECRET);
  if (!sessao.ok) throw new ErroDeAcesso(401, sessao.motivo || "sem sessão");
  return sessao.usuario;
}

// ---- o modo espectador (03/11/2026: "eu tenho que poder ver tudo da Lisa da mesma forma que eu vejo as minhas")
//
// Com o cookie COOKIE_ESPIAR, as LEITURAS (GET) de todas as telas respondem como se a pessoa fosse a Lisa
// jogadora: o Reino, as trilhas, a prática, os cadernos, a Bolsa, o Raio-X — as mesmas telas, com os dados
// dela. Nada se escreve: qualquer outro método dá 403. Só dá para espiar a conta-robô (proof_perfis.robo),
// nunca a de uma pessoa; e o correio e os chamados dela ficam de fora (o que os outros escreveram para ela
// não é para todo mundo ler). As rotas de login, de push e do próprio modo seguem com a pessoa de verdade.

export const COOKIE_ESPIAR = "proof_espiar";
const DA_PESSOA = [/^\/api\/auth(\/|$)/, /^\/api\/espiar(\/|$)/, /^\/api\/push(\/|$)/];
const SO_DELA = [/^\/api\/correio(\/|$)/, /^\/api\/chamados(\/|$)/, /^\/api\/desafios\/[^/]+\/correio$/];
let lisaGuardada = null;

/** A Lisa jogadora: { id, email, nome } — só se a conta existe e está marcada como robô. */
export async function contaParaEspiar() {
  if (lisaGuardada) return lisaGuardada;
  const { supabase } = await import("./supabase.js");
  const { CONTA_DA_LISA } = await import("@/dominio/lisaJogadora.js");
  const { data: conta } = await supabase.from("abacato_usuarios").select("id, email, nome").ilike("email", CONTA_DA_LISA.email).maybeSingle();
  if (!conta) return null;
  const { data: perfil } = await supabase.from("proof_perfis").select("robo").eq("usuario_id", conta.id).maybeSingle();
  if (!perfil?.robo) return null;
  lisaGuardada = { id: conta.id, email: conta.email, nome: conta.nome };
  return lisaGuardada;
}

/** O usuário da sessão, ou 401. O middleware já barrou quem não tem cookie válido — isto é
 *  para descobrir o ID, e cobre a rota que por acaso escape do matcher. No modo espectador, as
 *  leituras respondem com a Lisa jogadora (ver acima). */
export async function exigirUsuario(req) {
  const real = await exigirUsuarioReal(req);
  if (cookieDe(req, COOKIE_ESPIAR) !== "lisa") return real;
  const caminho = new URL(req.url, "http://proof").pathname;
  if (DA_PESSOA.some((r) => r.test(caminho))) return real;
  if (SO_DELA.some((r) => r.test(caminho))) throw new ErroDeAcesso(403, "o correio e os chamados da Lisa são só dela — saia do modo espectador para ver os seus");
  if (req.method !== "GET" && req.method !== "HEAD") throw new ErroDeAcesso(403, "você está vendo o Proof da Lisa: aqui é só olhar — saia do modo espectador para jogar");
  const lisa = await contaParaEspiar();
  if (!lisa) throw new ErroDeAcesso(404, "a Lisa ainda não está jogando");
  return lisa;
}

/** Corpo JSON da requisição, ou 400. */
export async function corpoDe(req) {
  try {
    return await req.json();
  } catch {
    throw new ErroDeAcesso(400, "pedido inválido");
  }
}
