/**
 * Entrar na Lisa Task com a conta da Lisa (01/11/2026: "o usuário cadastrado na Lisa deve ser o
 * mesmo que vai acessar o Lisa Task").
 *
 * A Lisa e o Abacato usam o mesmo Supabase. A Lisa manda a sessão da pessoa (o token do Supabase
 * Auth) para src/app/api/auth/lisa/route.js, a rota confirma no próprio Auth quem é, e a conta do
 * Abacato é a do mesmo e-mail — criada como Lisa Task no primeiro acesso.
 *
 * Só a conta Lisa Task entra assim. Uma conta interna ou de cliente com o mesmo e-mail alcança
 * mais coisa (documentos, outros quadros, administração), e por isso continua com a senha do
 * próprio Abacato: uma sessão da Lisa não vira acesso de administrador por tabela.
 *
 * Puro: sem banco e sem rede. Testado em scripts/lisa-task-check.mjs.
 */

/** O que fazer com a conta do Abacato que tem o e-mail da pessoa da Lisa:
 *  "criar" (não tem), "entrar", "senha" (conta de outro tipo: entra com a senha do Abacato)
 *  ou "desativada". */
export function decidirEntrada(conta) {
  if (!conta) return "criar";
  if (conta.tipo !== "lisatask") return "senha";
  if (!conta.ativo || conta.aprovado === false) return "desativada";
  return "entrar";
}

export const ORIGEM_DA_LISA = "https://lisa.beyond.dev.br";

/** As origens que podem mandar alguém entrar (LISA_ORIGEM, separadas por vírgula; a Lisa de
 *  produção sem a variável). */
export function origensDaLisa(texto) {
  return String(texto || ORIGEM_DA_LISA)
    .split(/[\s,;]+/)
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** O pedido veio da página da Lisa? Sem isto, qualquer site poderia postar um token e trocar a
 *  sessão de quem estivesse com o Abacato aberto. */
export function origemPermitida(origem, permitidas) {
  if (!origem || origem === "null") return false;
  return permitidas.includes(String(origem).replace(/\/+$/, ""));
}

/** O nome da conta nova: o que o Auth tiver; senão, o começo do e-mail. */
export function nomeDaPessoa({ email, metadados } = {}) {
  const m = metadados || {};
  const nome = [m.nome, m.name, m.full_name].find((x) => typeof x === "string" && x.trim());
  if (nome) return nome.trim().slice(0, 80);
  const local = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return local ? (local.charAt(0).toUpperCase() + local.slice(1)).slice(0, 80) : "Pessoa da Lisa";
}
